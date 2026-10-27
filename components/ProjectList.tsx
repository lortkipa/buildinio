"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, PointerEvent } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Ellipsis, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { isListed, ProjectLabel } from "@/components/ProjectTile";
import { dialogButton, dialogPanel, focusRing, menuItem, menuPanel, navItem } from "@/components/styles";
import { useCloseOnBackdrop } from "@/components/useCloseOnBackdrop";
import { usePlayOnce } from "@/components/usePlayOnce";
import { useScrollEdges } from "@/components/useScrollEdges";
import { deleteProject, isNew, useProjects } from "@/lib/projects/store";
import type { Project } from "@/lib/projects/types";

const LONG_PRESS_MS = 500;
const LONG_PRESS_SLOP = 10; // px a finger can move and still count as holding.
const EDGE = 8; // px the menu keeps from the edges of the screen.

type Rect = { left: number; right: number; top: number; bottom: number };

/** Where the menu opens: under the options button, or at the pointer for a right-click. */
type Anchor = { rect: Rect; from: "button" | "point" };

type MenuState = { projectId: string; anchor: Anchor; trigger: HTMLElement | null };

type ProjectListProps = {
  mobile?: boolean; // The phone sidebar: options always show, and the avatar floats over the end.
  onNavigate?: () => void;
};

/** The projects in the sidebar, newest first, with a menu to edit or delete each. */
export function ProjectList({ mobile = false, onNavigate }: ProjectListProps) {
  const { loaded, projects } = useProjects();
  const pathname = usePathname();
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  useScrollEdges(scrollRef);

  // Close the menu and dialogs when the page is hidden (cacheComponents keeps it
  // alive), so they aren't open when you come back.
  useLayoutEffect(() => {
    return () => {
      setMenu(null);
      setEditingId(null);
      setDeletingId(null);
    };
  }, []);

  const closeMenu = useCallback(() => setMenu(null), []);

  const listed = projects.filter(isListed);
  const editing = projects.find((project) => project.id === editingId);
  const deleting = projects.find((project) => project.id === deletingId);

  function openMenu(project: Project, anchor: Anchor, trigger: HTMLElement | null) {
    // The options button toggles its menu.
    setMenu((open) =>
      open?.projectId === project.id && open.anchor.from === "button" && anchor.from === "button"
        ? null
        : { projectId: project.id, anchor, trigger },
    );
  }

  function handleDelete(project: Project) {
    deleteProject(project.id);
    setDeletingId(null);
    if (pathname === `/projects/${project.id}`) {
      onNavigate?.();
      router.replace("/");
    }
    toast.success("Project deleted.");
  }

  return (
    <>
      <div ref={scrollRef} className="scrollbar-thin fade-y min-h-0 flex-1 overflow-y-auto px-2">
        <div className={mobile ? "pb-24" : "pb-2"}>
          {loaded &&
            (listed.length === 0 ? (
              <ProjectsEmpty />
            ) : (
              <ul className="flex flex-col gap-0.5">
                {listed.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    current={pathname === `/projects/${project.id}`}
                    mobile={mobile}
                    menuOpen={menu?.projectId === project.id}
                    onMenu={(anchor, trigger) => openMenu(project, anchor, trigger)}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>
            ))}
        </div>
      </div>

      {menu && (
        <ProjectMenu
          key={menu.projectId}
          anchor={menu.anchor}
          trigger={menu.trigger}
          onClose={closeMenu}
          onEdit={() => {
            setMenu(null);
            setEditingId(menu.projectId);
          }}
          onDelete={() => {
            setMenu(null);
            setDeletingId(menu.projectId);
          }}
        />
      )}
      {editing && <EditProjectDialog project={editing} onClose={() => setEditingId(null)} />}
      {deleting && (
        <DeleteProjectDialog
          project={deleting}
          onDelete={() => handleDelete(deleting)}
          onClose={() => setDeletingId(null)}
        />
      )}
    </>
  );
}

type ProjectRowProps = {
  project: Project;
  current: boolean;
  mobile: boolean;
  menuOpen: boolean;
  onMenu: (anchor: Anchor, trigger: HTMLElement | null) => void;
  onNavigate?: () => void;
};

/**
 * A project: opens its chat. The options button shows on hover with a mouse, and
 * always on touch screens. Right-click, or holding a finger on it, opens the menu too.
 */
function ProjectRow({ project, current, mobile, menuOpen, onMenu, onNavigate }: ProjectRowProps) {
  const enter = usePlayOnce("motion-safe:animate-enter", isNew(project.id));
  const buttonRef = useRef<HTMLButtonElement>(null);
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
    onNavigate?.();
  }

  return (
    <li className={`group/row relative ${enter.className}`} onAnimationEnd={enter.onAnimationEnd}>
      <Link
        href={`/projects/${project.id}`}
        aria-current={current ? "page" : undefined}
        draggable={false}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        // No text selection or link preview when holding a finger on it. The name only
        // makes room for the options button while it shows.
        className={`${navItem} select-none [-webkit-touch-callout:none] ${
          mobile || menuOpen
            ? "pr-10"
            : "pr-10 pointer-fine:pr-2.5 pointer-fine:group-focus-within/row:pr-10 pointer-fine:group-hover/row:pr-10"
        }`}
      >
        <ProjectLabel project={project} className="flex-1" />
      </Link>
      <button
        ref={buttonRef}
        type="button"
        aria-label={`Options for ${project.name ?? "new project"}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={openFromButton}
        className={`absolute top-1/2 right-1 grid size-8 -translate-y-1/2 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-foreground/5 hover:text-foreground aria-expanded:bg-foreground/5 aria-expanded:text-foreground ${focusRing} ${
          mobile
            ? ""
            : "pointer-fine:opacity-0 pointer-fine:group-focus-within/row:opacity-100 pointer-fine:group-hover/row:opacity-100 pointer-fine:aria-expanded:opacity-100"
        }`}
      >
        <Ellipsis size={16} />
      </button>
    </li>
  );
}

type ProjectMenuProps = {
  anchor: Anchor;
  trigger: HTMLElement | null; // The options button, to toggle and to get focus back.
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/** Edit and Delete, floating over everything next to where it was opened. */
function ProjectMenu({ anchor, trigger, onClose, onEdit, onDelete }: ProjectMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Below the anchor, or above if there's no room; kept on screen. Then focus moves in.
  useLayoutEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const { width, height } = menu.getBoundingClientRect();
    const { rect, from } = anchor;
    const gap = from === "button" ? 4 : 0;
    const fitsBelow = rect.bottom + gap + height <= window.innerHeight - EDGE;
    const top = fitsBelow ? rect.bottom + gap : rect.top - gap - height;
    const left = from === "button" ? rect.right - width : rect.left;
    menu.style.top = `${clamp(top, EDGE, window.innerHeight - height - EDGE)}px`;
    menu.style.left = `${clamp(left, EDGE, window.innerWidth - width - EDGE)}px`;
    menu.style.transformOrigin = `${from === "button" ? "right" : "left"} ${fitsBelow ? "top" : "bottom"}`;
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
function DeleteProjectDialog({ project, onDelete, onClose }: DeleteProjectDialogProps) {
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

// Ghost rows: bar width and opacity, each fainter than the last.
const GHOST_ROWS = [
  { bar: "55%", opacity: 1 },
  { bar: "40%", opacity: 0.65 },
  { bar: "48%", opacity: 0.35 },
];

/** No projects yet: faint outlines of rows where they'll show up. Same size as real rows. */
function ProjectsEmpty() {
  return (
    <div className="pt-1">
      <div aria-hidden className="flex flex-col gap-1.5">
        {GHOST_ROWS.map(({ bar, opacity }) => (
          <div
            key={bar}
            style={{ opacity }}
            className="flex h-10 items-center gap-3 rounded-xl border border-dashed border-foreground/20 px-2.5"
          >
            <span className="size-5 shrink-0 rounded-md bg-foreground/[0.07]" />
            <span style={{ width: bar }} className="h-2 rounded-full bg-foreground/[0.07]" />
          </div>
        ))}
      </div>
      <p className="fade-end mt-3 px-2.5 text-xs text-muted">Your apps will show up here.</p>
    </div>
  );
}
