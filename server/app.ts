import Fastify, { FastifyReply, FastifyRequest } from "fastify"
import cookie from "@fastify/cookie"
import cors from "@fastify/cors"
import { AuthUser, WorkspaceRole } from "../src/shared/collaboration"
import { getServerConfig } from "./config"
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

const SESSION_COOKIE = "classroom_session"

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

export async function createServer() {
  const config = getServerConfig()
  const { db, pool } = createDatabase(config.databaseUrl)
  await runMigrations(pool)
  await bootstrapAdminUser(db, config.bootstrapAdminUsername, config.bootstrapAdminPassword, config.bootstrapAdminDisplayName)

  const app = Fastify({ logger: true })

  app.services = { db, pool }

  await app.register(cors, {
    origin: true,
    credentials: true,
  })
  await app.register(cookie, {
    secret: config.sessionSecret,
  })

  app.decorate("requireAuth", async (request: FastifyRequest, reply: FastifyReply) => {
    const token = request.cookies[SESSION_COOKIE]
    if (!token) {
      reply.code(401).send({ error: "Authentication required." })
      return
    }

    const user = await getSessionUser(db, token)
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
    const role = await getWorkspaceRole(db, workspaceId, user.id)
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

    const user = await loginUser(db, parsed.data.username, parsed.data.password)
    if (!user) {
      return reply.code(401).send({ error: "Invalid username or password." })
    }

    const session = await createSession(db, user.id)
    setSessionCookie(reply, session.token, config.cookieSecure)
    return { user }
  })

  app.post("/api/auth/logout", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE]
    if (token) {
      await deleteSession(db, token)
    }
    clearSessionCookie(reply)
    return { ok: true }
  })

  app.get("/api/auth/me", async (request, reply) => {
    const token = request.cookies[SESSION_COOKIE]
    if (!token) return reply.code(401).send({ error: "Not logged in." })
    const user = await getSessionUser(db, token)
    if (!user) return reply.code(401).send({ error: "Not logged in." })
    return { user }
  })

  app.get("/api/invites/:token", async (request, reply) => {
    const token = (request.params as { token: string }).token
    const invite = await getInviteByToken(db, token)
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
    const invite = await createInvite(
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

    const user = await acceptInvite(
      db,
      parsed.data.token,
      parsed.data.username,
      parsed.data.password,
      parsed.data.displayName,
      parsed.data.email || undefined
    )
    if (!user) {
      return reply.code(400).send({ error: "Invite is invalid or expired." })
    }

    const session = await createSession(db, user.id)
    setSessionCookie(reply, session.token, config.cookieSecure)
    return { user }
  })

  app.get("/api/workspaces", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    return { workspaces: await listWorkspaces(db, request.authUser!.id) }
  })

  app.post("/api/workspaces", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const parsed = createWorkspaceSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid workspace request." })
    }
    return { workspace: await createWorkspace(db, request.authUser!, parsed.data.name) }
  })

  app.get("/api/workspaces/:id", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const workspace = await getWorkspace(db, workspaceId, request.authUser!.id)
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
    await updateWorkspaceName(db, workspaceId, request.authUser!, parsed.data.name)
    return { workspace: await getWorkspace(db, workspaceId, request.authUser!.id) }
  })

  app.get("/api/workspaces/:id/members", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const role = await app.requireWorkspaceRole(request, reply, workspaceId, ["owner", "editor", "viewer"])
    if (reply.sent || !role) return
    return { members: await listWorkspaceMembers(db, workspaceId) }
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
    const added = await addWorkspaceMember(db, workspaceId, parsed.data.identifier, parsed.data.role)
    if (!added) {
      return reply.code(404).send({ error: "User not found." })
    }
    return { members: await listWorkspaceMembers(db, workspaceId) }
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
    await updateWorkspaceMemberRole(db, params.id, params.userId, parsed.data.role)
    return { members: await listWorkspaceMembers(db, params.id) }
  })

  app.get("/api/workspaces/:id/document", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const role = await app.requireWorkspaceRole(request, reply, workspaceId, ["owner", "editor", "viewer"])
    if (reply.sent || !role) return
    const envelope = await getDocumentEnvelope(db, workspaceId)
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
    const lock = await getLockStatus(db, workspaceId, request.authUser!.id)
    if (!lock.isCurrentUserHolder) {
      return reply.code(423).send({ error: "You must hold the workspace lock before saving.", lock })
    }
    const result = await saveDocument(
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
    const lock = await getLockStatus(db, workspaceId, request.authUser!.id)
    if (!lock.isCurrentUserHolder) {
      return reply.code(423).send({ error: "You must hold the workspace lock before auto-place.", lock })
    }
    const result = await runAutoPlace(db, workspaceId, request.authUser!, parsed.data.version)
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
    return await getLockStatus(db, workspaceId, request.authUser!.id)
  })

  app.post("/api/workspaces/:id/lock/acquire", async (request, reply) => {
    await app.requireAuth(request, reply)
    if (reply.sent) return
    const workspaceId = (request.params as { id: string }).id
    const role = await app.requireWorkspaceRole(request, reply, workspaceId, ["owner", "editor"])
    if (reply.sent || !role) return
    const lock = await acquireLock(db, workspaceId, request.authUser!)
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
    const lock = await heartbeatLock(db, workspaceId, request.authUser!.id)
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
    await releaseLock(db, workspaceId, request.authUser!.id)
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
    const current = await getLockStatus(db, workspaceId, request.authUser!.id)
    if (current.locked && !current.canTakeOver && !current.isCurrentUserHolder) {
      return reply.code(423).send({ error: "Lock takeover is not allowed right now." })
    }
    if (current.locked && role !== "owner" && current.expiresAt && new Date(current.expiresAt).getTime() > Date.now()) {
      return reply.code(423).send({ error: "Only owners can force takeover of an active lock." })
    }
    const lock = await takeoverLock(db, workspaceId, request.authUser!)
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
    return { events: await listAuditEvents(db, workspaceId) }
  })

  app.addHook("onClose", async () => {
    await pool.end()
  })

  return app
}
