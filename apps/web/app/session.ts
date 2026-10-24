import { headers } from "next/headers";
import { cache } from "react";
import { API_URL } from "../api-url";
import type { Session } from "./auth-client";

/*
 * The signed-in user's session, for server components, or null when signed out. Asks the API with
 * the request's cookies, once per request however many layouts and pages ask. A server component
 * can't set cookies, so when the API refreshes the session cookie the browser has to ask too
 * (AppShell does).
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const cookie = (await headers()).get("cookie");
  if (!cookie) return null;
  try {
    const response = await fetch(`${API_URL}/api/auth/get-session`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    return await response.json();
  } catch (error) {
    // Pages still render, signed out, while the API is down.
    console.error("Couldn't read the session from the API:", error);
    return null;
  }
});
