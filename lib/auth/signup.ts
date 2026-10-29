import "server-only";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { and, eq, gt, lt } from "drizzle-orm";
import { DEFAULT_AVATAR } from "@/lib/account/options";
import { db } from "@/lib/db";
import { accounts, pendingSignups, users } from "@/lib/db/schema";
import type { Provider } from "@/lib/db/schema";
import { cookieOptions, createSession, hashToken, newToken } from "@/lib/auth/session";

const SIGNUP_COOKIE = "signup";
const SIGNUP_MS = 30 * 60 * 1000; // 30 minutes to pick a name.

export type SignInProfile = {
  email: string;
  name: string; // Suggested for the name step.
  avatarUrl: string;
  provider: Provider | null; // Null for email.
  providerAccountId: string | null;
};

/**
 * Logs in if there's already an account for this Google/GitHub account or
 * email. Otherwise starts a sign-up, which finishes once a name is picked.
 */
export async function signInOrStartSignup(profile: SignInProfile): Promise<"signed-in" | "new"> {
  const email = profile.email.toLowerCase();
  const userId = findUser(email, profile);
  if (userId) {
    await createSession(userId);
    return "signed-in";
  }

  const token = newToken();
  const expiresAt = new Date(Date.now() + SIGNUP_MS);
  db.delete(pendingSignups).where(lt(pendingSignups.expiresAt, new Date())).run();
  db.insert(pendingSignups)
    .values({
      id: hashToken(token),
      email,
      name: profile.name.trim(),
      avatarUrl: profile.avatarUrl || DEFAULT_AVATAR,
      provider: profile.provider,
      providerAccountId: profile.providerAccountId,
      expiresAt,
    })
    .run();
  (await cookies()).set(SIGNUP_COOKIE, token, cookieOptions(expiresAt));
  return "new";
}

/**
 * Finds the user by their Google/GitHub account, then by email. Signing in
 * with a new provider for a known email links it, so any of them works later.
 */
function findUser(email: string, profile: SignInProfile) {
  const { provider, providerAccountId } = profile;
  if (provider && providerAccountId) {
    const account = db
      .select({ userId: accounts.userId })
      .from(accounts)
      .where(and(eq(accounts.provider, provider), eq(accounts.providerAccountId, providerAccountId)))
      .get();
    if (account) return account.userId;
  }

  const user = db.select({ id: users.id }).from(users).where(eq(users.email, email)).get();
  if (user && provider && providerAccountId) {
    db.insert(accounts)
      .values({ provider, providerAccountId, userId: user.id, createdAt: new Date() })
      .onConflictDoNothing()
      .run();
  }
  return user?.id ?? null;
}

/** The sign-up waiting for a name, if this browser has one. */
export async function getPendingSignup() {
  const token = (await cookies()).get(SIGNUP_COOKIE)?.value;
  await connection(); // The expiry check reads the clock: only at request time, never while prerendering.
  if (!token) return null;
  const pending = db
    .select()
    .from(pendingSignups)
    .where(and(eq(pendingSignups.id, hashToken(token)), gt(pendingSignups.expiresAt, new Date())))
    .get();
  return pending ?? null;
}

/** Creates the account with the chosen name and logs in. False if the sign-up expired. */
export async function finishSignup(name: string) {
  const pending = await getPendingSignup();
  if (!pending) return false;

  const userId = db.transaction((tx) => {
    // Someone may have made an account with this email in the meantime; use it.
    const existing = tx.select({ id: users.id }).from(users).where(eq(users.email, pending.email)).get();
    const id = existing?.id ?? randomUUID();
    if (!existing) {
      tx.insert(users)
        .values({ id, email: pending.email, name, avatarUrl: pending.avatarUrl, createdAt: new Date() })
        .run();
    }
    if (pending.provider && pending.providerAccountId) {
      tx.insert(accounts)
        .values({
          provider: pending.provider,
          providerAccountId: pending.providerAccountId,
          userId: id,
          createdAt: new Date(),
        })
        .onConflictDoNothing()
        .run();
    }
    tx.delete(pendingSignups).where(eq(pendingSignups.id, pending.id)).run();
    return id;
  });

  (await cookies()).delete(SIGNUP_COOKIE);
  await createSession(userId);
  return true;
}

/** Drops the sign-up waiting for a name, if any. */
export async function cancelSignup() {
  const store = await cookies();
  const token = store.get(SIGNUP_COOKIE)?.value;
  if (token) db.delete(pendingSignups).where(eq(pendingSignups.id, hashToken(token))).run();
  store.delete(SIGNUP_COOKIE);
}
