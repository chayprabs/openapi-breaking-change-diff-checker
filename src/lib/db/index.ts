import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@/lib/db/schema";

type AppDatabase = LibSQLDatabase<typeof schema>;

let client: Client | null = null;
let database: AppDatabase | null = null;

function getDatabaseUrl() {
  return process.env.DATABASE_URL ?? "file:./.data/openapi-diff.db";
}

function ensureDatabaseDirectory(databaseUrl: string) {
  if (!databaseUrl.startsWith("file:")) {
    return;
  }

  const filePath = databaseUrl.slice("file:".length);

  if (!filePath || filePath === ":memory:") {
    return;
  }

  mkdirSync(dirname(filePath), { recursive: true });
}

function getClient() {
  if (!client) {
    const databaseUrl = getDatabaseUrl();
    ensureDatabaseDirectory(databaseUrl);
    client = createClient({ url: databaseUrl });
  }

  return client;
}

export function getDb() {
  if (!database) {
    database = drizzle(getClient(), { schema });
  }

  return database;
}

export const db = new Proxy({} as AppDatabase, {
  get(_target, property, receiver) {
    return Reflect.get(getDb(), property, receiver);
  },
});

export async function ensureDatabaseReady() {
  const activeClient = getClient();

  await activeClient.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      image TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  await activeClient.execute(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL
    );
  `);
  await activeClient.execute(`
    CREATE TABLE IF NOT EXISTS memberships (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      org_id TEXT NOT NULL,
      role TEXT NOT NULL
    );
  `);
  await activeClient.execute(`
    CREATE TABLE IF NOT EXISTS saved_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      org_id TEXT,
      title TEXT NOT NULL,
      tool TEXT NOT NULL,
      report_json TEXT NOT NULL,
      settings_json TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  await activeClient.execute(`
    CREATE TABLE IF NOT EXISTS team_ignore_rules (
      id TEXT PRIMARY KEY,
      org_id TEXT NOT NULL,
      rules_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `);
  await activeClient.execute(`
    CREATE TABLE IF NOT EXISTS private_share_links (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      org_id TEXT NOT NULL,
      report_id TEXT NOT NULL,
      expires_at INTEGER,
      created_at INTEGER NOT NULL
    );
  `);
  await activeClient.execute(`
    CREATE TABLE IF NOT EXISTS report_comments (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
  await activeClient.execute(`
    CREATE TABLE IF NOT EXISTS report_approvals (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      status TEXT NOT NULL,
      note TEXT,
      created_at INTEGER NOT NULL
    );
  `);
  await activeClient.execute(`
    CREATE TABLE IF NOT EXISTS feedback_events (
      id TEXT PRIMARY KEY,
      payload_json TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
  `);
}
