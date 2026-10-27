"use client";

import { useEffect, useId, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2 } from "lucide-react";
import { dialogButton, dialogPanel, menuItem, menuPanel } from "@/components/styles";
import { useCloseOnBackdrop } from "@/components/useCloseOnBackdrop";
import type { Project } from "@/lib/projects/types";

const EDGE = 8; // px the menu keeps from the edges of the screen.

type Rect = { left: number; right: number; top: number; bottom: number };

/** Under a button, or at the pointer for a right-click. */
export type ProjectMenuAnchor = { rect: Rect; from: "button" | "point"; align?: "center" };

type ProjectMenuProps = {
  anchor: ProjectMenuAnchor;
  trigger: HTMLElement | null; // The options button, to toggle and to get focus back.
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/** Edit and Delete, floating over everything next to where it was opened. */
export function ProjectMenu({ anchor, trigger, onClose, onEdit, onDelete }: ProjectMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Below the anchor, or above if there's no room; kept on screen. Then focus moves in.
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const { rect, from, align } = anchor;
    const gap = from === "button" ? 4 : 0;
    const fitsBelow = rect.bottom + gap + height <= window.innerHeight - EDGE;
    const top = fitsBelow ? rect.bottom + gap : rect.top - gap - height;
    const left = align === "center" ? (rect.left + rect.right - width) / 2 : from === "button" ? rect.right - width : rect.left;
    menu.style.top = `${clamp(top, EDGE, window.innerHeight - height - EDGE)}px`;
    menu.style.left = `${clamp(left, EDGE, window.innerWidth - width - EDGE)}px`;
    menu.style.transformOrigin = `${align === "center" ? "center" : from === "button" ? "right" : "left"} ${fitsBelow ? "top" : "bottom"}`;
    menu.querySelector("button")?.focus();
  }, [anchor]);

  // Close on a click outside, Escape, scrolling or resizing. Arrow keys move between the items.
  useEffect(() => {
    const onPointerDown = (event: globalThis.PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !trigger?.contains(target)) onClose();
    };
    // Captured and marked handled, so the phone sidebar around it stays open.
    const onKeyDown = (event: KeyboardEvent) => {
      const items = Array.from(ref.current?.querySelectorAll("button") ?? []);
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        onClose();
        trigger?.focus();
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const step = event.key === "ArrowDown" ? 1 : -1;
        items[(index + step + items.length) % items.length]?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose, trigger]);

  // Out of the scrolling list, so it isn't cut off. Inside the phone sidebar while it's
  // open, which covers the screen, so it stays part of it.
  const container = trigger?.closest<HTMLElement>("[role=dialog]") ?? document.body;
  return createPortal(
    <div ref={ref} role="menu" aria-label="Project" className={`fixed top-0 left-0 z-50 w-44 ${menuPanel}`}>
      <button type="button" role="menuitem" onClick={onEdit} className={`${menuItem} text-foreground`}>
        <Pencil size={16} />
        Edit
      </button>
      <button type="button" role="menuitem" onClick={onDelete} className={`${menuItem} text-error`}>
        <Trash2 size={16} />
        Delete
      </button>
    </div>,
    container,
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

type DeleteProjectDialogProps = {
  project: Project;
  onDelete: () => void;
  onClose: () => void;
};

/** Asks before deleting, like deleting the account does. */
export function DeleteProjectDialog({ project, onDelete, onClose }: DeleteProjectDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const backdrop = useCloseOnBackdrop(ref);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-text`}
      onClose={onClose}
      {...backdrop}
      className={`max-w-sm ${dialogPanel}`}
    >
      <h2 id={`${id}-title`} className="text-lg font-semibold tracking-[-0.01em] wrap-anywhere">
        Delete {project.name ? <>&ldquo;{project.name}&rdquo;</> : "this project"}?
      </h2>
      <p id={`${id}-text`} className="mt-2 text-sm text-balance text-muted">
        This permanently deletes the project and its chat. It can&rsquo;t be undone.
      </p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
        <button
          type="button"
          autoFocus
          onClick={() => ref.current?.close()}
          className={`${dialogButton} border border-border bg-surface enabled:hover:border-foreground/25`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onDelete}
          className={`${dialogButton} bg-error text-background enabled:hover:bg-error/85`}
        >
          Delete project
        </button>
      </div>
    </dialog>
  );
}

