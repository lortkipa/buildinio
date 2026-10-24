import { authClient, isUnreachable, settle, UNREACHABLE } from "../auth-client";

/*
 * Signing in with a code sent by email (apps/api/src/email-sign-in.ts), turned into what the email
 * and code steps show. The API sets the rules (expiry, tries, resend cooldown, limits) and says
 * how they stand in each answer.
 */

// Digits per code, as the API sends them.
export const CODE_LENGTH = 6;

// The code in the email: its tries left, and when another can be sent (ms since the epoch).
export type SentCode = { triesLeft: number; resendAt: number };

export type SendResult = ({ ok: true } & SentCode) | { ok: false; message: string };

// triesLeft: set when the answer changed it (a wrong, expired or used-up code).
export type VerifyResult =
  | { ok: true; onboarded: boolean }
  | { ok: false; message: string; triesLeft?: number };

// The API's error, with the extra fields its limits and code checks add.
type ApiError = { status: number; code?: string; retryAfter?: unknown; triesLeft?: unknown };

export const triesLeftText = (triesLeft: number) =>
  triesLeft === 0
    ? "No tries left. Request a new code."
    : `${triesLeft} ${triesLeft === 1 ? "try" : "tries"} left.`;

// Sends a code to the email, or, within the resend cooldown, answers for the code already sent.
export async function sendCode(email: string): Promise<SendResult> {
  const { data, error } = await settle(
    authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" }),
  );
  if (error) return { ok: false, message: sendErrorMessage(error) };
  // Added by the API to Better Auth's { success }.
  const { triesLeft, resendIn } = data as unknown as { triesLeft: number; resendIn: number };
  // From the time left rather than a timestamp, so the device's clock doesn't matter.
  return { ok: true, triesLeft, resendAt: Date.now() + resendIn * 1000 };
}

// Signs in with the code, creating the account for a new email.
export async function verifyCode(email: string, code: string): Promise<VerifyResult> {
  const { data, error } = await settle(authClient.signIn.emailOtp({ email, otp: code }));
  if (!error) return { ok: true, onboarded: data.user.onboarded === true };
  const apiError: ApiError = error;
  switch (apiError.code) {
    case "INVALID_OTP": {
      const triesLeft = typeof apiError.triesLeft === "number" ? apiError.triesLeft : 0;
      return { ok: false, triesLeft, message: `Incorrect code. ${triesLeftText(triesLeft)}` };
    }
    case "OTP_EXPIRED":
      return { ok: false, triesLeft: 0, message: "This code has expired. Request a new code." };
    case "TOO_MANY_ATTEMPTS":
      return { ok: false, triesLeft: 0, message: triesLeftText(0) };
  }
  if (apiError.status === 429) {
    return { ok: false, message: limitMessage(apiError, "Too many tries from your network.") };
  }
  if (isUnreachable(apiError)) return { ok: false, message: UNREACHABLE };
  return { ok: false, message: "Couldn’t check the code. Try again." };
}

function sendErrorMessage(error: ApiError) {
  if (error.code === "INVALID_EMAIL") return "Enter a valid email address.";
  // The email provider failed or refused it (502, so before isUnreachable).
  if (error.code === "EMAIL_NOT_SENT") return "Couldn’t send the email. Try again in a moment.";
  if (error.status === 429) {
    return limitMessage(error, "Too many codes requested from your network.");
  }
  if (isUnreachable(error)) return UNREACHABLE;
  return "Couldn’t send the code. Try again.";
}

// A 429 from one of the API's limits. ipMessage: what the per-IP limit of this request is about.
function limitMessage(error: ApiError, ipMessage: string) {
  const reason =
    error.code === "EMAIL_LIMIT"
      ? "Too many codes sent to this email."
      : error.code === "TOTAL_LIMIT"
        ? "Too many sign-ins right now."
        : ipMessage;
  const seconds = typeof error.retryAfter === "number" ? error.retryAfter : 0;
  return seconds > 0 ? `${reason} Try again ${inTime(seconds)}.` : `${reason} Try again later.`;
}

// "in 40 seconds", "in 12 minutes", "in 2 hours": rounded up, so it's never too early.
function inTime(seconds: number) {
  const [count, unit] =
    seconds < 60
      ? [seconds, "second"]
      : seconds < 3600
        ? [Math.ceil(seconds / 60), "minute"]
        : [Math.ceil(seconds / 3600), "hour"];
  return `in ${count} ${unit}${count === 1 ? "" : "s"}`;
}
