// Drizzle table definitions. After changing them, run `pnpm db:generate` and `pnpm db:migrate`.
import { boolean, index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Points in time, stored with their time zone (timestamptz).
const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

// --- Auth: Better Auth's core tables (apps/api/src/auth.ts) ---
// Better Auth addresses fields by these property names; the columns are snake_case. It generates
// the ids, and `updatedAt` is set on every update.

// One per person, keyed by email: every way of signing in with the same email reaches this row.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  // Google's or GitHub's picture when the account was created that way, else the default avatar.
  image: text("image"),
  // Set once the user has confirmed their name on /welcome, so the name is asked only once.
  onboarded: boolean("onboarded").notNull().default(false),
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamptz("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

// A way of signing in (Google, GitHub, email) linked to a user.
export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamptz("access_token_expires_at"),
    refreshTokenExpiresAt: timestamptz("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

// Short-lived values such as OAuth state and email sign-in codes.
export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    createdAt: timestamptz("created_at").notNull().defaultNow(),
    updatedAt: timestamptz("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

// --- Limits (packages/db/src/rate-limit.ts) ---

// How many times something happened in the current window, per key, e.g. codes sent to one email
// in the last hour. A row's window starts over on the first hit after `resetAt`. Not named
// rateLimit, which is the name of Better Auth's own (unused) model.
export const rateLimitCounter = pgTable(
  "rate_limit_counter",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    resetAt: timestamptz("reset_at").notNull(),
  },
  (table) => [index("rate_limit_counter_reset_at_idx").on(table.resetAt)],
);
