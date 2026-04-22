import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./server/db/generated",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
})
