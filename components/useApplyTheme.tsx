import { useLayoutEffect, useRef } from "react";
import { useServerInsertedHTML } from "next/navigation";
import { THEME_COLORS } from "@/lib/account/options";
import type { Theme } from "@/lib/account/options";

/**
 * Shows the app in the user's theme while it's mounted: `data-theme` on <html> is only
 * ever `light` or `dark` (globals.css follows that, not the system directly) and the
 * browser's bar color matches. "system" is resolved here, and follows the system changing.
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
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    let resolved = "";
    const run = () => {
      apply(theme, THEME_COLORS);
      resolved = document.documentElement.dataset.theme ?? "";
    };
    run();
    // The first script and a refresh can write the saved choice ("system") onto <html>.
    // That value doesn't select a theme, so put the resolved one back.
    const observer = new MutationObserver(() => {
      if (document.documentElement.dataset.theme !== resolved) document.documentElement.dataset.theme = resolved;
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    mq.addEventListener("change", run);
    return () => {
      mq.removeEventListener("change", run);
      observer.disconnect();
      apply(null, THEME_COLORS); // Signed out: follow the system again.
    };
  }, [theme]);
}

/** Runs on its own in the page's first script too, so it uses nothing from outside. */
function apply(theme: string | null, colors: Record<string, string>) {
  const root = document.documentElement;
  // "system" (and signed out) take the system's light or dark. A chosen theme is used as it is.
  const resolved = theme === "light" || theme === "dark" ? theme : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  root.dataset.theme = resolved;
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
    meta.content = colors[resolved];
  });
}
