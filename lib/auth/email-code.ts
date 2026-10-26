import "server-only";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { emailCodes } from "@/lib/db/schema";

export const CODE_MINUTES = 10;
const MAX_CODES_PER_HOUR = 5;
const HOUR_MS = 60 * 60 * 1000;

function hashCode(email: string, code: string) {
  return createHash("sha256").update(`${email}:${code}`).digest();
}

/** A new 6-digit code for this email (replacing any older one), or null if too many were sent this hour. */
export function createEmailCode(email: string) {
  const now = Date.now();
  const previous = db.select().from(emailCodes).where(eq(emailCodes.email, email)).get();
  const sameWindow = previous && now - previous.windowStartedAt.getTime() < HOUR_MS;
  if (sameWindow && previous.sentCount >= MAX_CODES_PER_HOUR) return null;

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const row = {
    codeHash: hashCode(email, code).toString("hex"),
    expiresAt: new Date(now + CODE_MINUTES * 60 * 1000),
    sentCount: sameWindow ? previous.sentCount + 1 : 1,
    windowStartedAt: sameWindow ? previous.windowStartedAt : new Date(now),
  };
  db.insert(emailCodes)
    .values({ email, ...row })
    .onConflictDoUpdate({ target: emailCodes.email, set: row })
    .run();
  return code;
}

/** Checks a code. Each code gets one try: right or wrong, it can't be used again. */
export function checkEmailCode(email: string, code: string): "ok" | "wrong" | "expired" {
  const row = db.select().from(emailCodes).where(eq(emailCodes.email, email)).get();
  if (!row?.codeHash) return "expired";
  db.update(emailCodes).set({ codeHash: null }).where(eq(emailCodes.email, email)).run();
  if (row.expiresAt.getTime() < Date.now()) return "expired";
  return timingSafeEqual(Buffer.from(row.codeHash, "hex"), hashCode(email, code)) ? "ok" : "wrong";
}
