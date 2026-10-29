// What people can set about their account, shared by the settings, sign-up and the server.

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}

/** The page's background in each theme (`--background` in globals.css), for the browser's own bars. */
export const THEME_COLORS = { light: "#fafaf9", dark: "#111113" };

export const MAX_NAME = 80;

/** A name as it's kept: trimmed, with single spaces. */
export function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** Email sign-ups get this avatar, and so does removing a photo; Google and GitHub ones get the picture from there. */
export const DEFAULT_AVATAR = "/avatars/default.svg";

/** Uploaded avatars are cropped and shrunk in the browser to this many pixels square. */
export const AVATAR_PIXELS = 256;
export const MAX_AVATAR_BYTES = 512 * 1024;
