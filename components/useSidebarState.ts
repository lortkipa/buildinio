import { useSyncExternalStore } from "react";
import { SIDEBAR_COLLAPSED_COOKIE, SIDEBAR_WIDTH_COOKIE } from "@/lib/sidebar";
import type { SidebarState } from "@/lib/sidebar";

// Keep the current size when the shared workspace layout is hidden and restored.

const YEAR_S = 365 * 24 * 60 * 60;

let current: SidebarState | null = null; // Null until it's changed here; until then, the cookie's.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Remembered in cookies, so the page renders at this size next time with no jump. */
function save({ width, collapsed }: SidebarState) {
  const options = `; path=/; max-age=${YEAR_S}; samesite=lax`;
  document.cookie = `${SIDEBAR_WIDTH_COOKIE}=${width}${options}`;
  document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${collapsed ? 1 : 0}${options}`;
}

/** Changes it on every page; `persist` also saves it (once a drag has settled). */
export function setSidebarState(next: SidebarState, persist: boolean) {
  current = next;
  if (persist) save(next);
  listeners.forEach((listener) => listener());
}

/** The sidebar's size: `saved` (read from the cookies by the layout) until it's changed. */
export function useSidebarState(saved: SidebarState) {
  return useSyncExternalStore(
    subscribe,
    () => current ?? saved,
    () => saved,
  );
}
