// What people can set about their account, shared by the settings, sign-up and the server.

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}

/** The page's background in each theme (`--background` in globals.css), for the browser's own bars. */
export const THEME_COLORS = { light: "#fafaf9", dark: "#111113" };

/**
 * The theme is kept in the database. The page arrives in two parts, and the browser paints
 * the first (the same for everyone) before the second has the user's theme (useApplyTheme).
 * So proxy.ts copies the database's theme into this cookie with every page, and the root
 * layout's first script draws the page in it from the start. Only the server writes it.
 * The cookie keeps the choice (`system`, `light` or `dark`); the script resolves `system`
 * to light or dark, which is the only thing `data-theme` is ever set to.
 */
export const THEME_COOKIE = "theme";
export const THEME_HINT = `try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(system|light|dark)(?:;|$)/);var t=m?m[1]:"system";document.documentElement.dataset.theme=t==="light"||t==="dark"?t:(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")}catch(e){}`;

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
