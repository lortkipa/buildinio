"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { createPortal } from "react-dom";
import { FileUpIcon } from "./icons";

// Whether a drag carries files (not text or a link dragged from the page).
function hasFiles(event: DragEvent) {
  return event.dataTransfer?.types.includes("Files") ?? false;
}

// A modal dialog (search, a project's dialog, the phone sheet, the image viewer) takes no files.
function modalOpen() {
  return Array.from(document.querySelectorAll("dialog")).some((dialog) => dialog.matches(":modal"));
}

/*
 * Files dragged anywhere over the window: an overlay says they can be dropped, and dropping them
 * passes them to onFiles. Over a modal dialog they can't be dropped. Either way the browser never
 * opens a dropped file itself, which would leave the page and lose the mocked projects.
 */
export function FileDrop({ onFiles }: { onFiles: (files: File[]) => void }) {
  const [over, setOver] = useState(false);
  // The overlay goes in a portal: a transformed or blurred ancestor would pin it to itself.
  const [mounted, setMounted] = useState(false);
  const deliver = useEffectEvent(onFiles);

  useEffect(() => {
    setMounted(true);
    // dragenter and dragleave fire for every element crossed, so count them: 0 is outside the window.
    let depth = 0;
    const onEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth++;
      if (!modalOpen()) setOver(true);
    };
    const onOver = (event: DragEvent) => {
      if (!hasFiles(event) || !event.dataTransfer) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = modalOpen() ? "none" : "copy";
    };
    const onLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setOver(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setOver(false);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length && !modalOpen()) deliver(files);
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  if (!mounted) return null;
  return createPortal(
    // Takes the drag while shown, so a drop over the preview's frame lands here too.
    <div
      aria-hidden
      className={`fixed inset-0 z-50 p-3 backdrop-blur-xl transition-[opacity,visibility] duration-200 ease-out motion-reduce:transition-none bg-white/85 dark:bg-zinc-950/85 ${
        over ? "visible opacity-100" : "invisible opacity-0"
      }`}
    >
      <div
        className={`flex size-full flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-brand-violet/50 px-6 text-center transition-[scale] duration-300 ease-spring motion-reduce:transition-none dark:border-brand-violet/60 ${
          over ? "scale-100" : "scale-[0.98]"
        }`}
      >
        <span className="grid size-16 place-items-center rounded-2xl bg-brand-gradient text-white shadow-lg shadow-brand-magenta/30">
          <FileUpIcon className="size-8" />
        </span>
        <p className="font-display text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
          Drop files to attach
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          Images and documents, up to 25 MB each
        </p>
      </div>
    </div>,
    document.body,
  );
}
