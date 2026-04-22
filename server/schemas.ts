import { z } from "zod"

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  username: z.string().min(3),
  password: z.string().min(8),
  displayName: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
})

export const createWorkspaceSchema = z.object({
  name: z.string().min(1).max(120),
})

export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(120),
})

export const addMemberSchema = z.object({
  identifier: z.string().min(1),
  role: z.enum(["owner", "editor", "viewer"]),
})

export const updateMemberSchema = z.object({
  role: z.enum(["owner", "editor", "viewer"]),
})

export const createInviteSchema = z.object({
  workspaceId: z.string().min(1),
  role: z.enum(["owner", "editor", "viewer"]),
  email: z.string().email().optional().or(z.literal("")),
})

export const saveDocumentSchema = z.object({
  version: z.number().int().positive(),
  document: z.record(z.string(), z.unknown()),
})

export const autoPlaceSchema = z.object({
  version: z.number().int().positive(),
})
