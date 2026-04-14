import { FormEvent, useState } from "react"
import { AuditEvent } from "../lib/api"
import { WorkspaceMember, WorkspaceRole, WorkspaceSummary, EditLockStatus, AuthUser } from "../shared/collaboration"

interface WorkspaceManagerProps {
  user: AuthUser
  workspaces: WorkspaceSummary[]
  activeWorkspaceId?: string
  activeWorkspaceRole?: WorkspaceRole
  lockStatus: EditLockStatus | null
  members: WorkspaceMember[]
  auditEvents: AuditEvent[]
  inviteToken?: string
  onSelectWorkspace: (workspaceId: string) => Promise<void>
  onCreateWorkspace: (name: string) => Promise<void>
  onLogout: () => Promise<void>
  onAcquireLock: () => Promise<void>
  onReleaseLock: () => Promise<void>
  onTakeoverLock: () => Promise<void>
  onCreateInvite: (role: WorkspaceRole, email?: string) => Promise<void>
  onAddMember: (identifier: string, role: WorkspaceRole) => Promise<void>
  onUpdateMemberRole: (userId: string, role: WorkspaceRole) => Promise<void>
}

export function WorkspaceManager({
  user,
  workspaces,
  activeWorkspaceId,
  activeWorkspaceRole,
  lockStatus,
  members,
  auditEvents,
  inviteToken,
  onSelectWorkspace,
  onCreateWorkspace,
  onLogout,
  onAcquireLock,
  onReleaseLock,
  onTakeoverLock,
  onCreateInvite,
  onAddMember,
  onUpdateMemberRole,
}: WorkspaceManagerProps) {
  const [newWorkspaceName, setNewWorkspaceName] = useState("")
  const [memberIdentifier, setMemberIdentifier] = useState("")
  const [memberRole, setMemberRole] = useState<WorkspaceRole>("editor")
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("editor")
  const [inviteEmail, setInviteEmail] = useState("")

  const createWorkspace = async (event: FormEvent) => {
    event.preventDefault()
    if (!newWorkspaceName.trim()) return
    await onCreateWorkspace(newWorkspaceName.trim())
    setNewWorkspaceName("")
  }

  const addMember = async (event: FormEvent) => {
    event.preventDefault()
    if (!memberIdentifier.trim()) return
    await onAddMember(memberIdentifier.trim(), memberRole)
    setMemberIdentifier("")
  }

  const createInvite = async (event: FormEvent) => {
    event.preventDefault()
    await onCreateInvite(inviteRole, inviteEmail.trim() || undefined)
    setInviteEmail("")
  }

  return (
    <aside className="workspace-manager">
      <div className="workspace-manager-header">
        <div>
          <strong>{user.displayName}</strong>
          <div className="workspace-manager-muted">@{user.username}</div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => void onLogout()}>Logout</button>
      </div>

      <div className="workspace-section">
        <div className="workspace-section-title">Workspaces</div>
        <div className="workspace-list">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              className={`workspace-item ${workspace.id === activeWorkspaceId ? "active" : ""}`}
              onClick={() => void onSelectWorkspace(workspace.id)}
            >
              <span>{workspace.name}</span>
              <span className="workspace-item-role">{workspace.role}</span>
            </button>
          ))}
        </div>
        <form className="workspace-inline-form" onSubmit={createWorkspace}>
          <input
            value={newWorkspaceName}
            onChange={(event) => setNewWorkspaceName(event.target.value)}
            placeholder="New workspace"
          />
          <button type="submit" className="btn btn-primary btn-sm">Create</button>
        </form>
      </div>

      <div className="workspace-section">
        <div className="workspace-section-title">Edit Lock</div>
        <div className="workspace-manager-muted">
          {lockStatus?.locked
            ? lockStatus.isCurrentUserHolder
              ? `You are editing until ${lockStatus.expiresAt ? new Date(lockStatus.expiresAt).toLocaleTimeString() : ""}.`
              : `${lockStatus.holderDisplayName ?? "Another editor"} is holding the lock.`
            : "No active editor lock."}
        </div>
        <div className="workspace-lock-actions">
          <button className="btn btn-ghost btn-sm" onClick={() => void onAcquireLock()} disabled={activeWorkspaceRole === "viewer"}>
            Acquire
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => void onReleaseLock()} disabled={!lockStatus?.isCurrentUserHolder}>
            Release
          </button>
          <button className="btn btn-warning btn-sm" onClick={() => void onTakeoverLock()} disabled={activeWorkspaceRole === "viewer"}>
            Take Over
          </button>
        </div>
      </div>

      {activeWorkspaceRole === "owner" ? (
        <>
          <div className="workspace-section">
            <div className="workspace-section-title">Invite</div>
            <form className="workspace-stack-form" onSubmit={createInvite}>
              <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as WorkspaceRole)}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
                <option value="owner">Owner</option>
              </select>
              <input
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                placeholder="Email (optional)"
              />
              <button type="submit" className="btn btn-primary btn-sm">Create Invite</button>
            </form>
            {inviteToken ? <div className="workspace-token-box">{inviteToken}</div> : null}
          </div>

          <div className="workspace-section">
            <div className="workspace-section-title">Members</div>
            <form className="workspace-stack-form" onSubmit={addMember}>
              <input
                value={memberIdentifier}
                onChange={(event) => setMemberIdentifier(event.target.value)}
                placeholder="Username or email"
              />
              <select value={memberRole} onChange={(event) => setMemberRole(event.target.value as WorkspaceRole)}>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
                <option value="owner">Owner</option>
              </select>
              <button type="submit" className="btn btn-ghost btn-sm">Add Existing User</button>
            </form>
            <div className="workspace-member-list">
              {members.map((member) => (
                <div key={member.userId} className="workspace-member-item">
                  <div>
                    <strong>{member.displayName}</strong>
                    <div className="workspace-manager-muted">@{member.username}</div>
                  </div>
                  <select value={member.role} onChange={(event) => void onUpdateMemberRole(member.userId, event.target.value as WorkspaceRole)}>
                    <option value="owner">Owner</option>
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <div className="workspace-section">
        <div className="workspace-section-title">Recent Activity</div>
        <div className="workspace-audit-list">
          {auditEvents.slice(0, 8).map((event) => (
            <div key={event.id} className="workspace-audit-item">
              <strong>{event.displayName}</strong>
              <span>{event.action}</span>
              <span className="workspace-manager-muted">{new Date(event.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
