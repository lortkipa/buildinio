import { lt, sql } from "drizzle-orm";
import type { Database } from "./client";
import { rateLimitCounter } from "./schema";

export type RateLimitRule = { max: number; windowSeconds: number };

/**
 * Counts one hit for `key` and says whether it is within `max` hits per window. The window starts
 * at the first hit and lasts `windowSeconds`; the first hit after it ends starts a new one. One
 * statement, so concurrent hits are all counted, and times come from the database clock.
 * Blocked hits count too, but don't make the window longer.
 */
export async function hitRateLimit(
  db: Database,
  key: string,
  { max, windowSeconds }: RateLimitRule,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const newWindowEnd = sql`now() + make_interval(secs => ${windowSeconds})`;
  const expired = sql`${rateLimitCounter.resetAt} <= now()`;
  const [row] = await db
    .insert(rateLimitCounter)
    .values({ key, count: 1, resetAt: newWindowEnd })
    .onConflictDoUpdate({
      target: rateLimitCounter.key,
      set: {
        count: sql`case when ${expired} then 1 else ${rateLimitCounter.count} + 1 end`,
        resetAt: sql`case when ${expired} then ${newWindowEnd} else ${rateLimitCounter.resetAt} end`,
      },
    })
    .returning({
      count: rateLimitCounter.count,
      retryAfterSeconds: sql<number>`ceil(extract(epoch from ${rateLimitCounter.resetAt} - now()))::int`,
    });
  if (!row) throw new Error(`Couldn't count a hit for the rate limit ${key}.`);
  return { allowed: row.count <= max, retryAfterSeconds: Math.max(1, row.retryAfterSeconds) };
}

/** Deletes the counters whose window is over. Their next hit would start a new window anyway. */
export async function deleteExpiredRateLimits(db: Database) {
  await db.delete(rateLimitCounter).where(lt(rateLimitCounter.resetAt, sql`now()`));
}
