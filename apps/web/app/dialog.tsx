"use client";

import { useEffect, useRef } from "react";
import { hasFinePointer } from "./pointer";

/*
 * A modal dialog above everything else, over a dark blurred backdrop. Closes with Escape or a click
 * on the backdrop. Phone keyboards cover the page without resizing it, so while a keyboard is up the
 * dialog centers itself in the part of the screen above it (revealForm can't move a fixed dialog).
 * A field with data-autofocus is focused as it opens, only with a mouse or trackpad.
 */
export function Dialog({
  open,
  onClose,
  className,
  labelledBy,
  children,
}: {
  open: boolean;
  onClose: () => void;
  className: string;
  labelledBy: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Where the last press started: a click that ends on the backdrop closes only if it started there.
  const pressedBackdrop = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      const field = dialog.querySelector<HTMLInputElement>("[data-autofocus]");
      // On phones, focusing the field would pop up the keyboard: focus the dialog instead.
      if (field && hasFinePointer()) field.select();
      else if (!hasFinePointer()) dialog.focus();
    } else if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const viewport = window.visualViewport;
    const dialog = ref.current;
    if (!open || !viewport || !dialog) return;
    const onResize = () => {
      // The part of the layout viewport below the visual one, which is what the keyboard covers.
      const covered = window.innerHeight - viewport.height - viewport.offsetTop;
      dialog.style.setProperty("--keyboard-inset", `${Math.max(0, covered)}px`);
    };
    onResize();
    viewport.addEventListener("resize", onResize);
    viewport.addEventListener("scroll", onResize);
    return () => {
      viewport.removeEventListener("resize", onResize);
      viewport.removeEventListener("scroll", onResize);
    };
  }, [open]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it, and the backdrop isn't a control
    <dialog
      ref={ref}
      tabIndex={-1}
      aria-labelledby={labelledBy}
      onClose={onClose}
      onPointerDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // The dialog's own box has no padding, so a click on the dialog itself is on the backdrop.
        if (event.target === event.currentTarget && pressedBackdrop.current) onClose();
      }}
      className={`${className} bottom-[var(--keyboard-inset,0px)] m-auto max-w-none rounded-3xl border border-zinc-950/10 bg-white/95 p-0 text-zinc-950 shadow-2xl shadow-zinc-950/20 outline-none backdrop-blur-xl transition-[opacity,scale,display,overlay] duration-200 ease-out transition-discrete backdrop:bg-zinc-950/40 backdrop:backdrop-blur-sm backdrop:transition-opacity backdrop:duration-200 not-open:scale-95 not-open:opacity-0 not-open:backdrop:opacity-0 starting:open:scale-95 starting:open:opacity-0 starting:open:backdrop:opacity-0 motion-reduce:transition-none dark:border-white/10 dark:bg-zinc-900/95 dark:text-zinc-50 dark:shadow-black/50`}
    >
      {children}
    </dialog>
  );
}
