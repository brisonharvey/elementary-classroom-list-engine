export const LOCK_TTL_MS = 5 * 60 * 1000
export const LOCK_HEARTBEAT_MS = 60 * 1000

export interface ServerConfig {
  port: number
  host: string
  appBaseUrl: string
  allowedOrigins: string[]
  databaseUrl: string
  sessionSecret: string
  cookieSecure: boolean
  bootstrapAdminUsername?: string
  bootstrapAdminPassword?: string
  bootstrapAdminDisplayName: string
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

function parseAllowedOrigins(appBaseUrl: string): string[] {
  const configuredOrigins = (process.env.APP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  const fallbackOrigins = [
    appBaseUrl,
    "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:4173",
    "http://localhost:4173",
  ]

  return Array.from(new Set([...configuredOrigins, ...fallbackOrigins]))
}

export function getServerConfig(): ServerConfig {
  const appBaseUrl = process.env.APP_BASE_URL ?? "http://127.0.0.1:8787"

  return {
    port: Number(process.env.PORT ?? 8787),
    host: process.env.HOST ?? "0.0.0.0",
    appBaseUrl,
    allowedOrigins: parseAllowedOrigins(appBaseUrl),
    databaseUrl: requiredEnv("DATABASE_URL"),
    sessionSecret: requiredEnv("SESSION_SECRET"),
    cookieSecure: process.env.COOKIE_SECURE === "true",
    bootstrapAdminUsername: process.env.BOOTSTRAP_ADMIN_USERNAME?.trim(),
    bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim(),
    bootstrapAdminDisplayName: process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME?.trim() || "Server Admin",
  }
}
