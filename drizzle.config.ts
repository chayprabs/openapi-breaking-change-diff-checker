import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL ?? "file:./.data/openapi-diff.db";

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dialect: databaseUrl.startsWith("file:") ? "sqlite" : "postgresql",
  dbCredentials: databaseUrl.startsWith("file:") ? { url: databaseUrl } : { url: databaseUrl },
});
