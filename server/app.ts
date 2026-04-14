import Fastify, { FastifyReply, FastifyRequest } from "fastify"
import cookie from "@fastify/cookie"
import cors from "@fastify/cors"
import { AuthUser, WorkspaceRole } from "../src/shared/collaboration"
import { getServerConfig, ServerConfig } from "./config"
import { createDatabase } from "./db/client"
import { runMigrations } from "./db/migrate"
import * as schema from "./db/schema"
import {
  acceptInvite,
  acquireLock,
  addWorkspaceMember,
  bootstrapAdminUser,
  createInvite,
  createSession,
  createWorkspace,
  deleteSession,
  getDocumentEnvelope,
  getInviteByToken,
  getLockStatus,
  getSessionUser,
  getWorkspace,
  getWorkspaceRole,
  heartbeatLock,
  listAuditEvents,
  listWorkspaceMembers,
  listWorkspaces,
  loginUser,
  releaseLock,
  runAutoPlace,
  saveDocument,
  takeoverLock,
  updateWorkspaceMemberRole,
  updateWorkspaceName,
} from "./repositories"
import {
  acceptInviteSchema,
  addMemberSchema,
  autoPlaceSchema,
  createInviteSchema,
  createWorkspaceSchema,
  loginSchema,
  saveDocumentSchema,
  updateMemberSchema,
  updateWorkspaceSchema,
} from "./schemas"
import { createId } from "./security"
import { normalizeCollaborativeState } from "./collaboration"
import { Database } from "./types"
import type { Pool } from "pg"

const SESSION_COOKIE = "classroom_session"

const defaultRepositories = {
  acceptInvite,
  acquireLock,
  addWorkspaceMember,
  bootstrapAdminUser,
  createInvite,
  createSession,
  createWorkspace,
  deleteSession,
  getDocumentEnvelope,
  getInviteByToken,
  getLockStatus,
  getSessionUser,
  getWorkspace,
  getWorkspaceRole,
  heartbeatLock,
  listAuditEvents,
  listWorkspaceMembers,
  listWorkspaces,
  loginUser,
  releaseLock,
  runAutoPlace,
  saveDocument,
  takeoverLock,
  updateWorkspaceMemberRole,
  updateWorkspaceName,
}

export function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

export function resolveRequestOrigin(request: FastifyRequest): string | null {
  const directOrigin = request.headers.origin
  if (typeof directOrigin === "string" && directOrigin.trim()) {
    return normalizeOrigin(directOrigin)
  }

  const referer = request.headers.referer
  if (typeof referer === "string" && referer.trim()) {
    return normalizeOrigin(referer)
  }

  return null
}

export function isTrustedRequestOrigin(request: FastifyRequest, allowedOrigins: Set<string>): boolean {
  const requestOrigin = resolveRequestOrigin(request)
  return requestOrigin != null && allowedOrigins.has(requestOrigin)
}

interface CreateServerOptions {
  config?: ServerConfig
  db?: Database
  pool?: Pool
  skipMigrations?: boolean
  repositories?: Partial<typeof defaultRepositories>
}

function setSessionCookie(reply: FastifyReply, token: string, secure: boolean) {
  reply.setCookie(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
  })
}

function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, {
    path: "/",
  })
}

export async function createServer(options: CreateServerOptions = {}) {
  const config = options.config ?? getServerConfig()
  const services = options.db && options.pool
    ? { db: options.db, pool: options.pool }
    : createDatabase(config.databaseUrl)
  const { db, pool } = services
  const repositories = { ...defaultRepositories, ...(options.repositories ?? {}) }

  if (!options.skipMigrations) {
    await runMigrations(pool as Pool)
    await repositories.bootstrapAdminUser(
      db,
      config.bootstrapAdminUsername,
      config.bootstrapAdminPassword,
      config.bootstrapAdminDisplayName
    )
  }

  const app = Fastify({ logger: true })
  const allowedOrigins = new Set(config.allowedOrigins.map((origin) => normalizeOrigin(origin)).filter((origin): origin is string => origin != null))

  app.services = { db, pool }

  await app.register(cors, {
    origin(origin, callback) {
      if (!origin) {
        callback(null, false)
        return
      }
      callback(null, allowedOrigins.has(normalizeOrigin(origin) ?? ""))
    },
    credentials: true,
  })
  await app.register(cookie, {
    secret: config.sessionSecret,
  })

  app.addHook("preHandler", async (request, reply) => {
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return
    if (!request.url.startsWith("/api/")) return
    if (!isTrustedRequestOrigin(request, allowedOrigins)) {
      reply.code(403).send({ error: "Requests must come from a trusted origin." })
    }
  })

  app.decorate("requireAuth", async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies[SESSION_COOKIE]
    if (!token) {
      reply.code(401).send({ error: "Authentication required." })
      return
    }

    const user = await repositories.getSessionUser(db, token)
    if (!user) {
      clearSessionCookie(reply)
      reply.code(401).send({ error: "Session expired." })
      return
    }

    request.authUser = user
  })

  app.decorate("requireWorkspaceRole", async (request: FastifyRequest, reply: FastifyReply, workspaceId: string, roles: WorkspaceRole[]) => {
    const user = request.authUser as AuthUser | undefined
    if (!user) {
      reply.code(401).send({ error: "Authentication required." })
      return null
    }
    const role = await repositories.getWorkspaceRole(db, workspaceId, user.id)
    if (!role || !roles.includes(role)) {
      reply.code(403).send({ error: "You do not have access to this workspace." })
      return null
    }
    return role
  })

  app.get("/api/health", async () => ({ ok: true }))

  app.post("/api/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid login request." })
    }

    const user = await repositories.loginUser(db, parsed.data.username, parsed.data.password)
    if (!user) {
      return reply.code(401).send({ error: "Invalid username or password." })
    }

    const session = await repositories.createSession(db, user.id)
    setSessionCookie(reply, session.token, config.cookieSecure)
    return { user }
  })

  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE]
    if (token) {
      await repositories.deleteSession(db, token)
    }
    clearSessionCookie(reply)
    return { ok: true }
  })

  app.get("/api/auth/me", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE]
    if (!token) return reply.code(401).send({ error: "Not logged in." })
    const user = await repositories.getSessionUser(db, token)
    if (!user) return reply.code(401).send({ error: "Not logged in." })
    return { user }
  })

  app.get("/api/invites/:token", async (request, reply) => {
    const token = (request.params as { token: string }).token
    const invite = await repositories.getInviteByToken(db, token)
    if (!invite) return reply.code(404).send({ error: "Invite not found." })
    return {
      id: invite.id,
      workspaceId: invite.workspaceId,
      workspaceName: invite.workspaceName,
      role: invite.role,
      expiresAt: invite.expiresAt.toISOString(),
    }
  })

  app.post("/api/invites", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return

    const parsed = createInviteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid invite request." })
    }

    const role = await app.requireWorkspaceRole(request, reply, parsed.data.workspaceId, ["owner"])
    if (reply.sent || !role) return
    const invite = await repositories.createInvite(
      db,
      parsed.data.workspaceId,
      request.authUser!.id,
      parsed.data.role,
      parsed.data.email || undefined
    )
    await db.insert(schema.auditEvents).values({
      id: createId("audit"),
      workspaceId: parsed.data.workspaceId,
      userId: request.authUser!.id,
      action: "invite.created",
      details: { role: parsed.data.role, email: parsed.data.email || undefined },
    })

    return {
      id: invite.inviteId,
      workspaceId: parsed.data.workspaceId,
      role: parsed.data.role,
      token: invite.token,
      expiresAt: invite.expiresAt.toISOString(),
    }
  })

  app.post("/api/invites/accept", async (request, reply) => {
    const parsed = acceptInviteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid invite acceptance request." })
    }

    const result = await repositories.acceptInvite(
      db,
      parsed.data.token,
      parsed.data.username,
      parsed.data.password,
      parsed.data.displayName,
      parsed.data.email || undefined
    )
    if (result.status === "invalid") {
      return reply.code(400).send({ error: "Invite is invalid or expired." })
    }
    if (result.status === "duplicate") {
      return reply.code(409).send({ error: result.message, field: result.field })
    }

    const session = await repositories.createSession(db, result.user.id)
    setSessionCookie(reply, session.token, config.cookieSecure)
    return { user: result.user }
  })

  app.get("/api/workspaces", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    return { workspaces: await repositories.listWorkspaces(db, request.authUser!.id) }
  })

  app.post("/api/workspaces", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const parsed = createWorkspaceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid workspace request." })
    }
    return { workspace: await repositories.createWorkspace(db, request.authUser!, parsed.data.name) }
  })

  app.get("/api/workspaces/:id", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const workspace = await repositories.getWorkspace(db, workspaceId, request.authUser!.id)
    if (!workspace) {
      return reply.code(404).send({ error: "Workspace not found." })
    }
    return { workspace }
  })

  app.patch("/api/workspaces/:id", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const role = await app.requireWorkspaceRole(request, reply, workspaceId, ["owner"])
    if (reply.sent || !role) return
    const parsed = updateWorkspaceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid workspace update." })
    }
    await repositories.updateWorkspaceName(db, workspaceId, request.authUser!, parsed.data.name)
    return { workspace: await repositories.getWorkspace(db, workspaceId, request.authUser!.id) }
  })

  app.get("/api/workspaces/:id/members", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const role = await app.requireWorkspaceRole(request, reply, workspaceId, ["owner", "editor", "viewer"])
    if (reply.sent || !role) return
    return { members: await repositories.listWorkspaceMembers(db, workspaceId) }
  })

  app.post("/api/workspaces/:id/members", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const role = await app.requireWorkspaceRole(request, reply, workspaceId, ["owner"])
    if (reply.sent || !role) return
    const parsed = addMemberSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid member request." })
    }
    const added = await repositories.addWorkspaceMember(db, workspaceId, parsed.data.identifier, parsed.data.role)
    if (!added) {
      return reply.code(404).send({ error: "User not found." })
    }
    return { members: await repositories.listWorkspaceMembers(db, workspaceId) }
  })

  app.patch("/api/workspaces/:id/members/:userId", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const params = request.params as { id: string; userId: string }
    const role = await app.requireWorkspaceRole(request, reply, params.id, ["owner"])
    if (reply.sent || !role) return
    const parsed = updateMemberSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid role update." })
    }
    await repositories.updateWorkspaceMemberRole(db, params.id, params.userId, parsed.data.role)
    return { members: await repositories.listWorkspaceMembers(db, params.id) }
  })

  app.get("/api/workspaces/:id/document", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const role = await app.requireWorkspaceRole(request, reply, workspaceId, ["owner", "editor", "viewer"])
    if (reply.sent || !role) return
    const envelope = await repositories.getDocumentEnvelope(db, workspaceId)
    if (!envelope) {
      return reply.code(404).send({ error: "Document not found." })
    }
    return envelope
  })

  app.put("/api/workspaces/:id/document", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const role = await app.requireWorkspaceRole(request, reply, workspaceId, ["owner", "editor"])
    if (reply.sent || !role) return
    const parsed = saveDocumentSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid document save request." })
    }
    const lock = await repositories.getLockStatus(db, workspaceId, request.authUser!.id)
    if (!lock.isCurrentUserHolder) {
      return reply.code(423).send({ error: "You must hold the workspace lock before saving.", lock })
    }
    const result = await repositories.saveDocument(
      db,
      workspaceId,
      request.authUser!,
      parsed.data.version,
      normalizeCollaborativeState(parsed.data.document)
    )
    if (result.conflict) {
      return reply.code(409).send({ error: "Document version conflict.", currentVersion: result.currentVersion })
    }
    return result
  })

  app.post("/api/workspaces/:id/auto-place", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const role = await app.requireWorkspaceRole(request, reply, workspaceId, ["owner", "editor"])
    if (reply.sent || !role) return
    const parsed = autoPlaceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid auto-place request." })
    }
    const lock = await repositories.getLockStatus(db, workspaceId, request.authUser!.id)
    if (!lock.isCurrentUserHolder) {
      return reply.code(423).send({ error: "You must hold the workspace lock before auto-place.", lock })
    }
    const result = await repositories.runAutoPlace(db, workspaceId, request.authUser!, parsed.data.version)
    if (result.conflict) {
      return reply.code(409).send({ error: "Document version conflict.", currentVersion: result.currentVersion })
    }
    return result
  })

  app.get("/api/workspaces/:id/lock", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const role = await app.requireWorkspaceRole(request, reply, workspaceId, ["owner", "editor", "viewer"])
    if (reply.sent || !role) return
    return await repositories.getLockStatus(db, workspaceId, request.authUser!.id)
  })

  app.post("/api/workspaces/:id/lock/acquire", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const role = await app.requireWorkspaceRole(request, reply, workspaceId, ["owner", "editor"])
    if (reply.sent || !role) return
    const lock = await repositories.acquireLock(db, workspaceId, request.authUser!)
    if (!lock) {
      return reply.code(423).send({ error: "Workspace is already locked by another editor." })
    }
    await db.insert(schema.auditEvents).values({
      id: createId("audit"),
      workspaceId,
      userId: request.authUser!.id,
      action: "lock.acquired",
      details: {},
    })
    return lock
  })

  app.post("/api/workspaces/:id/lock/heartbeat", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const role = await app.requireWorkspaceRole(request, reply, workspaceId, ["owner", "editor"])
    if (reply.sent || !role) return
    const lock = await repositories.heartbeatLock(db, workspaceId, request.authUser!.id)
    if (!lock) {
      return reply.code(423).send({ error: "You do not hold the workspace lock." })
    }
    return lock
  })

  app.post("/api/workspaces/:id/lock/release", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const role = await app.requireWorkspaceRole(request, reply, workspaceId, ["owner", "editor"])
    if (reply.sent || !role) return
    await repositories.releaseLock(db, workspaceId, request.authUser!.id)
    await db.insert(schema.auditEvents).values({
      id: createId("audit"),
      workspaceId,
      userId: request.authUser!.id,
      action: "lock.released",
      details: {},
    })
    return { ok: true }
  })

  app.post("/api/workspaces/:id/lock/takeover", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const role = await app.requireWorkspaceRole(request, reply, workspaceId, ["owner", "editor"])
    if (reply.sent || !role) return
    const current = await repositories.getLockStatus(db, workspaceId, request.authUser!.id)
    if (current.locked && !current.canTakeOver && !current.isCurrentUserHolder) {
      return reply.code(423).send({ error: "Lock takeover is not allowed right now." })
    }
    if (current.locked && role !== "owner" && current.expiresAt && new Date(current.expiresAt).getTime() > Date.now()) {
      return reply.code(423).send({ error: "Only owners can force takeover of an active lock." })
    }
    const lock = await repositories.takeoverLock(db, workspaceId, request.authUser!)
    await db.insert(schema.auditEvents).values({
      id: createId("audit"),
      workspaceId,
      userId: request.authUser!.id,
      action: "lock.taken_over",
      details: { previousHolderUserId: current.holderUserId ?? null },
    })
    return lock
  })

  app.get("/api/workspaces/:id/audit", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const role = await app.requireWorkspaceRole(request, reply, workspaceId, ["owner", "editor", "viewer"])
    if (reply.sent || !role) return
    return { events: await repositories.listAuditEvents(db, workspaceId) }
  })

  app.addHook("onClose", async () => {
    await pool.end()
  })

  return app
}
