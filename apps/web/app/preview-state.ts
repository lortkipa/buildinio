/*
 * The desktop preview panel's width and whether it is shown, beside a project's chat. Kept in a
 * cookie, so the server renders the panel as the user left it and nothing jumps once the page loads.
 * Imported by the server (reading) and the browser (writing), so nothing here may use either one's
 * APIs.
 */

export const PREVIEW_COOKIE = "preview";

// The panel's share of the space beside the sidebar, from 0 to 1. A share rather than pixels, so it
// renders in CSS without measuring anything and keeps its proportion as the window resizes.
export const DEFAULT_SHARE = 0.6;

// In pixels. The panel and the chat each keep at least their minimum, unless the window is too
// narrow for both (then they split it evenly, see ProjectWorkspace).
export const PREVIEW_MIN = 360;
export const CHAT_MIN = 360;
// Dragged narrower than this, the panel hides; dragged wider again, it shows.
export const HIDE_BELOW = 240;

// share is remembered while hidden too, to show it at that width again.
export type PreviewState = { share: number; open: boolean };

const clampShare = (share: number) => Math.min(1, Math.max(0, share));

// The cookie's value: the share, then ":hidden" when hidden, e.g. "0.6:hidden".
export function parsePreviewState(value: string | undefined): PreviewState {
  const [share = "", flag] = (value ?? "").split(":");
  const number = Number.parseFloat(share);
  return {
    share: Number.isNaN(number) || number <= 0 ? DEFAULT_SHARE : clampShare(number),
    open: flag !== "hidden",
  };
}

export function serializePreviewState({ share, open }: PreviewState) {
  const value = clampShare(share).toFixed(4);
  return open ? value : `${value}:hidden`;
}
