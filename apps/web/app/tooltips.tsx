"use client";

import { useEffect, useRef } from "react";

// How long the pointer rests on an element before its tooltip shows, and how long after one hides
// the next shows right away, when moving along a row of buttons.
const DELAY_MS = 400;
const WARM_MS = 300;
// Space between the element and its tooltip, and the least space kept to the window's edges.
const GAP = 6;
const EDGE = 8;

/*
 * Styled tooltips, in place of the browser's (title): any element with data-tooltip shows its text
 * on hover with a mouse or trackpad, or on keyboard focus. Above the element by default, below it
 * when there is no room; data-tooltip-side="right" puts it to the right. The text is only visual,
 * so the element still needs its own aria-label.
 *
 * One popover, in the top layer, so no scrolling or overflow-hidden ancestor clips it. Mounted once
 * in the root layout.
 */
export function Tooltips() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const tip: HTMLDivElement = ref.current;

    let target: HTMLElement | null = null;
    // Clicked: no tooltip until the pointer leaves it, so it doesn't cover what the click shows.
    let pressed: HTMLElement | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let warmUntil = 0;
    // Follows the shown element's text, e.g. the device button's after Enter switches it.
    const observer = new MutationObserver(() => {
      const text = target?.dataset.tooltip;
      if (target && text) {
        tip.textContent = text;
        place(target);
      } else hide();
    });

    function place(element: HTMLElement) {
      const box = element.getBoundingClientRect();
      const { offsetWidth: width, offsetHeight: height } = tip;
      let left: number;
      let top: number;
      if (element.dataset.tooltipSide === "right") {
        left = box.right + GAP;
        top = box.top + (box.height - height) / 2;
      } else {
        left = box.left + (box.width - width) / 2;
        top = box.top - GAP - height;
        if (top < EDGE) top = box.bottom + GAP;
      }
      const maxLeft = window.innerWidth - width - EDGE;
      tip.style.left = `${Math.max(EDGE, Math.min(left, maxLeft))}px`;
      tip.style.top = `${top}px`;
    }

    function show(element: HTMLElement) {
      const text = element.dataset.tooltip;
      if (!text || !element.isConnected) return;
      target = element;
      tip.textContent = text;
      tip.showPopover();
      place(element);
      observer.observe(element, { attributeFilter: ["data-tooltip"] });
    }

    function schedule(element: HTMLElement, now: boolean) {
      clearTimeout(timer);
      if (now || performance.now() < warmUntil) show(element);
      else timer = setTimeout(() => show(element), DELAY_MS);
      target = element;
    }

    function hide() {
      clearTimeout(timer);
      if (tip.matches(":popover-open")) {
        tip.hidePopover();
        warmUntil = performance.now() + WARM_MS;
      }
      observer.disconnect();
      target = null;
    }

    const owner = (node: EventTarget | null) =>
      node instanceof Element ? node.closest<HTMLElement>("[data-tooltip]") : null;

    function handlePointerOver(event: PointerEvent) {
      if (event.pointerType !== "mouse") return;
      const element = owner(event.target);
      if (element === target) return;
      hide();
      if (element && element !== pressed) schedule(element, false);
    }

    function handlePointerOut(event: PointerEvent) {
      const element = owner(event.target);
      if (!element || element.contains(event.relatedTarget as Node | null)) return;
      if (element === pressed) pressed = null;
      if (element === target) hide();
    }

    function handlePointerDown() {
      pressed = target;
      hide();
    }

    function handleFocusIn(event: FocusEvent) {
      const element = owner(event.target);
      if (element && element === event.target && element.matches(":focus-visible")) {
        schedule(element, true);
      }
    }

    function handleFocusOut(event: FocusEvent) {
      if (event.target === target) hide();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") hide();
    }

    const options = { capture: true, passive: true };
    document.addEventListener("pointerover", handlePointerOver, options);
    document.addEventListener("pointerout", handlePointerOut, options);
    document.addEventListener("pointerdown", handlePointerDown, options);
    document.addEventListener("focusin", handleFocusIn, options);
    document.addEventListener("focusout", handleFocusOut, options);
    document.addEventListener("keydown", handleKeyDown, options);
    document.addEventListener("scroll", hide, options);
    window.addEventListener("resize", hide);
    return () => {
      hide();
      document.removeEventListener("pointerover", handlePointerOver, options);
      document.removeEventListener("pointerout", handlePointerOut, options);
      document.removeEventListener("pointerdown", handlePointerDown, options);
      document.removeEventListener("focusin", handleFocusIn, options);
      document.removeEventListener("focusout", handleFocusOut, options);
      document.removeEventListener("keydown", handleKeyDown, options);
      document.removeEventListener("scroll", hide, options);
      window.removeEventListener("resize", hide);
    };
  }, []);

  return (
    <div
      ref={ref}
      popover="manual"
      aria-hidden
      className="pointer-events-none fixed inset-auto m-0 overflow-visible rounded-lg border-0 bg-zinc-950 px-2 py-1 text-xs font-medium whitespace-nowrap text-white shadow-md transition-[opacity,scale] duration-150 ease-out motion-reduce:transition-none starting:scale-95 starting:opacity-0 dark:bg-white dark:text-zinc-950"
    />
  );
}
