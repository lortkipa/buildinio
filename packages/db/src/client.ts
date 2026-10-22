import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/** Matches the dev database in compose.yaml. */
export const DEFAULT_DATABASE_URL = "postgres://buildinio:buildinio@localhost:5432/buildinio";

export function createDb(url: string = DEFAULT_DATABASE_URL) {
  const client = postgres(url, { max: 10, connect_timeout: 5 });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;
