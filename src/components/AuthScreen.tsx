import { FormEvent, useMemo, useState } from "react"

interface AuthScreenProps {
  error?: string
  onLogin: (username: string, password: string) => Promise<void>
  onAcceptInvite: (input: {
    token: string
    username: string
    password: string
    displayName: string
    email?: string
  }) => Promise<void>
}

function getInviteTokenFromLocation(): string {
  if (typeof window === "undefined") return ""
  return new URLSearchParams(window.location.search).get("invite") ?? ""
}

export function AuthScreen({ error, onLogin, onAcceptInvite }: AuthScreenProps) {
  const initialInviteToken = useMemo(() => getInviteTokenFromLocation(), [])
  const [mode, setMode] = useState<"login" | "invite">(initialInviteToken ? "invite" : "login")
  const [submitting, setSubmitting] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")

  const [inviteToken, setInviteToken] = useState(initialInviteToken)
  const [inviteUsername, setInviteUsername] = useState("")
  const [invitePassword, setInvitePassword] = useState("")
  const [inviteDisplayName, setInviteDisplayName] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onLogin(username, password)
    } finally {
      setSubmitting(false)
    }
  }

  const submitInvite = async (event: FormEvent) => {
    event.preventDefault()
    setSubmitting(true)
    try {
      await onAcceptInvite({
        token: inviteToken,
        username: inviteUsername,
        password: invitePassword,
        displayName: inviteDisplayName,
        email: inviteEmail || undefined,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Classroom Placement Engine</h1>
          <p>Sign in to a shared workspace or accept an invite to collaborate on roster planning.</p>
        </div>

        <div className="auth-mode-row">
          <button className={`btn btn-sm ${mode === "login" ? "btn-primary" : "btn-ghost"}`} onClick={() => setMode("login")}>
            Sign In
          </button>
          <button className={`btn btn-sm ${mode === "invite" ? "btn-primary" : "btn-ghost"}`} onClick={() => setMode("invite")}>
            Accept Invite
          </button>
        </div>

        {error ? <div className="auth-error">{error}</div> : null}

        {mode === "login" ? (
          <form className="auth-form" onSubmit={submitLogin}>
            <label className="auth-field">
              <span>Username</span>
              <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Signing In..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={submitInvite}>
            <label className="auth-field">
              <span>Invite Token</span>
              <input value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Display Name</span>
              <input value={inviteDisplayName} onChange={(event) => setInviteDisplayName(event.target.value)} />
            </label>
            <label className="auth-field">
              <span>Username</span>
              <input value={inviteUsername} onChange={(event) => setInviteUsername(event.target.value)} autoComplete="username" />
            </label>
            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                value={invitePassword}
                onChange={(event) => setInvitePassword(event.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="auth-field">
              <span>Email (optional)</span>
              <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} autoComplete="email" />
            </label>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Joining..." : "Create Account from Invite"}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
