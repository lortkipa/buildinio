// The desktop preview's size, shared by the page (reads the cookies) and the preview (writes them),
// and the sandbox the built app runs in.

export const PREVIEW_WIDTH_COOKIE = "preview_width";
export const PREVIEW_OPEN_COOKIE = "preview_open";

// Widths in px.
export const PREVIEW_DEFAULT_WIDTH = 480;
export const PREVIEW_MIN_WIDTH = 320; // Narrowest it gets while open.
export const PREVIEW_CLOSE_AT = 240; // Dragging narrower than this hides it.
export const CHAT_MIN_WIDTH = 360; // The chat next to it keeps at least this much.

// What the built app may do in its frame (and when opened on its own, see app/preview).
// No allow-same-origin: its scripts get an origin of their own, so they can't reach this site.
export const APP_SANDBOX = "allow-scripts allow-forms allow-modals allow-popups";

export type PreviewState = {
  width: number; // Width while open, kept while hidden so it reopens the same.
  open: boolean;
};

/** At least the narrowest it gets, and at most `max` if that's wider. */
export function clampPreviewWidth(width: number, max = Infinity) {
  return Math.round(Math.max(PREVIEW_MIN_WIDTH, Math.min(width, max)));
}

/** The saved preview state from its cookie values, or the defaults (hidden until there's an app to see). */
export function parsePreview(width: string | undefined, open: string | undefined): PreviewState {
  const value = Number(width);
  return {
    width: Number.isFinite(value) && width ? clampPreviewWidth(value) : PREVIEW_DEFAULT_WIDTH,
    open: open === "1",
  };
}
