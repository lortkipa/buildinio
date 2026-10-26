import "server-only";
import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "@/lib/db/schema";

// The ignore comment stops the bundler from tracing the whole project because of this path.
const file = path.resolve(/* turbopackIgnore: true */ process.env.DATABASE_PATH || "data/buildinio.db");
mkdirSync(path.dirname(file), { recursive: true });

const sqlite = new Database(file);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
sqlite.pragma("busy_timeout = 5000");

export const db = drizzle(sqlite, { schema });

/** Brings the database up to date. Runs once when the server starts (see instrumentation.ts). */
export function migrateDatabase() {
  migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
}
