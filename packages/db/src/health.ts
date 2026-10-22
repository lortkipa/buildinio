import type { DatabaseStatus } from "@buildinio/shared";
import { sql } from "drizzle-orm";
import type { Database } from "./client";

/** Runs a trivial query and reports whether the database answered. */
export async function checkDatabase(db: Database): Promise<DatabaseStatus> {
  const started = performance.now();
  try {
    const [row] = await db.execute<{ version: string }>(sql`select version() as version`);
    return {
      status: "ok",
      latencyMs: Math.round(performance.now() - started),
      version: row?.version,
    };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Math.round(performance.now() - started),
      error: describeError(error),
    };
  }
}

// Drizzle wraps driver errors in "Failed query: ..."; the cause says what went wrong.
function describeError(error: unknown): string {
  const cause = error instanceof Error && error.cause !== undefined ? error.cause : error;
  if (cause instanceof Error) {
    const code = "code" in cause ? String(cause.code) : undefined;
    return cause.message || code || cause.name;
  }
  return String(cause);
}
