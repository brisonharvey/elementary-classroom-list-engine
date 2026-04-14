import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm"
import { CollaborativePlacementState, AuthUser, EditLockStatus, WorkspaceMember, WorkspaceRole, WorkspaceSummary } from "../src/shared/collaboration"
import * as schema from "./db/schema"
import { createEmptyCollaborativeState } from "../src/shared/collaboration"
import { createId, createToken, hashPassword, hashToken, verifyPassword } from "./security"
import { Database } from "./types"
import { LOCK_TTL_MS } from "./config"
import { normalizeCollaborativeState, reduceCollaborativeState } from "./collaboration"

type InviteAcceptanceResult =
  | { status: "accepted"; user: AuthUser }
  | { status: "invalid" }
  | { status: "duplicate"; field: "username" | "email"; message: string }

function isUniqueViolation(error: unknown): error is { code: string; constraint?: string } {
  return typeof error === "object" && error != null && "code" in error && (error as { code?: string }).code === "23505"
}

function getInviteDuplicateResult(error: unknown): InviteAcceptanceResult {
  const constraint = isUniqueViolation(error) ? error.constraint : undefined
  if (constraint === "users_email_unique") {
    return {
      status: "duplicate",
      field: "email",
      message: "That email address is already in use.",
    }
  }

  return {
    status: "duplicate",
    field: "username",
    message: "That username is already in use.",
  }
}

function mapUser(row: typeof schema.users.$inferSelect): AuthUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    email: row.email ?? undefined,
  }
}

export async function bootstrapAdminUser(
  db: Database,
  username: string | undefined,
  password: string | undefined,
  displayName: string
) {
  if (!username || !password) return
  const existing = await db.select().from(schema.users).limit(1)
  if (existing.length > 0) return

  await db.insert(schema.users).values({
    id: createId("user"),
    username,
    displayName,
    passwordHash: await hashPassword(password),
  })
}

export async function loginUser(db: Database, username: string, password: string): Promise<AuthUser | null> {
  const row = await db.query.users.findFirst({
    where: eq(schema.users.username, username),
  })
  if (!row) return null
  const valid = await verifyPassword(password, row.passwordHash)
  return valid ? mapUser(row) : null
}

export async function createSession(db: Database, userId: string) {
  const token = createToken()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)

  await db.insert(schema.sessions).values({
    id: createId("session"),
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  })

  return { token, expiresAt }
}

export async function getSessionUser(db: Database, token: string): Promise<AuthUser | null> {
  const tokenHash = hashToken(token)
  const row = await db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      email: schema.users.email,
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.sessions.userId, schema.users.id))
    .where(and(eq(schema.sessions.tokenHash, tokenHash), gt(schema.sessions.expiresAt, new Date())))
    .limit(1)

  return row[0] ? { ...row[0], email: row[0].email ?? undefined } : null
}

export async function deleteSession(db: Database, token: string) {
  await db.delete(schema.sessions).where(eq(schema.sessions.tokenHash, hashToken(token)))
}

export async function createWorkspace(db: Database, user: AuthUser, name: string): Promise<WorkspaceSummary> {
  const workspaceId = createId("workspace")
  const now = new Date()

  await db.transaction(async (tx) => {
    await tx.insert(schema.workspaces).values({
      id: workspaceId,
      name,
      updatedAt: now,
      updatedBy: user.id,
    })
    await tx.insert(schema.workspaceMembers).values({
      workspaceId,
      userId: user.id,
      role: "owner",
    })
    await tx.insert(schema.placementDocuments).values({
      workspaceId,
      document: createEmptyCollaborativeState(),
      version: 1,
      updatedAt: now,
      updatedBy: user.id,
    })
    await tx.insert(schema.auditEvents).values({
      id: createId("audit"),
      workspaceId,
      userId: user.id,
      action: "workspace.created",
      details: { name },
    })
  })

  return {
    id: workspaceId,
    name,
    role: "owner",
    updatedAt: now.toISOString(),
    updatedBy: user.displayName,
  }
}

export async function listWorkspaces(db: Database, userId: string): Promise<WorkspaceSummary[]> {
  const rows = await db
    .select({
      id: schema.workspaces.id,
      name: schema.workspaces.name,
      role: schema.workspaceMembers.role,
      updatedAt: schema.workspaces.updatedAt,
      updatedByName: schema.users.displayName,
    })
    .from(schema.workspaceMembers)
    .innerJoin(schema.workspaces, eq(schema.workspaceMembers.workspaceId, schema.workspaces.id))
    .leftJoin(schema.users, eq(schema.workspaces.updatedBy, schema.users.id))
    .where(eq(schema.workspaceMembers.userId, userId))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedByName ?? undefined,
  }))
}

export async function getWorkspaceRole(db: Database, workspaceId: string, userId: string): Promise<WorkspaceRole | null> {
  const row = await db.query.workspaceMembers.findFirst({
    where: and(eq(schema.workspaceMembers.workspaceId, workspaceId), eq(schema.workspaceMembers.userId, userId)),
  })
  return row?.role ?? null
}

export async function getWorkspace(db: Database, workspaceId: string, userId: string): Promise<WorkspaceSummary | null> {
  const rows = await db
    .select({
      id: schema.workspaces.id,
      name: schema.workspaces.name,
      role: schema.workspaceMembers.role,
      updatedAt: schema.workspaces.updatedAt,
      updatedByName: schema.users.displayName,
    })
    .from(schema.workspaceMembers)
    .innerJoin(schema.workspaces, eq(schema.workspaceMembers.workspaceId, schema.workspaces.id))
    .leftJoin(schema.users, eq(schema.workspaces.updatedBy, schema.users.id))
    .where(and(eq(schema.workspaceMembers.workspaceId, workspaceId), eq(schema.workspaceMembers.userId, userId)))
    .limit(1)

  const row = rows[0]
  if (!row) return null
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedByName ?? undefined,
  }
}

export async function updateWorkspaceName(db: Database, workspaceId: string, user: AuthUser, name: string) {
  await db.update(schema.workspaces).set({
    name,
    updatedAt: new Date(),
    updatedBy: user.id,
  }).where(eq(schema.workspaces.id, workspaceId))

  await db.insert(schema.auditEvents).values({
    id: createId("audit"),
    workspaceId,
    userId: user.id,
    action: "workspace.renamed",
    details: { name },
  })
}

export async function listWorkspaceMembers(db: Database, workspaceId: string): Promise<WorkspaceMember[]> {
  const rows = await db
    .select({
      userId: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      email: schema.users.email,
      role: schema.workspaceMembers.role,
      joinedAt: schema.workspaceMembers.joinedAt,
    })
    .from(schema.workspaceMembers)
    .innerJoin(schema.users, eq(schema.workspaceMembers.userId, schema.users.id))
    .where(eq(schema.workspaceMembers.workspaceId, workspaceId))

  return rows.map((row) => ({
    userId: row.userId,
    username: row.username,
    displayName: row.displayName,
    email: row.email ?? undefined,
    role: row.role,
    joinedAt: row.joinedAt.toISOString(),
  }))
}

export async function addWorkspaceMember(db: Database, workspaceId: string, identifier: string, role: WorkspaceRole) {
  const user = await db.query.users.findFirst({
    where: or(eq(schema.users.username, identifier), eq(schema.users.email, identifier)),
  })
  if (!user) return null

  await db.insert(schema.workspaceMembers).values({
    workspaceId,
    userId: user.id,
    role,
  }).onConflictDoUpdate({
    target: [schema.workspaceMembers.workspaceId, schema.workspaceMembers.userId],
    set: { role },
  })

  return mapUser(user)
}

export async function updateWorkspaceMemberRole(db: Database, workspaceId: string, userId: string, role: WorkspaceRole) {
  await db.update(schema.workspaceMembers).set({ role }).where(
    and(eq(schema.workspaceMembers.workspaceId, workspaceId), eq(schema.workspaceMembers.userId, userId))
  )
}

export async function createInvite(db: Database, workspaceId: string, createdBy: string, role: WorkspaceRole, email?: string) {
  const token = createToken(20)
  const inviteId = createId("invite")
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await db.insert(schema.invites).values({
    id: inviteId,
    workspaceId,
    createdBy,
    role,
    email,
    tokenHash: hashToken(token),
    expiresAt,
  })
  return { inviteId, token, expiresAt }
}

export async function acceptInvite(
  db: Database,
  token: string,
  username: string,
  password: string,
  displayName: string,
  email?: string
): Promise<InviteAcceptanceResult> {
  const invite = await db.query.invites.findFirst({
    where: and(eq(schema.invites.tokenHash, hashToken(token)), isNull(schema.invites.acceptedAt), gt(schema.invites.expiresAt, new Date())),
  })
  if (!invite) return { status: "invalid" }

  const userId = createId("user")
  const passwordHash = await hashPassword(password)

  try {
    await db.transaction(async (tx) => {
      await tx.insert(schema.users).values({
        id: userId,
        username,
        displayName,
        email,
        passwordHash,
      })
      await tx.insert(schema.workspaceMembers).values({
        workspaceId: invite.workspaceId,
        userId,
        role: invite.role,
      }).onConflictDoNothing()
      await tx.update(schema.invites).set({
        acceptedAt: new Date(),
        acceptedBy: userId,
      }).where(eq(schema.invites.id, invite.id))
      await tx.insert(schema.auditEvents).values({
        id: createId("audit"),
        workspaceId: invite.workspaceId,
        userId,
        action: "invite.accepted",
        details: { role: invite.role },
      })
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return getInviteDuplicateResult(error)
    }
    throw error
  }

  return {
    status: "accepted",
    user: {
      id: userId,
      username,
      displayName,
      email,
    },
  }
}

export async function getInviteByToken(db: Database, token: string) {
  const rows = await db
    .select({
      id: schema.invites.id,
      role: schema.invites.role,
      workspaceId: schema.workspaces.id,
      workspaceName: schema.workspaces.name,
      expiresAt: schema.invites.expiresAt,
    })
    .from(schema.invites)
    .innerJoin(schema.workspaces, eq(schema.invites.workspaceId, schema.workspaces.id))
    .where(and(eq(schema.invites.tokenHash, hashToken(token)), isNull(schema.invites.acceptedAt), gt(schema.invites.expiresAt, new Date())))
    .limit(1)

  return rows[0] ?? null
}

export async function getDocumentEnvelope(db: Database, workspaceId: string) {
  const rows = await db
    .select({
      version: schema.placementDocuments.version,
      updatedAt: schema.placementDocuments.updatedAt,
      updatedByName: schema.users.displayName,
      document: schema.placementDocuments.document,
    })
    .from(schema.placementDocuments)
    .leftJoin(schema.users, eq(schema.placementDocuments.updatedBy, schema.users.id))
    .where(eq(schema.placementDocuments.workspaceId, workspaceId))
    .limit(1)

  const row = rows[0]
  if (!row) return null

  return {
    version: row.version,
    updatedAt: row.updatedAt.toISOString(),
    updatedBy: row.updatedByName ?? undefined,
    document: normalizeCollaborativeState(row.document),
  }
}

export async function saveDocument(
  db: Database,
  workspaceId: string,
  user: AuthUser,
  version: number,
  document: CollaborativePlacementState,
  auditAction = "document.saved"
) {
  const existing = await db.query.placementDocuments.findFirst({
    where: eq(schema.placementDocuments.workspaceId, workspaceId),
  })
  if (!existing) {
    throw new Error("Document not found.")
  }
  if (existing.version !== version) {
    return { conflict: true as const, currentVersion: existing.version }
  }

  const now = new Date()
  const nextVersion = version + 1
  const normalized = normalizeCollaborativeState(document)

  return db.transaction(async (tx) => {
    const updatedRows = await tx.update(schema.placementDocuments).set({
      version: nextVersion,
      document: normalized,
      updatedAt: now,
      updatedBy: user.id,
    }).where(
      and(
        eq(schema.placementDocuments.workspaceId, workspaceId),
        eq(schema.placementDocuments.version, version)
      )
    ).returning({
      version: schema.placementDocuments.version,
    })

    if (updatedRows.length === 0) {
      const current = await tx.query.placementDocuments.findFirst({
        where: eq(schema.placementDocuments.workspaceId, workspaceId),
      })
      if (!current) {
        throw new Error("Document not found.")
      }
      return { conflict: true as const, currentVersion: current.version }
    }

    await tx.update(schema.workspaces).set({
      updatedAt: now,
      updatedBy: user.id,
    }).where(eq(schema.workspaces.id, workspaceId))
    await tx.insert(schema.auditEvents).values({
      id: createId("audit"),
      workspaceId,
      userId: user.id,
      action: auditAction,
      details: { version: nextVersion },
    })

    return {
      conflict: false as const,
      version: nextVersion,
      updatedAt: now.toISOString(),
      updatedBy: user.displayName,
      document: normalized,
    }
  })
}

export async function runAutoPlace(db: Database, workspaceId: string, user: AuthUser, version: number) {
  const envelope = await getDocumentEnvelope(db, workspaceId)
  if (!envelope) throw new Error("Document not found.")
  if (envelope.version !== version) {
    return { conflict: true as const, currentVersion: envelope.version }
  }

  const nextDocument = reduceCollaborativeState(envelope.document, { type: "AUTO_PLACE" })
  return saveDocument(db, workspaceId, user, version, nextDocument, "document.auto_placed")
}

export async function getLockStatus(db: Database, workspaceId: string, currentUserId: string): Promise<EditLockStatus> {
  const rows = await db
    .select({
      workspaceId: schema.editLocks.workspaceId,
      userId: schema.editLocks.userId,
      expiresAt: schema.editLocks.expiresAt,
      displayName: schema.users.displayName,
    })
    .from(schema.editLocks)
    .leftJoin(schema.users, eq(schema.editLocks.userId, schema.users.id))
    .where(eq(schema.editLocks.workspaceId, workspaceId))
    .limit(1)

  const row = rows[0]
  const now = Date.now()
  const isActive = row != null && row.expiresAt.getTime() > now

  return {
    workspaceId,
    locked: isActive,
    holderUserId: isActive ? row.userId : undefined,
    holderDisplayName: isActive ? row.displayName ?? undefined : undefined,
    expiresAt: isActive ? row.expiresAt.toISOString() : undefined,
    isCurrentUserHolder: Boolean(isActive && row.userId === currentUserId),
    canTakeOver: !isActive || row.userId !== currentUserId,
  }
}

export async function acquireLock(db: Database, workspaceId: string, user: AuthUser) {
  const now = Date.now()
  const expiresAt = new Date(now + LOCK_TTL_MS)
  const result = await db.execute(sql`
    INSERT INTO edit_locks (workspace_id, user_id, expires_at, acquired_at)
    VALUES (${workspaceId}, ${user.id}, ${expiresAt}, ${new Date(now)})
    ON CONFLICT (workspace_id) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          expires_at = EXCLUDED.expires_at,
          acquired_at = EXCLUDED.acquired_at
      WHERE edit_locks.user_id = EXCLUDED.user_id
         OR edit_locks.expires_at <= NOW()
    RETURNING workspace_id
  `)

  if (result.rows.length === 0) {
    return null
  }

  return getLockStatus(db, workspaceId, user.id)
}

export async function heartbeatLock(db: Database, workspaceId: string, userId: string) {
  const current = await getLockStatus(db, workspaceId, userId)
  if (!current.isCurrentUserHolder) return null

  const expiresAt = new Date(Date.now() + LOCK_TTL_MS)
  await db.update(schema.editLocks).set({ expiresAt }).where(
    and(eq(schema.editLocks.workspaceId, workspaceId), eq(schema.editLocks.userId, userId))
  )

  return getLockStatus(db, workspaceId, userId)
}

export async function releaseLock(db: Database, workspaceId: string, userId: string) {
  await db.delete(schema.editLocks).where(
    and(eq(schema.editLocks.workspaceId, workspaceId), eq(schema.editLocks.userId, userId))
  )
}

export async function takeoverLock(db: Database, workspaceId: string, user: AuthUser) {
  const expiresAt = new Date(Date.now() + LOCK_TTL_MS)
  await db.execute(sql`
    INSERT INTO edit_locks (workspace_id, user_id, expires_at, acquired_at)
    VALUES (${workspaceId}, ${user.id}, ${expiresAt}, ${new Date()})
    ON CONFLICT (workspace_id) DO UPDATE
      SET user_id = EXCLUDED.user_id,
          expires_at = EXCLUDED.expires_at,
          acquired_at = EXCLUDED.acquired_at
  `)

  return getLockStatus(db, workspaceId, user.id)
}

export async function listAuditEvents(db: Database, workspaceId: string) {
  const rows = await db
    .select({
      id: schema.auditEvents.id,
      action: schema.auditEvents.action,
      details: schema.auditEvents.details,
      createdAt: schema.auditEvents.createdAt,
      displayName: schema.users.displayName,
    })
    .from(schema.auditEvents)
    .leftJoin(schema.users, eq(schema.auditEvents.userId, schema.users.id))
    .where(eq(schema.auditEvents.workspaceId, workspaceId))
    .orderBy(desc(schema.auditEvents.createdAt))

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    details: row.details,
    createdAt: row.createdAt.toISOString(),
    displayName: row.displayName ?? "Unknown user",
  }))
}
