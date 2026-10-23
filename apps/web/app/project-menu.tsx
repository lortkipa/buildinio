"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PencilIcon,
  ShapesIcon,
  Trash2Icon,
  TypeIcon,
} from "./icons";
import { handleMenuKeyDown, MENU_BOX, MENU_GAP, MENU_SURFACE, MenuItem, placeMenu } from "./menu";
import { hasFinePointer } from "./pointer";
import { type ProjectDialogKind, useProjectDialogs } from "./project-dialogs";
import type { Project } from "./projects";

// w-48 and w-40, for placing the menu and its submenu on screen.
const MENU_WIDTH = 192;
const SUBMENU_WIDTH = 160;

// With a mouse or trackpad, Edit's options open in a submenu beside the menu. On touch screens,
// where there may be no room beside it, they slide over the menu instead, with a way back.
type Mode = "flyout" | "slide";

// Where the menu opens: at its trigger, or where the user right-clicked.
export type MenuAnchor = { point: { x: number; y: number } | null };

/*
 * A project's menu, in the sidebar and from the project's name in the chat's top bar: Edit (its icon
 * or name) and Delete, each opening a dialog. A popover, toggled by the trigger (popoverTarget) or
 * shown at the pointer on right-click. align: lined up with the trigger's left edge or centered under
 * it.
 */
export function ProjectMenu({
  project,
  id,
  menuRef,
  triggerRef,
  anchor,
  align = "start",
  onOpenChange,
}: {
  project: Project;
  id: string;
  menuRef: React.RefObject<HTMLDivElement | null>;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  anchor: React.RefObject<MenuAnchor>;
  align?: "start" | "center";
  onOpenChange: (open: boolean) => void;
}) {
  const openDialog = useProjectDialogs();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("flyout");
  // Flyout: whether the submenu is open, and on which side it fits.
  const [submenu, setSubmenu] = useState(false);
  const [side, setSide] = useState<"right" | "left">("right");
  // Slide: the panel showing, and whether it was entered by going back (it slides in from the left).
  const [panel, setPanel] = useState<"main" | "edit">("main");
  const [back, setBack] = useState(false);
  const submenuRef = useRef<HTMLDivElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);

  const close = () => menuRef.current?.hidePopover();

  // The menu stays where it opened, so close it when the window resizes.
  useEffect(() => {
    if (!open) return;
    const close = () => menuRef.current?.hidePopover();
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [open, menuRef]);

  // A panel that slid in starts at its first item.
  useEffect(() => {
    if (panel === "edit" || back) firstItem(menuRef.current)?.focus();
  }, [panel, back, menuRef]);

  function choose(kind: ProjectDialogKind) {
    close();
    openDialog(kind, project, triggerRef.current ?? undefined);
  }

  // Opened from the keyboard or by a click, the submenu takes focus, right away so the next key
  // press already moves in it.
  function openSubmenu(focus: boolean) {
    if (!focus) {
      setSubmenu(true);
      return;
    }
    flushSync(() => setSubmenu(true));
    firstItem(submenuRef.current)?.focus();
  }

  function closeSubmenu() {
    setSubmenu(false);
    editRef.current?.focus();
  }

  function showPanel(next: "main" | "edit") {
    setBack(next === "main");
    setPanel(next);
  }

  const name = project.name ?? "New project";

  return (
    <div
      ref={menuRef}
      id={id}
      popover="auto"
      role="menu"
      aria-label={`${name} options`}
      onBeforeToggle={(event) => {
        if (event.newState !== "open") return;
        const menu = event.currentTarget;
        const point = anchor.current.point;
        const trigger = triggerRef.current;
        const left = point
          ? placeMenu(menu, { top: point.y, bottom: point.y, left: point.x }, MENU_WIDTH, {
              gap: 2,
            })
          : trigger && placeMenu(menu, trigger.getBoundingClientRect(), MENU_WIDTH, { align });
        anchor.current.point = null;
        const roomRight =
          document.documentElement.clientWidth - ((left || 0) + MENU_WIDTH + MENU_GAP);
        setSide(roomRight >= SUBMENU_WIDTH ? "right" : "left");
        setMode(hasFinePointer() ? "flyout" : "slide");
      }}
      onToggle={(event) => {
        const isOpen = event.newState === "open";
        setOpen(isOpen);
        onOpenChange(isOpen);
        if (isOpen) firstItem(event.currentTarget)?.focus();
        else {
          setSubmenu(false);
          setPanel("main");
          setBack(false);
        }
      }}
      onKeyDown={(event) => handleMenuKeyDown(event, close)}
      className={`w-48 overflow-visible ${MENU_SURFACE}`}
    >
      {panel === "edit" ? (
        <div key="edit" className="animate-panel-forward motion-reduce:animate-none">
          <MenuItem
            icon={<ChevronLeftIcon className="size-4" />}
            onClick={() => showPanel("main")}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") showPanel("main");
            }}
          >
            Edit
          </MenuItem>
          <div className="my-1 border-t border-zinc-950/10 dark:border-white/10" />
          <EditItems onChoose={choose} />
        </div>
      ) : (
        <div
          key="main"
          className={back ? "animate-panel-back motion-reduce:animate-none" : undefined}
        >
          <div className="relative">
            <MenuItem
              ref={editRef}
              icon={<PencilIcon className="size-4" />}
              trailing={<ChevronRightIcon className="size-4 text-zinc-500 dark:text-zinc-400" />}
              aria-haspopup="menu"
              aria-expanded={mode === "flyout" ? submenu : undefined}
              onPointerEnter={(event) => {
                if (mode === "flyout" && event.pointerType === "mouse") openSubmenu(false);
              }}
              onClick={() => (mode === "flyout" ? openSubmenu(true) : showPanel("edit"))}
              onKeyDown={(event) => {
                if (event.key !== "ArrowRight") return;
                event.preventDefault();
                if (mode === "flyout") openSubmenu(true);
                else showPanel("edit");
              }}
            >
              Edit
            </MenuItem>
            {mode === "flyout" && submenu && (
              <div
                ref={submenuRef}
                role="menu"
                aria-label="Edit"
                onKeyDown={(event) => {
                  if (event.key === "ArrowLeft" || event.key === "Escape") {
                    // Escape closes only the submenu, not the whole menu.
                    event.preventDefault();
                    event.stopPropagation();
                    closeSubmenu();
                    return;
                  }
                  handleMenuKeyDown(event, close);
                }}
                className={`absolute -top-1.5 w-40 animate-item-in motion-reduce:animate-none ${
                  side === "right" ? "left-full ml-3" : "right-full mr-3"
                } ${MENU_BOX}`}
              >
                <EditItems onChoose={choose} />
              </div>
            )}
          </div>
          <MenuItem
            danger
            icon={<Trash2Icon className="size-4" />}
            onPointerEnter={() => setSubmenu(false)}
            onClick={() => choose("delete")}
          >
            Delete
          </MenuItem>
        </div>
      )}
    </div>
  );
}

function EditItems({ onChoose }: { onChoose: (kind: ProjectDialogKind) => void }) {
  return (
    <>
      <MenuItem icon={<ShapesIcon className="size-4" />} onClick={() => onChoose("icon")}>
        Icon
      </MenuItem>
      <MenuItem icon={<TypeIcon className="size-4" />} onClick={() => onChoose("name")}>
        Name
      </MenuItem>
    </>
  );
}

// The menu's own first item, not one in a submenu.
function firstItem(menu: HTMLElement | null) {
  return [...(menu?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])].find(
    (item) => item.closest('[role="menu"]') === menu,
  );
}
