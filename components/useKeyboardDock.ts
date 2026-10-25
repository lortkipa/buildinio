import { useEffect, useState } from "react";
import type { RefObject } from "react";

// Keyboard docking on phones (px).
const KEYBOARD_MIN = 120; // Viewport the keyboard must cover to count as open.
export const DOCK_GAP = 12; // Space between the box and the keyboard.
export const DOCK_CHROME = 80; // Toolbar, padding and a top margin, kept out of the text's max height.

/** Where things go while the phone keyboard is open, in layout viewport coordinates. */
export type Dock = {
  keyboardInset: number; // Distance from the bottom of the page's viewport up to the keyboard.
  visibleTop: number; // Top of what's visible, below the header if it's on screen.
  visibleHeight: number;
  boxLeft: number; // Where the prompt box sits in the page, so docking keeps its width.
  boxWidth: number;
  keptHeight: number; // Height the hero had in the page, kept so the layout doesn't jump.
};

/**
 * On phones, reports where the visible area is while `textareaRef` is focused and
 * the on-screen keyboard is open, or null otherwise. Positions come from the visual
 * viewport, which is what's actually visible above the keyboard.
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

    // Tallest the page has been at this width, i.e. with the keyboard closed. The
    // keyboard shrinks the page itself on Android (see layout.tsx) and only the
    // visual viewport on iOS, so compare against this rather than the current size.
    let fullHeight = 0;
    let fullWidth = 0;

    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const page = document.documentElement;
        if (page.clientWidth !== fullWidth) {
          fullWidth = page.clientWidth; // Rotated: start over.
          fullHeight = 0;
        }
        fullHeight = Math.max(fullHeight, page.clientHeight);
        // Multiplying by scale keeps pinch-zoom from looking like a keyboard.
        const keyboard = fullHeight - viewport.height * viewport.scale;
        if (document.activeElement !== textarea || keyboard < KEYBOARD_MIN) {
          setDock(null);
          return;
        }
        const headerBottom = document.querySelector("header")?.getBoundingClientRect().bottom ?? 0;
        // The form stays in the page while its box is docked, so it keeps the box's place.
        const box = textarea.form?.getBoundingClientRect();
        setDock((current) => ({
          keyboardInset: Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height),
          visibleTop: Math.max(viewport.offsetTop, headerBottom),
          visibleHeight: viewport.height,
          boxLeft: box?.left ?? 0,
          boxWidth: box?.width ?? page.clientWidth,
          keptHeight: current?.keptHeight ?? keepRef.current?.offsetHeight ?? 0,
        }));
      });
    };

    update(); // Record the full height while the keyboard is still closed.
    window.addEventListener("resize", update);
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    textarea.addEventListener("focus", update);
    textarea.addEventListener("blur", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      textarea.removeEventListener("focus", update);
      textarea.removeEventListener("blur", update);
    };
  }, [textareaRef, keepRef]);

  return dock;
}
