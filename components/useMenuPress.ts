import { useEffect, useRef } from "react";
import type { MouseEvent, PointerEvent, RefObject } from "react";
import type { ProjectMenuAnchor } from "@/components/ProjectActions";

const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP = 10; // px a finger can move and still count as holding.

/**
 * A project row's link that opens its options menu on a right-click (at the pointer),
 * or when a finger holds it (under the options button, `buttonRef`). Spread `handlers`
 * on the link; `onClick` runs for a click that isn't the end of a long press.
 */
export function useMenuPress(
  buttonRef: RefObject<HTMLButtonElement | null>,
  onMenu: (anchor: ProjectMenuAnchor, trigger: HTMLElement | null) => void,
  onClick?: () => void,
) {
  const press = useRef<{ x: number; y: number; timer: number } | null>(null);
  const longPressed = useRef(false); // So the tap that ends a long press doesn't open the project.

  useEffect(() => {
    return () => {
      if (press.current) window.clearTimeout(press.current.timer);
    };
  }, []);

  function openFromButton() {
    const button = buttonRef.current;
    if (button) onMenu({ rect: button.getBoundingClientRect(), from: "button" }, button);
  }

  function cancelPress() {
    if (!press.current) return;
    window.clearTimeout(press.current.timer);
    press.current = null;
  }

  function handlePointerDown(event: PointerEvent) {
    longPressed.current = false;
    if (event.pointerType === "mouse") return;
    cancelPress();
    const timer = window.setTimeout(() => {
      press.current = null;
      longPressed.current = true;
      navigator.vibrate?.(10);
      openFromButton();
    }, LONG_PRESS_MS);
    press.current = { x: event.clientX, y: event.clientY, timer };
  }

  function handlePointerMove(event: PointerEvent) {
    const start = press.current;
    if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > LONG_PRESS_SLOP) {
      cancelPress();
    }
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    // Android also fires this for a long press: open it once, under the button.
    if (longPressed.current) return;
    if (press.current) {
      cancelPress();
      longPressed.current = true;
      openFromButton();
      return;
    }
    const { clientX: x, clientY: y } = event;
    onMenu({ rect: { left: x, right: x, top: y, bottom: y }, from: "point" }, buttonRef.current);
  }

  function handleClick(event: MouseEvent) {
    if (longPressed.current) {
      event.preventDefault();
      longPressed.current = false;
      return;
    }
    onClick?.();
  }

  return {
    openFromButton,
    handlers: {
      onClick: handleClick,
      onContextMenu: handleContextMenu,
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: cancelPress,
      onPointerCancel: cancelPress,
    },
  };
}
