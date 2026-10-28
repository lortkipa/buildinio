import { useSyncExternalStore } from "react";
import { PREVIEW_OPEN_COOKIE, PREVIEW_WIDTH_COOKIE } from "@/lib/preview";
import type { PreviewState } from "@/lib/preview";

// Whether the preview shows, outside React so the shared layout and the chat page
// (its "app is ready" card) see the same. On wider screens it's a panel next to the
// chat, remembered like the sidebar's size; on phones it covers the chat until closed.

const YEAR_S = 365 * 24 * 60 * 60;

let current: PreviewState | null = null; // Null until it's changed here; until then, the cookie's.
let mobileOpen = false;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((listener) => listener());
}

/** Remembered in cookies, so the page renders at this size next time with no jump. */
function save({ width, open }: PreviewState) {
  const options = `; path=/; max-age=${YEAR_S}; samesite=lax`;
  document.cookie = `${PREVIEW_WIDTH_COOKIE}=${width}${options}`;
  document.cookie = `${PREVIEW_OPEN_COOKIE}=${open ? 1 : 0}${options}`;
}

/** Changes the panel on every page; `persist` also saves it (once a drag has settled). */
export function setPreviewState(next: PreviewState, persist: boolean) {
  current = next;
  if (persist) save(next);
  notify();
}

/** The panel on wider screens: `saved` (read from the cookies by the layout) until it's changed. */
export function usePreviewState(saved: PreviewState) {
  return useSyncExternalStore(
    subscribe,
    () => current ?? saved,
    () => saved,
  );
}

/** Opens or closes the preview on phones. Not remembered: it starts closed on every page. */
export function setMobilePreview(open: boolean) {
  if (mobileOpen === open) return;
  mobileOpen = open;
  notify();
}

export function useMobilePreview() {
  return useSyncExternalStore(
    subscribe,
    () => mobileOpen,
    () => false,
  );
}
