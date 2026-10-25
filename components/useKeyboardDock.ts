import { useEffect, useState } from "react";
import type { RefObject } from "react";

// Keyboard docking on phones (px).
const KEYBOARD_MIN = 120; // Viewport the keyboard must cover to count as open.
export const DOCK_GAP = 8; // Space between the box and the keyboard.
export const DOCK_SIDE = 12; // Space on the left and right.
export const DOCK_CHROME = 80; // Toolbar, padding and a top margin, kept out of the text's max height.

/** Where things go while the phone keyboard is open, in layout viewport coordinates. */
export type Dock = {
  keyboardTop: number; // Top edge of the keyboard.
  visibleTop: number; // Top of what's visible, below the header if it's on screen.
  visibleHeight: number;
  keptHeight: number; // Height the hero had in the page, kept so the layout doesn't jump.
};

/**
 * On phones, reports where the visible area is while `textareaRef` is focused and
 * the on-screen keyboard is open, or null otherwise. The keyboard only shrinks the
 * visual viewport (and the browser may scroll it), so positions come from that.
 */
export function useKeyboardDock(
  textareaRef: RefObject<HTMLTextAreaElement | null>,
  keepRef: RefObject<HTMLElement | null>,
) {
  const [dock, setDock] = useState<Dock | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    const textarea = textareaRef.current;
    if (!viewport || !textarea || !window.matchMedia("(pointer: coarse)").matches) return;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // Multiplying by scale keeps pinch-zoom from looking like a keyboard.
        const keyboard =
          document.documentElement.clientHeight - viewport.height * viewport.scale;
        if (document.activeElement !== textarea || keyboard < KEYBOARD_MIN) {
          setDock(null);
          return;
        }
        const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
        setDock((current) => ({
          keyboardTop: viewport.offsetTop + viewport.height,
          visibleTop: Math.max(viewport.offsetTop, headerBottom),
          visibleHeight: viewport.height,
          keptHeight: current?.keptHeight ?? keepRef.current?.offsetHeight ?? 0,
        }));
      });
    };

    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    textarea.addEventListener("focus", update);
    textarea.addEventListener("blur", update);
    return () => {
      cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      textarea.removeEventListener("focus", update);
      textarea.removeEventListener("blur", update);
    };
  }, [textareaRef, keepRef]);

  return dock;
}
