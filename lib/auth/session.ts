import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { and, eq, gt, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users } from "@/lib/db/schema";
import type { Appearance } from "@/lib/settings";

export const SESSION_COOKIE = "session";
const SESSION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export type CurrentUser = Appearance & {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
};

/** A random token for a cookie. Only its hash is stored, so a leaked database can't log anyone in. */
export function newToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  } as const;
}

/** The user a session cookie belongs to, or null if it's missing or expired. */
export function getSessionUser(token: string | undefined): CurrentUser | null {
  if (!token) return null;
  const user = db
    .select({ id: users.id, name: users.name, email: users.email, avatarUrl: users.avatarUrl, theme: users.theme, reducedMotion: users.reducedMotion })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, new Date())))
    .get();
  return user ?? null;
}

/** The signed-in user, or null. Reads the request, so render it inside <Suspense>. */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  await connection(); // The expiry check reads the clock: only at request time, never while prerendering.
  return getSessionUser(store.get(SESSION_COOKIE)?.value);
});

/** Logs the user in by setting the session cookie. Only in Server Actions and Route Handlers. */
export async function createSession(userId: string) {
  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_MS);
  db.delete(sessions).where(lt(sessions.expiresAt, new Date())).run(); // Tidy up old ones.
  db.insert(sessions).values({ id: hashToken(token), userId, expiresAt }).run();
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions(expiresAt));
  forgetCachedPages();
}

/** Logs out: forgets the session and clears the cookie. */
export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) db.delete(sessions).where(eq(sessions.id, hashToken(token))).run();
  store.delete(SESSION_COOKIE);
  forgetCachedPages();
}

/**
 * Who's signed in changed, so pages the browser kept (like /signup sending a
 * signed-in user home) are out of date. This drops them all.
 */
function forgetCachedPages() {
  revalidatePath("/", "layout");
}
