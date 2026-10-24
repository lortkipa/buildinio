"use client";

import { createContext, useContext } from "react";
import { AppWindowIcon, XIcon } from "./icons";

/*
 * On phones, where the preview would hide the chat, a project whose build just finished doesn't
 * switch to it on its own: a pill above the prompt input says the app is ready, and View opens the
 * preview. ProjectWorkspace decides when it shows and provides it here; the chat renders the pill.
 */
export type AppReady = { shown: boolean; view: () => void; dismiss: () => void };

export const AppReadyContext = createContext<AppReady | null>(null);

// Floats above the prompt input (put it in a relative box around it), on phones only.
export function AppReadyPill() {
  const ready = useContext(AppReadyContext);
  if (!ready?.shown) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-full flex justify-center pb-3 md:hidden">
      <div className="pointer-events-auto flex animate-toast-in items-center rounded-full border border-zinc-950/10 bg-white/90 py-1 pr-1 pl-1 text-sm shadow-lg shadow-zinc-950/10 backdrop-blur-xl motion-reduce:animate-none dark:border-white/10 dark:bg-zinc-900/90 dark:shadow-black/40">
        <button
          type="button"
          onClick={ready.view}
          className="flex h-9 items-center gap-2 rounded-full pr-2 pl-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet"
        >
          <AppWindowIcon className="size-4.5 project-glyph" />
          <span>Your app is ready</span>
          <span aria-hidden className="text-zinc-400 dark:text-zinc-500">
            ·
          </span>
          <span className="font-medium project-glyph">View</span>
        </button>
        <button
          type="button"
          onClick={ready.dismiss}
          aria-label="Dismiss"
          className="grid size-9 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
