import type { FastifyRequest } from "fastify"
import type { NodePgDatabase } from "drizzle-orm/node-postgres"
import type * as schema from "./db/schema"
import type { Pool } from "pg"
import type { AuthUser, WorkspaceRole } from "../src/shared/collaboration"

export type Database = NodePgDatabase<typeof schema>

export interface ServerServices {
  db: Database
  pool: Pool
}

export interface AuthenticatedRequest extends FastifyRequest {
  authUser: AuthUser
}

export type MemberRole = WorkspaceRole

declare module "fastify" {
  interface FastifyInstance {
    services: ServerServices
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>
    requireWorkspaceRole: (
      request: FastifyRequest,
      reply: FastifyReply,
      workspaceId: string,
      roles: WorkspaceRole[]
    ) => Promise<WorkspaceRole | null>
  }

  interface FastifyRequest {
    authUser?: AuthUser
  }
}
