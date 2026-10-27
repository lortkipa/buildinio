import { useRef } from "react";
import type { MouseEvent, PointerEvent, RefObject } from "react";

function isOutside(dialog: HTMLDialogElement, x: number, y: number) {
  const box = dialog.getBoundingClientRect();
  return x < box.left || x > box.right || y < box.top || y > box.bottom;
}

/**
 * Closes a modal `<dialog>` on a click on the backdrop, like its Cancel button.
 * Backdrop clicks land on the dialog itself (so do clicks on its padding), hence
 * the check against its box. Only when the press started outside too, so dragging
 * a text selection out of a field doesn't close it.
 */
export function useCloseOnBackdrop(ref: RefObject<HTMLDialogElement | null>) {
  const pressedOutside = useRef(false);
  return {
    onPointerDown: (event: PointerEvent<HTMLDialogElement>) => {
      pressedOutside.current =
        event.target === event.currentTarget && isOutside(event.currentTarget, event.clientX, event.clientY);
    },
    onClick: (event: MouseEvent<HTMLDialogElement>) => {
      const outside =
        event.target === event.currentTarget && isOutside(event.currentTarget, event.clientX, event.clientY);
      if (outside && pressedOutside.current) ref.current?.close();
      pressedOutside.current = false;
    },
  };
}
