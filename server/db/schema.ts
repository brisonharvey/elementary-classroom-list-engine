import { relations, sql } from "drizzle-orm"
import { integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { CollaborativePlacementState, WorkspaceRole } from "../../src/shared/collaboration"

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull(),
  displayName: text("display_name").notNull(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  usernameUnique: uniqueIndex("users_username_unique").on(table.username),
  emailUnique: uniqueIndex("users_email_unique").on(table.email),
}))

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, (table) => ({
  tokenHashUnique: uniqueIndex("sessions_token_hash_unique").on(table.tokenHash),
}))

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
})

export const workspaceMembers = pgTable("workspace_members", {
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").$type<WorkspaceRole>().notNull(),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  workspaceUserUnique: uniqueIndex("workspace_members_workspace_user_unique").on(table.workspaceId, table.userId),
}))

export const placementDocuments = pgTable("placement_documents", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  version: integer("version").notNull().default(1),
  document: jsonb("document").$type<CollaborativePlacementState>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  updatedBy: text("updated_by").references(() => users.id, { onDelete: "set null" }),
})

export const editLocks = pgTable("edit_locks", {
  workspaceId: text("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  acquiredAt: timestamp("acquired_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
})

export const auditEvents = pgTable("audit_events", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  details: jsonb("details").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
})

export const invites = pgTable("invites", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  createdBy: text("created_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").$type<WorkspaceRole>().notNull(),
  tokenHash: text("token_hash").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedBy: text("accepted_by").references(() => users.id, { onDelete: "set null" }),
}, (table) => ({
  inviteTokenUnique: uniqueIndex("invites_token_hash_unique").on(table.tokenHash),
}))

export const userRelations = relations(users, ({ many }) => ({
  memberships: many(workspaceMembers),
}))

export const workspaceRelations = relations(workspaces, ({ many, one }) => ({
  members: many(workspaceMembers),
  document: one(placementDocuments, {
    fields: [workspaces.id],
    references: [placementDocuments.workspaceId],
  }),
}))
