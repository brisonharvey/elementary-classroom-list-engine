import fs from "node:fs/promises"
import path from "node:path"
import type { Pool } from "pg"

export async function runMigrations(pool: Pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)

  const migrationsDir = path.resolve(process.cwd(), "server/db/migrations")
  const entries = await fs.readdir(migrationsDir)
  const sqlFiles = entries.filter((entry) => entry.endsWith(".sql")).sort()

  for (const fileName of sqlFiles) {
    const alreadyApplied = await pool.query("SELECT 1 FROM schema_migrations WHERE id = $1 LIMIT 1", [fileName])
    if (alreadyApplied.rowCount) continue

    const sql = await fs.readFile(path.join(migrationsDir, fileName), "utf8")
    await pool.query("BEGIN")
    try {
      await pool.query(sql)
      await pool.query("INSERT INTO schema_migrations (id) VALUES ($1)", [fileName])
      await pool.query("COMMIT")
    } catch (error) {
      await pool.query("ROLLBACK")
      throw error
    }
  }
}
