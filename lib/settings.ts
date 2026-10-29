export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];
export type Appearance = { theme: Theme; reducedMotion: boolean };
export const DEFAULT_APPEARANCE: Appearance = { theme: "system", reducedMotion: false };
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
export const MAX_NAME = 80;
