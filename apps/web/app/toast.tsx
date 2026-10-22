"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleAlertIcon, XIcon } from "./icons";

// Long enough to read a two-line message.
const SHOW_MS = 6000;

type ToastState = { id: number; message: string } | null;

// The toast to show, and a function that shows a message. Showing the same message again
// restarts it (each one gets a new id).
export function useToast(initialMessage?: string) {
  const [toast, setToast] = useState<ToastState>(
    initialMessage ? { id: 0, message: initialMessage } : null,
  );
  const showToast = useCallback(
    (message: string) => setToast((current) => ({ id: (current?.id ?? 0) + 1, message })),
    [],
  );
  const closeToast = useCallback(() => setToast(null), []);
  return { toast, showToast, closeToast };
}

// An error at the bottom of the screen, e.g. why signing in failed. Closes itself after a while.
export function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, SHOW_MS);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;
  return (
    // Above the home indicator on phones without a bottom gap.
    <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-50 flex justify-center px-4">
      <div
        // A new key per toast replays the entrance and announces it again.
        key={toast.id}
        role="alert"
        className="pointer-events-auto flex w-full max-w-sm animate-toast-in items-start gap-3 rounded-2xl border border-zinc-950/10 bg-white/90 py-3 pr-2 pl-4 text-sm text-zinc-950 shadow-xl shadow-zinc-950/10 backdrop-blur-xl motion-reduce:animate-none dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-50 dark:shadow-black/40"
      >
        <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" />
        <p className="flex-1 py-px text-pretty">{toast.message}</p>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="-my-1 grid size-7 shrink-0 place-items-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
}
