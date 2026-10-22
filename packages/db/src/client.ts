import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Matches the dev database in compose.yaml, published on DB_PORT (default 5432).
 * A function so it reads DB_PORT after any env file has been loaded.
 */
export function defaultDatabaseUrl() {
  return `postgres://buildinio:buildinio@localhost:${process.env.DB_PORT ?? 5432}/buildinio`;
}

export function createDb(url: string = defaultDatabaseUrl()) {
  const client = postgres(url, { max: 10, connect_timeout: 5 });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
