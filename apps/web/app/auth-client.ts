import { createAuthClient } from "better-auth/client";
import { emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";

// Calls the API's /api/auth/* (Better Auth, apps/api/src/auth.ts) on this origin, which
// next.config.ts forwards. The plugins add sign-in with an email code, and type the extra user
// fields the API adds.
export const authClient = createAuthClient({
  plugins: [
    emailOTPClient(),
    inferAdditionalFields({ user: { onboarded: { type: "boolean", required: false } } }),
  ],
});

export type Session = typeof authClient.$Infer.Session;
export type User = Session["user"];

// The client throws when the request doesn't get an answer at all (e.g. offline). Returns the
// error as Better Auth would, with status 0, so callers handle every failure the same way.
export async function settle<T extends { error: unknown }>(request: Promise<T>) {
  try {
    return await request;
  } catch {
    return { data: null, error: { status: 0, statusText: "", code: undefined } } as const;
  }
}

// No answer, or the API (or the web app's forward to it) failed.
export const isUnreachable = (error: { status: number }) =>
  error.status === 0 || error.status >= 500;

// What to tell the user then.
export const UNREACHABLE = "Couldn’t reach Buildinio. Check your connection and try again.";
