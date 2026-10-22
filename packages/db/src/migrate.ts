import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Applies the migrations in `migrationsFolder` (this package's `migrations/`) that the database
 * doesn't have yet. Used by the production API on start; in development, run `pnpm db:migrate`.
 */
export async function migrateDatabase(url: string, migrationsFolder: string) {
  // One connection, closed afterwards. onnotice: hides Postgres's "already exists, skipping" notices.
  const client = postgres(url, { max: 1, connect_timeout: 5, onnotice: () => {} });
  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}
