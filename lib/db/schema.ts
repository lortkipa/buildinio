import { blob, index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Theme } from "@/lib/settings";
import type { ProjectColor, ProjectIcon } from "@/lib/projects/options";
import type { Feedback } from "@/lib/projects/types";

// After changing this file, run `npm run db:generate` to add a migration.

export type Provider = "google" | "github";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(), // Always lowercase.
  name: text("name").notNull(),
  avatarUrl: text("avatar_url").notNull(),
  theme: text("theme").$type<Theme>().notNull().default("system"),
  reducedMotion: integer("reduced_motion", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

/** Uploaded photos are decoded and resized to WebP before being stored. */
export const userPhotos = sqliteTable("user_photos", {
  userId: text("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  data: blob("data", { mode: "buffer" }).notNull(),
});

/** A Google or GitHub account linked to a user. Email sign-ins need no row here. */
export const accounts = sqliteTable(
  "accounts",
  {
    provider: text("provider").$type<Provider>().notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
    index("accounts_user_id_idx").on(table.userId),
  ],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(), // SHA-256 of the token in the cookie.
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("sessions_user_id_idx").on(table.userId)],
);

/** The latest code sent to each email, plus how many were sent recently. */
export const emailCodes = sqliteTable("email_codes", {
  email: text("email").primaryKey(),
  codeHash: text("code_hash"), // Null once the code has been tried.
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  sentCount: integer("sent_count").notNull(),
  windowStartedAt: integer("window_started_at", { mode: "timestamp_ms" }).notNull(),
});

/** Someone who signed in for the first time and still has to pick a name. */
export const pendingSignups = sqliteTable("pending_signups", {
  id: text("id").primaryKey(), // SHA-256 of the token in the cookie.
  email: text("email").notNull(),
  name: text("name").notNull(), // Suggested name: from Google or GitHub, empty for email.
  avatarUrl: text("avatar_url").notNull(),
  provider: text("provider").$type<Provider>(), // Null for email.
  providerAccountId: text("provider_account_id"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

/** An app someone is building. Its code lives on disk (see lib/sandbox/workspace.ts). */
export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(), // Random and long: the preview's address relies on it.
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name"), // Null until the AI names it.
    icon: text("icon").$type<ProjectIcon>().notNull(),
    color: text("color").$type<ProjectColor>().notNull(),
    ready: integer("ready", { mode: "boolean" }).notNull().default(false), // Built, and the preview not seen yet.
    appVersion: integer("app_version").notNull().default(0), // Goes up with every build; 0 until the first.
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("projects_user_id_idx").on(table.userId)],
);

export const messages = sqliteTable(
  "messages",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    role: text("role").$type<"user" | "assistant">().notNull(),
    text: text("text").notNull(),
    seconds: integer("seconds"), // How long the answer took. Null for prompts.
    feedback: text("feedback").$type<Feedback>(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("messages_project_id_idx").on(table.projectId, table.createdAt)],
);
