import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// After changing this file, run `npm run db:generate` to add a migration.

export type Provider = "google" | "github";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(), // Always lowercase.
  name: text("name").notNull(),
  avatarUrl: text("avatar_url").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
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
