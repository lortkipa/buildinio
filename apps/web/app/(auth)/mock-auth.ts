/*
 * Stands in for email sign-in until it is built on Better Auth, so the code step can be tried.
 * Like a server, it waits a moment before answering, and it keeps the rules per email: a code is
 * sent at most once per RESEND_COOLDOWN_MS and allows MAX_TRIES checks. The state lives in memory,
 * so a reload starts fresh. Every code is MOCK_CODE. It doesn't sign anyone in: /welcome, where a
 * correct code leads, sends visitors without a session to /login.
 */

export const CODE_LENGTH = 6;
export const MAX_TRIES = 3;
export const RESEND_COOLDOWN_MS = 60_000;

const MOCK_CODE = "123456";
const SEND_DELAY_MS = 1200;
const VERIFY_DELAY_MS = 900;

// The latest code sent to each email (lowercased).
const sentCodes = new Map<string, { sentAt: number; triesLeft: number }>();

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type SendResult = { triesLeft: number; resendAt: number };

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: "invalid"; triesLeft: number }
  | { ok: false; error: "too-many-tries" };

export async function sendCode(email: string): Promise<SendResult> {
  await wait(SEND_DELAY_MS);
  const key = email.toLowerCase();
  let sent = sentCodes.get(key);
  // Within the cooldown nothing is sent and the earlier code, with its tries left, still counts.
  if (!sent || Date.now() - sent.sentAt >= RESEND_COOLDOWN_MS) {
    sent = { sentAt: Date.now(), triesLeft: MAX_TRIES };
    sentCodes.set(key, sent);
  }
  return { triesLeft: sent.triesLeft, resendAt: sent.sentAt + RESEND_COOLDOWN_MS };
}

export async function verifyCode(email: string, code: string): Promise<VerifyResult> {
  await wait(VERIFY_DELAY_MS);
  const key = email.toLowerCase();
  const sent = sentCodes.get(key);
  if (!sent || sent.triesLeft === 0) return { ok: false, error: "too-many-tries" };
  if (code === MOCK_CODE) {
    sentCodes.delete(key);
    return { ok: true };
  }
  sent.triesLeft -= 1;
  if (sent.triesLeft === 0) return { ok: false, error: "too-many-tries" };
  return { ok: false, error: "invalid", triesLeft: sent.triesLeft };
}
