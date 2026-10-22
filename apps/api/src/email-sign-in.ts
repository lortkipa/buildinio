import { createHash } from "node:crypto";
import {
  type Database,
  deleteExpiredRateLimits,
  hitRateLimit,
  type RateLimitRule,
} from "@buildinio/db";
import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthMiddleware, getIP, isAPIError } from "better-auth/api";
import { emailOTP } from "better-auth/plugins/email-otp";
import { isProduction, readInteger, readLimits } from "./env";
import { createMailer } from "./mailer";
import { signInEmail } from "./sign-in-email";

// Digits per code. The web app's code field has as many slots (apps/web/app/(auth)/email-code.ts).
const CODE_LENGTH = 6;

const SEND_PATH = "/email-otp/send-verification-otp";
const SIGN_IN_PATH = "/sign-in/email-otp";

// Same check as the web app's email field, plus the longest address SMTP allows.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL_LENGTH = 254;

const PRUNE_EVERY_MS = 10 * 60_000;

// Better Auth's emailOTP keeps the latest code for an email in a verification row with this
// identifier, and a value of "<stored code>:<wrong tries so far>" (better-auth 1.7).
const codeIdentifier = (email: string) => `sign-in-otp-${email}`;

/*
 * Signing in with a code sent by email (Better Auth's emailOTP), with limits from .env (see
 * .env.example) on top of the code's own expiry and tries:
 * - a cooldown before another code goes to the same email; asking again sooner sends nothing
 *   and answers as if sent, with the earlier code's tries left and the time until it can be sent
 * - how many codes go to one email, how many sends and code checks come from one IP, and how many
 *   codes are sent in total. A blocked request gets 429 with retryAfter (seconds).
 * Signing in with a code also signs up: a new email gets an account with no name yet.
 */
export function emailSignIn(db: Database, appUrl: string): BetterAuthPlugin[] {
  const expiresMinutes = readInteger("EMAIL_CODE_EXPIRES_MINUTES", 10);
  const maxTries = readInteger("EMAIL_CODE_MAX_TRIES", 3);
  const resendSeconds = readInteger("EMAIL_CODE_RESEND_SECONDS", 60);
  if (resendSeconds >= expiresMinutes * 60) {
    throw new Error(
      "EMAIL_CODE_RESEND_SECONDS must be shorter than EMAIL_CODE_EXPIRES_MINUTES, or a code would expire before another can be sent.",
    );
  }
  const limits = {
    perEmail: readLimits("EMAIL_CODE_LIMIT_PER_EMAIL", "5/1h,10/1d"),
    perIp: readLimits("EMAIL_CODE_LIMIT_PER_IP", "20/1h"),
    checksPerIp: readLimits("EMAIL_CODE_CHECK_LIMIT_PER_IP", "30/15m"),
    total: readLimits("EMAIL_CODE_LIMIT_TOTAL", "500/1h"),
  };
  const mailer = createMailer();

  let lastPrune = 0;
  let warnedNoIp = false;

  // Counts a hit for each rule and throws 429 at the first one that is over its limit.
  async function enforce(key: string, rules: RateLimitRule[], code: string, message: string) {
    if (Date.now() - lastPrune > PRUNE_EVERY_MS) {
      lastPrune = Date.now();
      deleteExpiredRateLimits(db).catch((error) => {
        console.error("Couldn't delete expired rate limits:", error);
      });
    }
    for (const rule of rules) {
      const result = await hitRateLimit(db, `${key}:${rule.max}/${rule.windowSeconds}s`, rule);
      if (!result.allowed) {
        const retryAfter = result.retryAfterSeconds;
        throw new APIError(
          "TOO_MANY_REQUESTS",
          { code, message, retryAfter },
          { "Retry-After": String(retryAfter) },
        );
      }
    }
  }

  // The client's IP, from X-Forwarded-For. Only a proxy in front of the web app sets it (the web
  // app's own forwarding to the API doesn't), and it has to replace any value the client sent.
  // Better Auth trusts a single address only, so without one there is no IP, and the per-IP
  // limits are skipped rather than shared by everyone.
  function clientIp(ctx: AuthContext): string | null {
    const source = ctx.request ?? ctx.headers;
    const ip = source ? getIP(source, ctx.context.options) : null;
    if (!ip && isProduction && !warnedNoIp) {
      warnedNoIp = true;
      console.warn(
        "Requests carry no client IP (X-Forwarded-For), so the per-IP limits on email codes are off. Put a proxy that sets it in front of the web app.",
      );
    }
    return ip;
  }

  // The email's latest code that hasn't expired, if any.
  async function liveCode(ctx: AuthContext, email: string) {
    const row = await ctx.context.internalAdapter.findVerificationValue(codeIdentifier(email));
    if (!row || row.expiresAt <= new Date()) return null;
    const tries = Number(row.value.slice(row.value.lastIndexOf(":") + 1)) || 0;
    return { sentAt: row.createdAt, triesLeft: Math.max(0, maxTries - tries) };
  }

  const limitsPlugin = {
    id: "email-sign-in-limits",
    hooks: {
      before: [
        {
          // Unused emailOTP endpoints (passwords, email changes, ...). Some send email.
          matcher: (ctx) =>
            (ctx.path?.startsWith("/email-otp/") && ctx.path !== SEND_PATH) ||
            ctx.path === "/forget-password/email-otp",
          handler: createAuthMiddleware(async () => {
            throw new APIError("NOT_FOUND");
          }),
        },
        {
          matcher: (ctx) => ctx.path === SEND_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            if (ctx.body?.type !== "sign-in") {
              throw new APIError("BAD_REQUEST", { message: "Only sign-in codes can be sent." });
            }
            const email = normalizeEmail(ctx.body.email);
            if (!email) {
              throw new APIError("BAD_REQUEST", {
                code: "INVALID_EMAIL",
                message: "Invalid email",
              });
            }

            const ip = clientIp(ctx);
            if (ip) {
              await enforce(
                `send-ip:${ip}`,
                limits.perIp,
                "IP_LIMIT",
                "Too many codes requested from this network.",
              );
            }

            // Within the cooldown, the code already sent still counts.
            const pending = await liveCode(ctx, email);
            const resendAt = pending ? pending.sentAt.getTime() + resendSeconds * 1000 : 0;
            if (pending && resendAt > Date.now()) {
              return ctx.json({
                success: true,
                triesLeft: pending.triesLeft,
                resendIn: Math.ceil((resendAt - Date.now()) / 1000),
              });
            }

            await enforce(
              `send-email:${emailKey(email)}`,
              limits.perEmail,
              "EMAIL_LIMIT",
              "Too many codes sent to this email.",
            );
            await enforce("send-total", limits.total, "TOTAL_LIMIT", "Too many codes sent.");
          }),
        },
        {
          matcher: (ctx) => ctx.path === SIGN_IN_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            const ip = clientIp(ctx);
            if (!ip) return;
            await enforce(
              `check-ip:${ip}`,
              limits.checksPerIp,
              "IP_LIMIT",
              "Too many codes checked from this network.",
            );
          }),
        },
      ],
      after: [
        {
          matcher: (ctx) => ctx.path === SEND_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            if (isAPIError(ctx.context.returned)) return;
            // Sending failed: sendVerificationOTP deleted the code (Better Auth only logs the error).
            if (!(await liveCode(ctx, normalizeEmail(ctx.body.email) ?? ""))) {
              throw new APIError("BAD_GATEWAY", {
                code: "EMAIL_NOT_SENT",
                message: "Couldn't send the email.",
              });
            }
            return ctx.json({ success: true, triesLeft: maxTries, resendIn: resendSeconds });
          }),
        },
        {
          // A wrong code: add how many tries the code has left.
          matcher: (ctx) => ctx.path === SIGN_IN_PATH,
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned;
            if (!isAPIError(returned) || returned.body?.code !== "INVALID_OTP") return;
            const code = await liveCode(ctx, normalizeEmail(ctx.body?.email) ?? "");
            throw new APIError(returned.status, {
              ...returned.body,
              triesLeft: code?.triesLeft ?? 0,
            });
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;

  const codes = emailOTP({
    otpLength: CODE_LENGTH,
    expiresIn: expiresMinutes * 60,
    allowedAttempts: maxTries,
    // Encrypted with BETTER_AUTH_SECRET, so the database alone doesn't reveal live codes. (Hashing
    // wouldn't help: there are only a million six-digit codes to try.)
    storeOTP: "encrypted",
    async sendVerificationOTP({ email, otp, type }, ctx) {
      // The endpoints that send other types are blocked above.
      if (type !== "sign-in") return;
      if (!mailer) {
        console.info(`Sign-in code for ${email}: ${otp} (expires in ${expiresMinutes} min)`);
        return;
      }
      try {
        await mailer.send(signInEmail({ to: email, code: otp, expiresMinutes, appUrl }));
      } catch (error) {
        console.error(`Couldn't send the sign-in code to ${email}:`, error);
        // No code was sent, so none should count for the cooldown, and the request should fail.
        await ctx?.context.internalAdapter.deleteVerificationByIdentifier(codeIdentifier(email));
      }
    },
  });

  return [limitsPlugin, codes];
}

type AuthContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= MAX_EMAIL_LENGTH && EMAIL_PATTERN.test(email) ? email : null;
}

// For the per-email limits. Drops a "+tag", which most providers deliver to the same inbox, and
// hashes the result so the limits table holds no addresses.
function emailKey(email: string): string {
  const at = email.lastIndexOf("@");
  const local = email.slice(0, at).split("+")[0];
  return createHash("sha256")
    .update(`${local}${email.slice(at)}`)
    .digest("hex");
}
