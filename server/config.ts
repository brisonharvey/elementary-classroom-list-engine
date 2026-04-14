export const LOCK_TTL_MS = 5 * 60 * 1000
export const LOCK_HEARTBEAT_MS = 60 * 1000

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function getServerConfig() {
  return {
    port: Number(process.env.PORT ?? 8787),
    host: process.env.HOST ?? "0.0.0.0",
    appBaseUrl: process.env.APP_BASE_URL ?? "http://127.0.0.1:8787",
    databaseUrl: requiredEnv("DATABASE_URL"),
    sessionSecret: requiredEnv("SESSION_SECRET"),
    cookieSecure: process.env.COOKIE_SECURE === "true",
    bootstrapAdminUsername: process.env.BOOTSTRAP_ADMIN_USERNAME?.trim(),
    bootstrapAdminPassword: process.env.BOOTSTRAP_ADMIN_PASSWORD?.trim(),
    bootstrapAdminDisplayName: process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME?.trim() || "Server Admin",
  }
}
