// What people can set about their account, shared by the settings, sign-up and the server.

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}

export const MAX_NAME = 80;

/** A name as it's kept: trimmed, with single spaces. */
export function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

/** Uploaded avatars are cropped and shrunk in the browser to this many pixels square. */
export const AVATAR_PIXELS = 256;
export const MAX_AVATAR_BYTES = 512 * 1024;
