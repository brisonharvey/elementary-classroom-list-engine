import test from "node:test"
import assert from "node:assert/strict"
import type { Pool } from "pg"
import { createServer } from "../server/app"
import type { ServerConfig } from "../server/config"
import type { Database } from "../server/types"
import type { AuthUser, EditLockStatus, WorkspaceRole } from "../src/shared/collaboration"

const testConfig: ServerConfig = {
  port: 8787,
  host: "127.0.0.1",
  appBaseUrl: "http://app.test",
  allowedOrigins: ["http://app.test"],
  databaseUrl: "postgres://test:test@localhost:5432/test",
  sessionSecret: "test-secret",
  cookieSecure: false,
  bootstrapAdminDisplayName: "Test Admin",
}

const authUser: AuthUser = {
  id: "user_1",
  username: "owner",
  displayName: "Owner User",
}

const lockHeldByUser: EditLockStatus = {
  workspaceId: "workspace_1",
  locked: true,
  holderUserId: authUser.id,
  holderDisplayName: authUser.displayName,
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  isCurrentUserHolder: true,
  canTakeOver: false,
}

function createTestServer(overrides: Parameters<typeof createServer>[0]["repositories"] = {}) {
  return createServer({
    config: testConfig,
    db: {} as Database,
    pool: { end: async () => undefined } as Pool,
    skipMigrations: true,
    repositories: {
      getSessionUser: async () => authUser,
      getWorkspaceRole: async () => "owner" satisfies WorkspaceRole,
      getLockStatus: async () => lockHeldByUser,
      saveDocument: async () => ({ conflict: false as const, version: 2, updatedAt: new Date().toISOString(), updatedBy: authUser.displayName, document: { schoolName: "", schoolYear: "", allStudents: [], teacherProfiles: [], classrooms: [], weights: { academic: 50, behavioral: 50, demographic: 50, tagSupportLoad: 50 }, snapshots: [], relationshipRules: [], gradeSettings: {} } }),
      acceptInvite: async () => ({ status: "invalid" as const }),
      createSession: async () => ({ token: "session-token", expiresAt: new Date(Date.now() + 86_400_000) }),
      ...overrides,
    },
  })
}

test("mutating API requests reject untrusted origins", async () => {
  const app = await createTestServer()

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/auth/logout",
      headers: {
        origin: "http://evil.test",
      },
    })

    assert.equal(response.statusCode, 403)
    assert.match(response.json().error, /trusted origin/i)
  } finally {
    await app.close()
  }
})

test("invite acceptance returns 409 for duplicate signup fields", async () => {
  const app = await createTestServer({
    acceptInvite: async () => ({
      status: "duplicate",
      field: "username",
      message: "That username is already in use.",
    }),
  })

  try {
    const response = await app.inject({
      method: "POST",
      url: "/api/invites/accept",
      headers: {
        origin: "http://app.test",
        "content-type": "application/json",
      },
      payload: {
        token: "invite-token",
        username: "owner",
        password: "password123",
        displayName: "Owner User",
      },
    })

    assert.equal(response.statusCode, 409)
    const payload = response.json()
    assert.equal(payload.field, "username")
    assert.match(payload.error, /already in use/i)
  } finally {
    await app.close()
  }
})

test("document save returns 409 when the repository reports a version conflict", async () => {
  const app = await createTestServer({
    saveDocument: async () => ({
      conflict: true as const,
      currentVersion: 4,
    }),
  })

  try {
    const response = await app.inject({
      method: "PUT",
      url: "/api/workspaces/workspace_1/document",
      headers: {
        origin: "http://app.test",
        cookie: "classroom_session=session-token",
        "content-type": "application/json",
      },
      payload: {
        version: 3,
        document: {
          schoolName: "",
          schoolYear: "",
          allStudents: [],
          teacherProfiles: [],
          classrooms: [],
          weights: { academic: 50, behavioral: 50, demographic: 50, tagSupportLoad: 50 },
          snapshots: [],
          relationshipRules: [],
          gradeSettings: {},
        },
      },
    })

    assert.equal(response.statusCode, 409)
    const payload = response.json()
    assert.equal(payload.currentVersion, 4)
    assert.match(payload.error, /version conflict/i)
  } finally {
    await app.close()
  }
})
