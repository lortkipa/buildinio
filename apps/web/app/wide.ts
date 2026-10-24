import { useSyncExternalStore } from "react";

// Tailwind's md breakpoint, from which the sidebar shows instead of the phone top bar and sheet, and
// a project's preview sits beside its chat instead of taking turns with it.
export const WIDE = "(min-width: 48rem)";

// Tailwind's lg breakpoint: desktops. Between md and lg are tablets.
export const LARGE = "(min-width: 64rem)";

/*
 * Whether the media query matches. The server can't know, so it renders the desktop layout and
 * smaller screens update right after hydrating. Use it for what CSS can't do (inert, labels, which
 * options there are); breakpoint styles belong in md: and lg: classes, which are right from the
 * first paint.
 */
function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (listener) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", listener);
      return () => list.removeEventListener("change", listener);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
}

// The screen is md or wider.
export const useWide = () => useMediaQuery(WIDE);

// The screen is lg or wider.
export const useLarge = () => useMediaQuery(LARGE);
