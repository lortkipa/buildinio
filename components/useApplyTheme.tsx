import { useLayoutEffect, useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { THEME_COLORS } from "@/lib/account/options";
import type { Theme } from "@/lib/account/options";

/**
 * Shows the app in the user's theme while it's mounted: `data-theme` on <html> (which
 * globals.css follows) and the browser's bar color to match. Back to the system's after.
 */
export function useApplyTheme(theme: Theme) {
  // On the first load, a script right where the app starts in the page. The root layout's
  // first script has usually set the theme already (see THEME_COOKIE); this one is the
  // database's word on it, and sets the bar color too.
  const inserted = useRef(false);
  useServerInsertedHTML(() => {
    if (inserted.current) return null;
    inserted.current = true;
    const script = `(${apply})(${JSON.stringify(theme)}, ${JSON.stringify(THEME_COLORS)})`;
    return <script dangerouslySetInnerHTML={{ __html: script }} />;
  });

  useLayoutEffect(() => {
    apply(theme, THEME_COLORS);
    return () => apply(null, THEME_COLORS);
  }, [theme]);
}

/** Runs on its own in the page's first script too, so it uses nothing from outside. */
function apply(theme: string | null, colors: Record<string, string>) {
  const root = document.documentElement;
  if (theme) root.dataset.theme = theme;
  else delete root.dataset.theme;
  // There's a tag for each system theme (the root layout's `viewport`); a picked theme sets both.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    const system = meta.media.includes("dark") ? "dark" : "light";
    meta.content = colors[theme === "light" || theme === "dark" ? theme : system];
  });
}
