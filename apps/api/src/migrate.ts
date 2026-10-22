// Applies pending database migrations, then exits. The production image runs it before the API
// starts (see the Dockerfile); in development, run `pnpm db:migrate` instead.
import { defaultDatabaseUrl, migrateDatabase } from "@buildinio/db";

const folder = process.env.MIGRATIONS_DIR;
if (!folder) throw new Error("Set MIGRATIONS_DIR to the folder with the migrations.");

await migrateDatabase(process.env.DATABASE_URL ?? defaultDatabaseUrl(), folder);
console.log("Database migrations applied.");
