import {
  AuthUser,
  CollaborativePlacementState,
  DocumentEnvelope,
  EditLockStatus,
  InviteRecord,
  WorkspaceMember,
  WorkspaceSummary,
  WorkspaceRole,
} from "../shared/collaboration"

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || ""

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}))
    const error = new Error(typeof payload.error === "string" ? payload.error : `${response.status} ${response.statusText}`) as Error & {
      status?: number
      payload?: unknown
    }
    error.status = response.status
    error.payload = payload
    throw error
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export interface AcceptInviteInput {
  token: string
  username: string
  password: string
  displayName: string
  email?: string
}

export interface AuditEvent {
  id: string
  action: string
  details: Record<string, unknown>
  createdAt: string
  displayName: string
}

export const api = {
  getMe: () => request<{ user: AuthUser }>("/api/auth/me"),
  login: (username: string, password: string) =>
    request<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  getInvite: (token: string) =>
    request<Omit<InviteRecord, "token" | "createdAt">>(`/api/invites/${token}`),
  acceptInvite: (input: AcceptInviteInput) =>
    request<{ user: AuthUser }>("/api/invites/accept", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  listWorkspaces: () => request<{ workspaces: WorkspaceSummary[] }>("/api/workspaces"),
  createWorkspace: (name: string) =>
    request<{ workspace: WorkspaceSummary }>("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  getWorkspace: (workspaceId: string) =>
    request<{ workspace: WorkspaceSummary }>(`/api/workspaces/${workspaceId}`),
  renameWorkspace: (workspaceId: string, name: string) =>
    request<{ workspace: WorkspaceSummary }>(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  listMembers: (workspaceId: string) =>
    request<{ members: WorkspaceMember[] }>(`/api/workspaces/${workspaceId}/members`),
  addMember: (workspaceId: string, identifier: string, role: WorkspaceRole) =>
    request<{ members: WorkspaceMember[] }>(`/api/workspaces/${workspaceId}/members`, {
      method: "POST",
      body: JSON.stringify({ identifier, role }),
    }),
  updateMemberRole: (workspaceId: string, userId: string, role: WorkspaceRole) =>
    request<{ members: WorkspaceMember[] }>(`/api/workspaces/${workspaceId}/members/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ role }),
    }),
  getDocument: (workspaceId: string) =>
    request<DocumentEnvelope<CollaborativePlacementState>>(`/api/workspaces/${workspaceId}/document`),
  saveDocument: (workspaceId: string, version: number, document: CollaborativePlacementState) =>
    request<DocumentEnvelope<CollaborativePlacementState>>(`/api/workspaces/${workspaceId}/document`, {
      method: "PUT",
      body: JSON.stringify({ version, document }),
    }),
  autoPlace: (workspaceId: string, version: number) =>
    request<DocumentEnvelope<CollaborativePlacementState>>(`/api/workspaces/${workspaceId}/auto-place`, {
      method: "POST",
      body: JSON.stringify({ version }),
    }),
  getLock: (workspaceId: string) =>
    request<EditLockStatus>(`/api/workspaces/${workspaceId}/lock`),
  acquireLock: (workspaceId: string) =>
    request<EditLockStatus>(`/api/workspaces/${workspaceId}/lock/acquire`, { method: "POST" }),
  heartbeatLock: (workspaceId: string) =>
    request<EditLockStatus>(`/api/workspaces/${workspaceId}/lock/heartbeat`, { method: "POST" }),
  releaseLock: (workspaceId: string) =>
    request<{ ok: boolean }>(`/api/workspaces/${workspaceId}/lock/release`, { method: "POST" }),
  takeoverLock: (workspaceId: string) =>
    request<EditLockStatus>(`/api/workspaces/${workspaceId}/lock/takeover`, { method: "POST" }),
  listAudit: (workspaceId: string) =>
    request<{ events: AuditEvent[] }>(`/api/workspaces/${workspaceId}/audit`),
  createInvite: (workspaceId: string, role: WorkspaceRole, email?: string) =>
    request<InviteRecord>("/api/invites", {
      method: "POST",
      body: JSON.stringify({ workspaceId, role, email }),
    }),
}
