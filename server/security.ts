import crypto from "node:crypto"
import bcrypt from "bcryptjs"

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

export function createToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex")
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}
