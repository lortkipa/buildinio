import type { RateLimitRule } from "@buildinio/db";

/*
 * Settings from .env. An empty value counts as unset, so Compose can pass `${VAR:-}` through. A
 * value that can't be used stops the API at startup with a message that names the variable.
 */

export const isProduction = process.env.NODE_ENV === "production";

export function readString(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value === "" ? undefined : value;
}

// A whole number of at least `min`.
export function readInteger(name: string, fallback: number, min = 1): number {
  const value = readString(name);
  if (value === undefined) return fallback;
  const number = Number(value);
  if (!Number.isInteger(number) || number < min) {
    throw new Error(`${name} must be a whole number of at least ${min}, not "${value}".`);
  }
  return number;
}

const WINDOW_UNITS: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86_400 };

/*
 * Limits written as <count>/<window>, the window in s, m, h or d, e.g. "5/1h". Several are
 * separated by commas ("5/1h,10/1d") and must all allow a hit. "off" means no limit.
 */
export function readLimits(name: string, fallback: string): RateLimitRule[] {
  const value = readString(name) ?? fallback;
  if (value.toLowerCase() === "off") return [];
  return value.split(",").map((part) => {
    const match = /^(\d+)\s*\/\s*(\d+)\s*([smhd])$/i.exec(part.trim());
    const max = Number(match?.[1]);
    const windowSeconds = Number(match?.[2]) * (WINDOW_UNITS[match?.[3]?.toLowerCase() ?? ""] ?? 0);
    if (!match || max < 1 || windowSeconds < 1) {
      throw new Error(
        `${name} must be limits like "5/1h" (a count, then a window in s, m, h or d), separated by commas, or "off". Got "${value}".`,
      );
    }
    return { max, windowSeconds };
  });
}
