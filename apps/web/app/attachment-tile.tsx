"use client";

import { useState } from "react";
import { type Attachment, type AttachmentKind, formatLabel } from "./attachments";
import {
  FileChartPieIcon,
  FileCodeIcon,
  FileImageIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  FileTypeIcon,
  XIcon,
} from "./icons";

// Each kind's icon, and its color: the icon and the tint behind it, and the format badge.
const KINDS: Record<
  AttachmentKind,
  { Icon: (props: { className?: string }) => React.ReactNode; tint: string; badge: string }
> = {
  image: {
    Icon: FileImageIcon,
    tint: "bg-sky-500/10 text-sky-600 dark:bg-sky-400/15 dark:text-sky-400",
    badge: "bg-sky-600 dark:bg-sky-500",
  },
  pdf: {
    Icon: FileTextIcon,
    tint: "bg-red-500/10 text-red-600 dark:bg-red-400/15 dark:text-red-400",
    badge: "bg-red-600 dark:bg-red-500",
  },
  doc: {
    Icon: FileTypeIcon,
    tint: "bg-blue-500/10 text-blue-600 dark:bg-blue-400/15 dark:text-blue-400",
    badge: "bg-blue-600 dark:bg-blue-500",
  },
  sheet: {
    Icon: FileSpreadsheetIcon,
    tint: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400",
    badge: "bg-emerald-600 dark:bg-emerald-500",
  },
  slides: {
    Icon: FileChartPieIcon,
    tint: "bg-orange-500/10 text-orange-600 dark:bg-orange-400/15 dark:text-orange-400",
    badge: "bg-orange-600 dark:bg-orange-500",
  },
  code: {
    Icon: FileCodeIcon,
    tint: "bg-brand-violet/10 text-brand-violet dark:bg-brand-violet/20 dark:text-violet-300",
    badge: "bg-brand-violet",
  },
  text: {
    Icon: FileTextIcon,
    tint: "bg-zinc-500/10 text-zinc-600 dark:bg-zinc-400/15 dark:text-zinc-300",
    badge: "bg-zinc-600 dark:bg-zinc-500",
  },
};

/*
 * An attached file as a square tile, the same size whatever it is. An image shows itself and opens
 * full size (onView). Other files show their kind's icon, the format and the name. onRemove adds an X
 * at the top right: with a mouse or trackpad only on hover or focus, always on touch screens.
 */
export function AttachmentTile({
  attachment,
  onView,
  onRemove,
}: {
  attachment: Attachment;
  onView?: () => void;
  onRemove?: () => void;
}) {
  // An image the browser can't show (e.g. HEIC outside Safari) shows as a file instead.
  const [broken, setBroken] = useState(false);
  const image = attachment.kind === "image" && !broken;

  return (
    <div className="group/tile relative size-20 shrink-0">
      {image ? (
        <button
          type="button"
          aria-label={`View ${attachment.name}`}
          onClick={onView}
          className="block size-full overflow-hidden rounded-2xl border border-zinc-950/10 bg-zinc-950/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:border-white/10 dark:bg-white/5"
        >
          {/* biome-ignore lint/performance/noImgElement: a local blob URL, which next/image can't optimize */}
          <img
            src={attachment.url}
            alt=""
            draggable={false}
            onError={() => setBroken(true)}
            className="size-full object-cover"
          />
        </button>
      ) : (
        <FileFace attachment={attachment} />
      )}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${attachment.name}`}
          data-tooltip="Remove"
          onClick={onRemove}
          className="absolute -top-1.5 -right-1.5 grid size-6 place-items-center rounded-full bg-zinc-900 text-white shadow-md ring-2 ring-white transition-[opacity,background-color] duration-150 hover:bg-zinc-700 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet pointer-fine:opacity-0 pointer-fine:group-hover/tile:opacity-100 dark:bg-zinc-100 dark:text-zinc-900 dark:ring-zinc-900 dark:hover:bg-white"
        >
          <XIcon className="size-3.5" />
        </button>
      )}
    </div>
  );
}

// The extension is in the badge, so the name goes without it.
function baseName(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function FileFace({ attachment }: { attachment: Attachment }) {
  const { Icon, tint, badge } = KINDS[attachment.kind];
  return (
    <div
      role="img"
      aria-label={attachment.name}
      data-tooltip={attachment.name}
      className={`flex size-full flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl border border-zinc-950/10 px-2 dark:border-white/10 ${tint}`}
    >
      <Icon className="size-6 shrink-0" />
      <span
        className={`rounded px-1 py-px text-[10px]/3 font-semibold tracking-wide text-white ${badge}`}
      >
        {formatLabel(attachment)}
      </span>
      {/* Left-aligned once it overflows (safe), fading out at the end. */}
      <span className="flex w-full justify-center-safe overflow-hidden [mask-image:linear-gradient(to_right,#000_calc(100%-0.75rem),transparent)]">
        <span className="text-[11px]/4 whitespace-nowrap text-zinc-700 dark:text-zinc-200">
          {baseName(attachment.name)}
        </span>
      </span>
    </div>
  );
}
