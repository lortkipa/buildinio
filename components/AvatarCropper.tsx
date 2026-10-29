"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { LoaderCircle, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import { dialogButton, focusRing } from "@/components/styles";
import { AVATAR_PIXELS } from "@/lib/account/options";
import { uploadAvatar } from "@/lib/account/store";

const STAGE = 288; // px: the square the photo moves in.
const CIRCLE = 256; // px: what becomes the avatar, in the middle of it.
const MAX_ZOOM = 4;
const KEY_STEP = 8; // px per arrow key press.

type View = { zoom: number; x: number; y: number }; // x and y: the photo's center from the stage's, in px.
type Size = { width: number; height: number };

type AvatarCropperProps = {
  src: string; // The picked file, as an object URL.
  onDone: () => void; // Cancelled, or uploaded.
};

/** Pick which part of a photo becomes the avatar: drag it around, zoom with the slider, wheel or pinch. */
export function AvatarCropper({ src, onDone }: AvatarCropperProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<Size | null>(null); // The photo's own size, once it's loaded.
  const [view, setView] = useState<View>({ zoom: 1, x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  // At zoom 1 the photo's shorter side just fills the circle.
  const scale = size ? (CIRCLE / Math.min(size.width, size.height)) * view.zoom : 1;

  /** Keeps the circle covered by the photo. */
  function settle(next: View): View {
    if (!size) return next;
    const zoom = Math.min(Math.max(next.zoom, 1), MAX_ZOOM);
    const s = (CIRCLE / Math.min(size.width, size.height)) * zoom;
    const maxX = (size.width * s - CIRCLE) / 2;
    const maxY = (size.height * s - CIRCLE) / 2;
    return { zoom, x: clamp(next.x, -maxX, maxX), y: clamp(next.y, -maxY, maxY) };
  }

  const settleRef = useRef(settle);
  useEffect(() => {
    settleRef.current = settle;
  });

  // The wheel zooms. Not through React: its wheel events can't stop the dialog from scrolling.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      setView((current) => settleRef.current({ ...current, zoom: current.zoom * Math.exp(-event.deltaY * 0.002) }));
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinch.current = null;
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const last = pointers.current.get(event.pointerId);
    if (!last) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      setView((current) => settle({ ...current, x: current.x + dx, y: current.y + dy }));
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (!pinch.current) pinch.current = { distance, zoom: view.zoom };
      const { distance: start, zoom } = pinch.current;
      setView((current) => settle({ ...current, zoom: (zoom * distance) / start }));
    }
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(event.pointerId);
    pinch.current = null;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, Partial<View>> = {
      ArrowLeft: { x: view.x - KEY_STEP },
      ArrowRight: { x: view.x + KEY_STEP },
      ArrowUp: { y: view.y - KEY_STEP },
      ArrowDown: { y: view.y + KEY_STEP },
      "+": { zoom: view.zoom * 1.1 },
      "=": { zoom: view.zoom * 1.1 },
      "-": { zoom: view.zoom / 1.1 },
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setView(settle({ ...view, ...move }));
  }

  async function handleSave() {
    const image = imageRef.current;
    if (!image || !size || saving) return;
    setSaving(true);
    const picture = await crop(image, size, view, scale);
    if (picture && (await uploadAvatar(picture))) {
      onDone();
      return;
    }
    if (!picture) toast.error("Couldn’t crop that picture. Try another one.");
    setSaving(false);
  }

  return (
    <div className="flex flex-col items-center">
      <div
        ref={stageRef}
        role="img"
        aria-label="Your photo. Drag or use the arrow keys to move it."
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        style={{ width: STAGE, height: STAGE }}
        className={`relative shrink-0 cursor-grab touch-none overflow-hidden rounded-3xl bg-foreground/5 select-none active:cursor-grabbing ${focusRing}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- A local object URL, drawn onto a canvas when saved. */}
        <img
          ref={imageRef}
          src={src}
          alt=""
          draggable={false}
          onLoad={(event) => {
            const { naturalWidth: width, naturalHeight: height } = event.currentTarget;
            setSize({ width, height });
          }}
          onError={() => {
            toast.error("Couldn’t open that picture. Try a PNG or JPEG.");
            onDone();
          }}
          style={
            size
              ? {
                  width: size.width * scale,
                  height: size.height * scale,
                  transform: `translate(calc(-50% + ${view.x}px), calc(-50% + ${view.y}px))`,
                }
              : undefined
          }
          className={`pointer-events-none absolute top-1/2 left-1/2 max-w-none transition-opacity duration-200 ${
            size ? "opacity-100" : "opacity-0"
          }`}
        />
        {/* Darkens what's left out, around the circle. */}
        <div
          aria-hidden
          style={{ width: CIRCLE, height: CIRCLE }}
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-1/2 rounded-full shadow-[0_0_0_999px_rgb(0_0_0/0.55)] ring-2 ring-white/90"
        />
      </div>

      <div className="mt-5 flex w-full max-w-72 items-center gap-3 text-muted">
        <ZoomOut aria-hidden size={18} className="shrink-0" />
        <input
          type="range"
          aria-label="Zoom"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={view.zoom}
          onChange={(event) => setView(settle({ ...view, zoom: Number(event.target.value) }))}
          className="h-1.5 w-full cursor-pointer accent-foreground"
        />
        <ZoomIn aria-hidden size={18} className="shrink-0" />
      </div>

      {/* Side by side on phones too, so both stay in view under the photo. */}
      <div className="mt-6 flex w-full gap-3 *:flex-1">
        <button
          type="button"
          onClick={onDone}
          disabled={saving}
          className={`${dialogButton} border border-border bg-surface enabled:hover:border-foreground/25`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!size || saving}
          className={`${dialogButton} bg-foreground text-background enabled:hover:bg-foreground/85`}
        >
          {saving && <LoaderCircle size={16} className="motion-safe:animate-spin" />}
          Save photo
        </button>
      </div>
    </div>
  );
}

/** What's in the circle, as a small square picture: WebP, or JPEG where the browser can't make WebP. */
async function crop(image: HTMLImageElement, size: Size, view: View, scale: number) {
  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_PIXELS;
  canvas.height = AVATAR_PIXELS;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const side = CIRCLE / scale; // In the photo's own pixels.
  const left = size.width / 2 - (view.x + CIRCLE / 2) / scale;
  const top = size.height / 2 - (view.y + CIRCLE / 2) / scale;
  const draw = (background?: string) => {
    if (background) {
      context.fillStyle = background;
      context.fillRect(0, 0, AVATAR_PIXELS, AVATAR_PIXELS);
    }
    context.imageSmoothingQuality = "high";
    context.drawImage(image, left, top, side, side, 0, 0, AVATAR_PIXELS, AVATAR_PIXELS);
  };
  draw();
  const webp = await toBlob(canvas, "image/webp");
  if (webp?.type === "image/webp") return webp;
  draw("#ffffff"); // JPEG has no transparency.
  return toBlob(canvas, "image/jpeg");
}

function toBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.9));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
