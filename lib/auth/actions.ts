"use server";

// Everything the sign-up, log-in and account UI asks the server to do.
// These are public endpoints: each one checks its own input and cookies.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { generateCodeVerifier, generateState } from "arctic";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailCodes, users } from "@/lib/db/schema";
import { CODE_MINUTES, checkEmailCode, createEmailCode } from "@/lib/auth/email-code";
import { OAUTH_COOKIES } from "@/lib/auth/oauth-cookies";
import { getOrigin } from "@/lib/auth/origin";
import { createAuthorizationURL, isConfigured, isProvider, PROVIDERS } from "@/lib/auth/providers";
import { endSession, getCurrentUser } from "@/lib/auth/session";
import {
  cancelSignup as dropSignup,
  DEFAULT_AVATAR,
  finishSignup,
  signInOrStartSignup,
} from "@/lib/auth/signup";
import { sendCodeEmail } from "@/lib/email/send";
import { removeUserProjects } from "@/lib/projects/server";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_NAME = 80;

/** Where to send someone to sign in with Google or GitHub. */
export async function startOAuth(
  provider: unknown,
  from: unknown,
): Promise<{ url: string } | { error: string }> {
  if (!isProvider(provider)) return { error: "Unknown sign-in method." };
  const { name, env } = PROVIDERS[provider];
  if (!isConfigured(provider)) {
    console.warn(`${name} sign-in isn't set up: add ${env}_CLIENT_ID and ${env}_CLIENT_SECRET to .env.local.`);
    return { error: `${name} sign-in isn’t set up yet.` };
  }

  const state = generateState();
  const codeVerifier = generateCodeVerifier();
  const url = createAuthorizationURL(provider, await getOrigin(), state, codeVerifier);

  // Checked in the callback (app/api/auth/[provider]/callback/route.ts).
  const store = await cookies();
  const options = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  } as const;
  store.set(OAUTH_COOKIES.state, state, options);
  store.set(OAUTH_COOKIES.codeVerifier, codeVerifier, options);
  store.set(OAUTH_COOKIES.from, from === "login" ? "login" : "signup", options);
  return { url: url.toString() };
}

export type SendCodeResult = { ok: true; warning?: string } | { ok: false; error: string };

export async function sendEmailCode(email: unknown): Promise<SendCodeResult> {
  const value = typeof email === "string" ? email.trim().toLowerCase() : "";
  if (!EMAIL.test(value) || value.length > 254) return { ok: false, error: "Enter a valid email." };

  const code = createEmailCode(value);
  if (!code) {
    return { ok: false, error: "Too many codes for this email. Try again in an hour." };
  }

  switch (await sendCodeEmail(value, code, CODE_MINUTES)) {
    case "sent":
      return { ok: true };
    case "not-configured":
      return {
        ok: true,
        warning: "Email isn’t set up, so the code was printed in the server console.",
      };
    case "failed":
      return { ok: false, error: "We couldn’t send the email. Try again in a moment." };
  }
}

/**
 * Checks the emailed code. Logs in and goes home if the email has an
 * account; otherwise returns "new" so the name step can finish the sign-up.
 */
export async function verifyEmailCode(
  email: unknown,
  code: unknown,
): Promise<{ status: "wrong" | "expired" | "new" }> {
  const value = typeof email === "string" ? email.trim().toLowerCase() : "";
  const status = checkEmailCode(value, typeof code === "string" ? code : "");
  if (status !== "ok") return { status };

  const result = await signInOrStartSignup({
    email: value,
    name: "",
    avatarUrl: DEFAULT_AVATAR,
    provider: null,
    providerAccountId: null,
  });
  if (result === "signed-in") redirect("/");
  return { status: "new" };
}

/**
 * Creates the account with the chosen name, logs in and goes home.
 * `expired` means the sign-up has to start over.
 */
export async function completeSignup(name: unknown): Promise<{ error: string; expired: boolean }> {
  const value = typeof name === "string" ? name.trim().replace(/\s+/g, " ") : "";
  if (!value) return { error: "Enter your name.", expired: false };
  if (value.length > MAX_NAME) {
    return { error: `Keep your name under ${MAX_NAME} characters.`, expired: false };
  }

  if (!(await finishSignup(value))) {
    return { error: "Your sign-up timed out. Please start again.", expired: true };
  }
  redirect("/");
}

export async function cancelSignup() {
  await dropSignup();
}

export async function logOut() {
  await endSession();
}

/** Deletes the signed-in user's account, linked logins, sessions and projects, then logs out. */
export async function deleteAccount() {
  const user = await getCurrentUser();
  if (user) {
    await removeUserProjects(user.id); // Their code, on disk.
    db.delete(users).where(eq(users.id, user.id)).run(); // Accounts, sessions, projects and chats go with it.
    db.delete(emailCodes).where(eq(emailCodes.email, user.email)).run();
  }
  await endSession();
}
