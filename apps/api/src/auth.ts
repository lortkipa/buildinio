import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { type Database, schema } from "@buildinio/db";
import { APIError } from "better-auth/api";
// Better Auth without Kysely, which the Drizzle adapter doesn't need.
import { betterAuth } from "better-auth/minimal";
import { github as builtInGithub, type GithubOptions } from "better-auth/social-providers";

// Served by the web app from apps/web/public. Given to accounts created without a picture (email).
const DEFAULT_AVATAR = "/avatars/default.svg";

// Same limit as the name field on /welcome.
const MAX_NAME_LENGTH = 100;

/*
 * Accounts, sessions and sign-in, served under /api/auth/*. Browsers reach it through the web
 * app, which forwards /api/* here, so BETTER_AUTH_URL is the web app's origin.
 */
export function createAuth(db: Database) {
  const google = googleProvider();
  const github = githubProvider();

  return betterAuth({
    baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
    // BETTER_AUTH_SECRET is read by Better Auth. Development falls back to a default (with a
    // warning); production refuses to start without it.
    database: drizzleAdapter(db, { provider: "pg", schema }),
    // A provider that isn't listed makes sign-in fail with PROVIDER_NOT_FOUND, which the web app
    // shows as "not set up".
    socialProviders: { ...(google && { google }), ...(github && { github }) },
    account: {
      // One account per email: signing in with another provider that has the same email signs in
      // to it and links that provider. The name and picture stay those of the first sign-in.
      accountLinking: { enabled: true, trustedProviders: ["google", "github"] },
    },
    user: {
      additionalFields: {
        // Whether the user has confirmed their name on /welcome, which is asked only once.
        onboarded: { type: "boolean", required: false, defaultValue: false },
      },
      // Without a password, Better Auth only deletes with a fresh session (signed in within the
      // last day); otherwise it answers SESSION_EXPIRED.
      deleteUser: { enabled: true },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              name: user.name.trim().slice(0, MAX_NAME_LENGTH),
              image: user.image || DEFAULT_AVATAR,
            },
          }),
        },
        update: {
          before: async (user) => {
            if (user.name === undefined) return;
            const name = user.name.trim();
            if (name === "" || name.length > MAX_NAME_LENGTH) {
              throw new APIError("BAD_REQUEST", {
                message: `Name must be 1 to ${MAX_NAME_LENGTH} characters.`,
              });
            }
            return { data: { ...user, name } };
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;

// Google sign-in is on only when both keys are in .env.
function googleProvider() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn("Google sign-in is off: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.");
    return undefined;
  }
  // select_account: always ask which Google account, so logging out lets you switch accounts.
  return { clientId, clientSecret, prompt: "select_account" as const };
}

// GitHub sign-in is on only when both keys are in .env.
function githubProvider() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.warn("GitHub sign-in is off: set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env.");
    return undefined;
  }
  // Better Auth's own GitHub profile lookup.
  const lookup = builtInGithub({ clientId, clientSecret });
  return {
    clientId,
    clientSecret,
    // select_account: always ask which GitHub account, so logging out lets you switch accounts.
    prompt: "select_account",
    // GitHub accounts can list addresses their owner never verified, and accounts here are keyed
    // by email, so only a verified one is used. Without an email, sign-in fails with
    // ?error=email_not_found, before any account is created or linked.
    getUserInfo: async (tokens) => {
      const info = await lookup.getUserInfo(tokens);
      if (!info || info.user.emailVerified) return info;
      return { ...info, user: { ...info.user, email: undefined } };
    },
  } satisfies GithubOptions;
}
