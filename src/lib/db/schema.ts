import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const memberships = sqliteTable("memberships", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
});

export const savedReports = sqliteTable("saved_reports", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  orgId: text("org_id").references(() => organizations.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  tool: text("tool").notNull(),
  reportJson: text("report_json").notNull(),
  settingsJson: text("settings_json"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const teamIgnoreRules = sqliteTable("team_ignore_rules", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  rulesJson: text("rules_json").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const privateShareLinks = sqliteTable("private_share_links", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  reportId: text("report_id")
    .notNull()
    .references(() => savedReports.id, { onDelete: "cascade" }),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const reportComments = sqliteTable("report_comments", {
  id: text("id").primaryKey(),
  reportId: text("report_id")
    .notNull()
    .references(() => savedReports.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const reportApprovals = sqliteTable("report_approvals", {
  id: text("id").primaryKey(),
  reportId: text("report_id")
    .notNull()
    .references(() => savedReports.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export const feedbackEvents = sqliteTable("feedback_events", {
  id: text("id").primaryKey(),
  payloadJson: text("payload_json").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});
