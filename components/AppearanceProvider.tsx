"use client";

import { createContext, useContext, useLayoutEffect, useSyncExternalStore, type ReactNode } from "react";
import { DEFAULT_APPEARANCE, type Appearance } from "@/lib/settings";

const AppearanceContext = createContext<Appearance>(DEFAULT_APPEARANCE);
const ReducedMotionContext = createContext(false);
const MOTION_QUERY = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (notify: () => void) => {
  const media = window.matchMedia(MOTION_QUERY);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};
const motionSnapshot = () => window.matchMedia(MOTION_QUERY).matches;
const serverMotionSnapshot = () => false;

/** Values come only from the authenticated server render; no browser persistence. */
export function AppearanceProvider({ appearance, children }: { appearance: Appearance; children: ReactNode }) {
  const systemMotion = useSyncExternalStore(subscribeMotion, motionSnapshot, serverMotionSnapshot);
  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme = appearance.theme === "system"
        ? media.matches ? "dark" : "light" : appearance.theme;
      document.documentElement.dataset.reducedMotion = String(appearance.reducedMotion);
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [appearance.theme, appearance.reducedMotion]);

  // Runs before the streamed page paints. These values are enums and a boolean,
  // read from the database; never user-entered script text.
  const initial = `document.documentElement.dataset.theme=${JSON.stringify(appearance.theme)}==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):${JSON.stringify(appearance.theme)};document.documentElement.dataset.reducedMotion=${JSON.stringify(String(appearance.reducedMotion))};`;
  return (
    <AppearanceContext value={appearance}>
      <ReducedMotionContext value={appearance.reducedMotion || systemMotion}>
        <script dangerouslySetInnerHTML={{ __html: initial }} />
        {children}
      </ReducedMotionContext>
    </AppearanceContext>
  );
}

export function useAppearance() {
  return useContext(AppearanceContext);
}

/** The app can reduce motion further, while still respecting the OS setting. */
export function useReducedMotion() {
  return useContext(ReducedMotionContext);
}
