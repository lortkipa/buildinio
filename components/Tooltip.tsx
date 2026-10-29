"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, PointerEvent, ReactNode } from "react";
import { createPortal } from "react-dom";

type Side = "top" | "bottom" | "right";

const DELAY_MS = 500; // Hovering this long shows it.
const SKIP_MS = 300; // Moving on to the next button within this long shows its tooltip at once.
const GAP = 8; // Between the button and the tooltip.
const EDGE = 8; // Kept this far inside the screen.

// It slides in from the button's side.
const FROM: Record<Side, { x: string; y: string; origin: string }> = {
  top: { x: "0", y: "3px", origin: "bottom" },
  bottom: { x: "0", y: "-3px", origin: "top" },
  right: { x: "-3px", y: "0", origin: "left" },
};

let lastHiddenAt = 0;

type TooltipProps = {
  label: string | null; // Null: no tooltip, like when the label already shows.
  keys?: string[]; // A keyboard shortcut, shown after the label. "Mod" is ⌘ on Apple's computers, Ctrl elsewhere.
  side?: Side; // Flips to the other side when there's no room.
  children: ReactNode; // The button.
};

/**
 * A small label for an icon button: after a moment's hover with a mouse, or at once on
 * keyboard focus. Not on touch screens, while the button's menu is open, or once pressed.
 * Only what it looks like: the button keeps its own `aria-label`.
 */
export function Tooltip({ label, keys, side = "bottom", children }: TooltipProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null); // Set while it shows.
  const pressed = useRef(false); // Pressed since the pointer came in: no tooltip until it leaves.

  function cancel() {
    window.clearTimeout(timer.current);
    timer.current = undefined;
  }

  function hide() {
    cancel();
    if (trigger) lastHiddenAt = Date.now();
    setTrigger(null);
  }

  function button() {
    const element = wrapRef.current?.firstElementChild;
    if (!(element instanceof HTMLElement) || !label) return null;
    // Its menu or pop-up says more; an inert button is swapped out (see PromptBox).
    if (element.getAttribute("aria-expanded") === "true" || element.closest("[inert]")) return null;
    return element;
  }

  function handlePointerOver(event: PointerEvent) {
    if (event.pointerType !== "mouse" || pressed.current || trigger || timer.current !== undefined) return;
    const element = button();
    if (!element) return;
    const wait = Date.now() - lastHiddenAt < SKIP_MS ? 0 : DELAY_MS;
    timer.current = window.setTimeout(() => {
      timer.current = undefined;
      setTrigger(button());
    }, wait);
  }

  function handlePointerOut(event: PointerEvent) {
    if (wrapRef.current?.contains(event.relatedTarget as Node | null)) return;
    pressed.current = false;
    hide();
  }

  function handlePointerDown() {
    pressed.current = true;
    hide();
  }

  function handleFocus(event: FocusEvent) {
    const element = button();
    if (element && event.target === element && element.matches(":focus-visible")) {
      cancel();
      setTrigger(element);
    }
  }

  // Hidden pages stay mounted: don't bring it back with them.
  useLayoutEffect(() => () => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    setTrigger(null);
  }, []);

  // Next to the button, on the side asked for if it fits, kept on screen; before paint.
  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!trigger || !tip) return;
    const rect = trigger.getBoundingClientRect();
    const { offsetWidth: width, offsetHeight: height } = tip;
    let at = side;
    if (side === "bottom" && rect.bottom + GAP + height > window.innerHeight - EDGE) at = "top";
    else if (side === "top" && rect.top - GAP - height < EDGE) at = "bottom";
    else if (side === "right" && rect.right + GAP + width > window.innerWidth - EDGE) at = "bottom";
    let left = at === "right" ? rect.right + GAP : rect.left + rect.width / 2 - width / 2;
    let top = at === "right" ? rect.top + rect.height / 2 - height / 2 : at === "top" ? rect.top - GAP - height : rect.bottom + GAP;
    left = Math.max(EDGE, Math.min(left, window.innerWidth - width - EDGE));
    top = Math.max(EDGE, Math.min(top, window.innerHeight - height - EDGE));
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
    tip.style.setProperty("--tip-x", FROM[at].x);
    tip.style.setProperty("--tip-y", FROM[at].y);
    tip.style.transformOrigin = FROM[at].origin;
  }, [trigger, side, label]);

  // Gone on Escape, scrolling, resizing, leaving the window, or when its menu opens or
  // the button is swapped out.
  useEffect(() => {
    if (!trigger) return;
    const close = () => {
      lastHiddenAt = Date.now();
      setTrigger(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const observer = new MutationObserver(() => {
      if (trigger.getAttribute("aria-expanded") === "true" || trigger.closest("[inert]")) close();
    });
    observer.observe(trigger, { attributes: true, attributeFilter: ["aria-expanded", "inert"] });
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
    };
  }, [trigger]);

  return (
    <>
      {/* Takes no room: the button stays where it was in the layout. */}
      <div
        ref={wrapRef}
        className="contents"
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onPointerDownCapture={handlePointerDown}
        onFocus={handleFocus}
        onBlur={hide}
      >
        {children}
      </div>
      {trigger && label && createPortal(
        <div
          ref={tipRef}
          aria-hidden
          data-tooltip
          className="pointer-events-none fixed top-0 left-0 z-60 flex w-max max-w-64 items-center gap-2 rounded-lg bg-tooltip px-2.5 py-1.5 text-xs font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.08),0_8px_24px_-8px_rgb(0_0_0/0.3)] select-none motion-safe:animate-tip dark:ring-1 dark:ring-white/10"
        >
          <span className="[overflow-wrap:anywhere]">{label}</span>
          {keys && (
            <span className="flex shrink-0 gap-0.5">
              {keys.map((key) => key === "Mod" ? modKey() : key).map((key) => (
                <kbd
                  key={key}
                  className="grid h-4.5 min-w-4.5 place-items-center rounded bg-white/15 px-1 font-sans text-[0.6875rem] leading-none text-white/75"
                >
                  {key}
                </kbd>
              ))}
            </span>
          )}
        </div>,
        // A modal dialog sits in the top layer: inside it, it still shows over it.
        trigger.closest("dialog") ?? document.body,
      )}
    </>
  );
}

function modKey() {
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘" : "Ctrl";
}
