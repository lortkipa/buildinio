import { useEffect } from "react";
import type { RefObject } from "react";
import { flushSync } from "react-dom";

const SLOP = 10; // px a finger moves before it counts as a swipe one way or the other.
const SHARE = 1 / 3; // Of the sheet's width: let go past this and it finishes.
const FLICK = 0.4; // px/ms: a quick flick finishes it too, however short.
const FLICK_MS = 100; // How far back the flick's speed is measured.

/**
 * On phones, a sheet that comes in from the right (like the preview) follows a
 * sideways swipe: left on `areaRef` drags it in while it's closed, right on the sheet
 * drags it back out while it's open. Let go far enough, or with a flick, and it
 * finishes; otherwise it springs back. Up and down still scroll: give both elements
 * `touch-pan-y touch-pinch-zoom` so the browser leaves sideways moves to this.
 */
export function useSwipeSheet(
  areaRef: RefObject<HTMLElement | null>,
  sheetRef: RefObject<HTMLElement | null>,
  open: boolean,
  onToggle: (open: boolean) => void,
) {
  useEffect(() => {
    const target = open ? sheetRef.current : areaRef.current;
    const sheet = sheetRef.current;
    if (!target || !sheet) return;

    let start: { id: number; x: number; y: number } | null = null;
    let dragging = false;
    let samples: { x: number; t: number }[] = [];

    // Back to what the classes say, so the CSS transition takes it from where the finger left it.
    const release = () => {
      sheet.style.transition = "";
      sheet.style.translate = "";
      sheet.style.visibility = "";
      start = null;
      dragging = false;
      samples = [];
    };

    const onDown = (event: PointerEvent) => {
      if (event.pointerType !== "touch" || !event.isPrimary) return;
      if (window.matchMedia("(min-width: 48rem)").matches) return;
      if (event.target instanceof Element && event.target.closest("textarea, input, [contenteditable]")) return;
      // Code and tables that are wider than the screen scroll sideways instead.
      const wide = event.target instanceof Element ? event.target.closest("[data-scroll-x]") : null;
      if (wide && wide.scrollWidth > wide.clientWidth) return;
      start = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };

    const onMove = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      if (!dragging) {
        if (Math.abs(dx) < SLOP && Math.abs(dy) < SLOP) return;
        // Only sideways, and only the way the sheet goes: left to open, right to close.
        if (Math.abs(dx) <= Math.abs(dy) || (open ? dx < 0 : dx > 0)) {
          start = null;
          return;
        }
        dragging = true;
        sheet.style.transition = "none";
        sheet.style.visibility = "visible";
      }
      const width = sheet.offsetWidth;
      const offset = open ? dx : width + dx;
      sheet.style.translate = `${Math.min(width, Math.max(0, offset))}px 0`;
      samples = [...samples.filter(({ t }) => event.timeStamp - t < FLICK_MS), { x: event.clientX, t: event.timeStamp }];
    };

    const onUp = (event: PointerEvent) => {
      if (!start || event.pointerId !== start.id) return;
      if (!dragging) {
        start = null;
        return;
      }
      const moved = (event.clientX - start.x) * (open ? 1 : -1); // Toward finishing.
      const first = samples[0];
      const last = samples.at(-1);
      const speed = first && last && last.t > first.t ? ((last.x - first.x) / (last.t - first.t)) * (open ? 1 : -1) : 0;
      if (moved > sheet.offsetWidth * SHARE || speed > FLICK) {
        // Change state first, so the classes already say where it's going when the inline styles go.
        flushSync(() => onToggle(!open));
      }
      release();
    };

    target.addEventListener("pointerdown", onDown);
    target.addEventListener("pointermove", onMove);
    target.addEventListener("pointerup", onUp);
    target.addEventListener("pointercancel", release);
    return () => {
      target.removeEventListener("pointerdown", onDown);
      target.removeEventListener("pointermove", onMove);
      target.removeEventListener("pointerup", onUp);
      target.removeEventListener("pointercancel", release);
      if (dragging) release();
    };
  }, [areaRef, sheetRef, open, onToggle]);
}
