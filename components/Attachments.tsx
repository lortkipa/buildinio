"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { createPortal } from "react-dom";
import {
  File,
  FileArchive,
  FileCode,
  FileImage,
  FileMusic,
  FileSpreadsheet,
  FileText,
  FileType,
  FileVideoCamera,
  LoaderCircle,
  Presentation,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { focusRing } from "@/components/styles";
import { usePlayOnce } from "@/components/usePlayOnce";
import { useScrollEdges } from "@/components/useScrollEdges";
import { attachmentUrl, extension, fileKind, isPicture, KIND_COLORS } from "@/lib/projects/attachments";
import type { FileKind } from "@/lib/projects/attachments";
import { PROJECT_COLORS } from "@/lib/projects/options";
import type { Attachment } from "@/lib/projects/types";

// Files attached to prompts: tiles in the prompt box and over the prompts in the chat,
// all the same size. Pictures show themselves and open full screen; documents show
// their kind (an icon in its color) and extension.

const KIND_ICONS: Record<FileKind, LucideIcon> = {
  pdf: FileText,
  doc: FileType,
  sheet: FileSpreadsheet,
  slides: Presentation,
  text: FileText,
  code: FileCode,
  archive: FileArchive,
  audio: FileMusic,
  video: FileVideoCamera,
  image: FileImage,
  other: File,
};

type TileFile = Pick<Attachment, "name" | "type" | "size">;

type TileProps = {
  file: TileFile;
  src?: string; // The picture: a preview made here, or its address.
  uploading?: boolean;
  appear?: boolean; // Just added: it pops in.
  onOpen?: () => void; // Shows the picture full screen.
  href?: string; // Where a document downloads from.
  onRemove?: () => void; // The X, in the prompt box.
};

const tileFace = "block size-full overflow-hidden rounded-2xl border border-border bg-surface";

/** One file, as a 96px square. */
export function AttachmentTile({ file, src, uploading = false, appear = false, onOpen, href, onRemove }: TileProps) {
  const [broken, setBroken] = useState(false); // A picture the browser can't show is shown as a document.
  const enter = usePlayOnce("motion-safe:animate-pop", appear);
  const picture = src !== undefined && isPicture(file.type) && !broken;

  const face = picture ? (
    // eslint-disable-next-line @next/next/no-img-element -- A file of the user's, not a page image to optimize.
    <img
      src={src}
      alt={file.name}
      draggable={false}
      onError={() => setBroken(true)}
      className="size-full object-cover"
    />
  ) : (
    <DocumentFace file={file} />
  );

  return (
    <div
      onAnimationEnd={enter.onAnimationEnd}
      className={`group/tile relative size-24 shrink-0 ${enter.className}`}
    >
      {picture && onOpen ? (
        <button
          type="button"
          aria-label={`View ${file.name}`}
          onClick={onOpen}
          className={`${tileFace} cursor-zoom-in ${focusRing}`}
        >
          {face}
        </button>
      ) : !picture && href ? (
        <a href={href} download={file.name} aria-label={`Download ${file.name}`} className={`${tileFace} ${focusRing}`}>
          {face}
        </a>
      ) : (
        <div className={tileFace}>{face}</div>
      )}

      {uploading && (
        <div className="absolute inset-0 grid place-items-center rounded-2xl bg-surface/60" role="status" aria-label={`Uploading ${file.name}`}>
          <LoaderCircle size={20} className="text-foreground/70 motion-safe:animate-spin" />
        </div>
      )}

      {/* Shows on hover with a mouse, and always on touch screens. */}
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${file.name}`}
          onClick={onRemove}
          className={`absolute top-1.5 right-1.5 grid size-6 cursor-pointer place-items-center rounded-full bg-black/60 text-white shadow-sm backdrop-blur-sm transition hover:bg-black/80 pointer-fine:opacity-0 pointer-fine:group-hover/tile:opacity-100 pointer-fine:focus-visible:opacity-100 ${focusRing}`}
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}

/** A document: its kind's icon in its color at the top left (the X takes the right), the name and extension under it. */
function DocumentFace({ file }: { file: TileFile }) {
  const kind = fileKind(file.name, file.type);
  const Icon = KIND_ICONS[kind];
  const ext = extension(file.name);
  return (
    <span
      style={{ "--kind": PROJECT_COLORS[KIND_COLORS[kind]] } as CSSProperties}
      className="flex size-full flex-col justify-between bg-[color-mix(in_srgb,var(--kind)_7%,transparent)] p-2.5 text-left"
    >
      <span className="grid size-8 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--kind)_16%,transparent)] text-(--kind)">
        <Icon size={18} strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="fade-end block text-xs leading-4 font-medium text-foreground">
          {ext ? file.name.slice(0, -ext.length - 1) : file.name}
        </span>
        <span className="block text-[10px] leading-3.5 font-semibold tracking-wide text-(--kind)">
          {ext.toUpperCase() || "FILE"}
        </span>
      </span>
    </span>
  );
}

/** A file in the prompt box, uploading or uploaded. */
export type StripFile = TileFile & { key: string; src?: string; uploading: boolean };

/**
 * The prompt box's files, over the text. One row that scrolls sideways when they don't
 * fit, fading out at the side there's more of.
 */
export function AttachmentStrip({ files, onRemove }: { files: StripFile[]; onRemove: (key: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [viewing, setViewing] = useState<StripFile | null>(null);
  useScrollEdges(ref);

  // Pressing a tile's buttons keeps the focus in the text box, so the phone keyboard stays open.
  function keepFocus(event: MouseEvent) {
    if ((event.target as Element).closest("button")) event.preventDefault();
  }

  return (
    <div
      ref={ref}
      onMouseDown={keepFocus}
      className="fade-x scrollbar-thin overflow-x-auto overscroll-x-contain px-3 pt-3 pb-1"
    >
      <ul aria-label="Attached files" className="flex w-max gap-2">
        {files.map((file) => (
          <li key={file.key}>
            <AttachmentTile
              file={file}
              src={file.src}
              uploading={file.uploading}
              appear
              onOpen={() => setViewing(file)}
              onRemove={() => onRemove(file.key)}
            />
          </li>
        ))}
      </ul>
      {viewing?.src && <ImageViewer src={viewing.src} name={viewing.name} onClose={() => setViewing(null)} />}
    </div>
  );
}

/** A prompt's files in the chat, over its text: on the right, wrapping onto more rows. */
export function MessageAttachments({ files }: { files: Attachment[] }) {
  const [viewing, setViewing] = useState<Attachment | null>(null);
  return (
    <>
      <ul aria-label="Attached files" className="flex flex-wrap justify-end gap-2">
        {files.map((file) => (
          <li key={file.id}>
            <AttachmentTile
              file={file}
              src={attachmentUrl(file.id)}
              href={attachmentUrl(file.id)}
              onOpen={() => setViewing(file)}
            />
          </li>
        ))}
      </ul>
      {viewing && <ImageViewer src={attachmentUrl(viewing.id)} name={viewing.name} onClose={() => setViewing(null)} />}
    </>
  );
}

/**
 * A picture full screen, over everything. The X at the top right, a click anywhere but
 * the picture, or Escape closes it, and the focus goes back to its tile.
 */
export function ImageViewer({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [ratio, setRatio] = useState<number | null>(null); // Width over height, once it's loaded.

  function measure() {
    const image = imageRef.current;
    if (image?.naturalWidth && image.naturalHeight) setRatio(image.naturalWidth / image.naturalHeight);
  }

  useEffect(() => {
    ref.current?.showModal();
    if (imageRef.current?.complete) measure(); // Shown in its tile already, so it may be loaded before React listens.
  }, []);

  return createPortal(
    <dialog
      ref={ref}
      aria-label={name}
      onClose={onClose}
      onClick={(event) => {
        if (event.target !== imageRef.current) ref.current?.close();
      }}
      className="m-0 size-full max-h-none max-w-none overflow-hidden bg-transparent p-0 text-white backdrop:bg-black/90 backdrop:backdrop-blur-md open:motion-safe:animate-fade backdrop:motion-safe:animate-fade"
    >
      {/* As big as the screen has room for, small pictures too, keeping its shape. The
          container's own size (cqw, cqh) is the room it has. */}
      <div className="size-full px-4 pt-16 pb-8 sm:px-16 sm:pb-16">
        <div style={{ containerType: "size" }} className="grid size-full place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- A file of the user's, not a page image to optimize. */}
          <img
            ref={imageRef}
            src={src}
            alt={name}
            onLoad={measure}
            style={ratio ? { width: `min(100cqw, ${ratio} * 100cqh)`, aspectRatio: ratio } : undefined}
            className={`rounded-xl object-contain shadow-[0_24px_64px_-16px_rgb(0_0_0/0.6)] motion-safe:animate-zoom ${
              ratio ? "" : "max-h-full max-w-full"
            }`}
          />
        </div>
      </div>
      <p className="fade-end absolute top-5 right-18 left-5 text-sm font-medium text-white/80">{name}</p>
      <button
        type="button"
        aria-label="Close"
        onClick={() => ref.current?.close()}
        className="absolute top-3 right-3 grid size-10 cursor-pointer place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <X size={20} />
      </button>
    </dialog>,
    document.body,
  );
}
