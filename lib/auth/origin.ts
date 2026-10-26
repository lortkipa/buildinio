import "server-only";
import { headers } from "next/headers";

/**
 * Where the app is running, like "http://localhost:3000". Used for the OAuth
 * redirect address. APP_URL wins; otherwise it comes from the request.
 */
export async function getOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const h = await headers();
  const first = (value: string | null) => value?.split(",")[0].trim();
  const host = first(h.get("x-forwarded-host")) || h.get("host") || "localhost:3000";
  const proto = first(h.get("x-forwarded-proto")) || "http";
  return `${proto}://${host}`;
}
