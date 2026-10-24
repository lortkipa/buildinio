"use client";

import { useEffect, useRef, useState } from "react";
import type { Attachment } from "./attachments";
import { XIcon } from "./icons";

/*
 * An attached image at full size, over a dark blurred backdrop, with its name under it. Closes with
 * the X at the top right, Escape, or a click anywhere but the image. A modal dialog, so it opens
 * above everything (the phone sheet too) and Ctrl+K doesn't open search over it.
 */
export function ImageViewer({ image, onClose }: { image: Attachment | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  // The last image, kept while the viewer fades out.
  const [shown, setShown] = useState(image);
  if (image && image !== shown) setShown(image);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (image && !dialog.open) dialog.showModal();
    else if (!image && dialog.open) dialog.close();
  }, [image]);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: Escape closes it, and the backdrop isn't a control
    <dialog
      ref={ref}
      aria-label={shown?.name}
      onClose={onClose}
      onClick={(event) => {
        if (!(event.target as Element).closest("img, button")) onClose();
      }}
      className="fixed inset-0 m-0 size-full max-h-none max-w-none border-0 bg-transparent p-0 text-white outline-none transition-[opacity,scale,display,overlay] duration-200 ease-out transition-discrete backdrop:bg-zinc-950/85 backdrop:backdrop-blur-md backdrop:transition-opacity backdrop:duration-200 not-open:scale-95 not-open:opacity-0 not-open:backdrop:opacity-0 starting:open:scale-95 starting:open:opacity-0 starting:open:backdrop:opacity-0 motion-reduce:transition-none"
    >
      {shown && (
        <figure className="flex size-full flex-col items-center justify-center gap-3 px-4 pt-[max(4rem,env(safe-area-inset-top))] pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {/* biome-ignore lint/performance/noImgElement: a local blob URL, which next/image can't optimize */}
          <img
            src={shown.url}
            alt={shown.name}
            className="min-h-0 max-w-full flex-initial rounded-2xl object-contain shadow-2xl shadow-black/50"
          />
          <figcaption className="max-w-full truncate text-sm text-white/70">
            {shown.name}
          </figcaption>
        </figure>
      )}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed top-[max(1rem,env(safe-area-inset-top))] right-4 grid size-10 place-items-center rounded-full bg-white/10 text-white backdrop-blur-md transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <XIcon className="size-5" />
      </button>
    </dialog>
  );
}
