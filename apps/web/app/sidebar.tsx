"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { PanelLeftCloseIcon, PanelLeftOpenIcon, SearchIcon, SquarePenIcon } from "./icons";
import { ProjectsSection } from "./project-list";
import { KEY_STEP, ResizeHandle } from "./resize-handle";
import { saveCookie } from "./save-cookie";
import { SIDEBAR_ITEM } from "./sidebar-item";
import {
  COLLAPSE_BELOW,
  clampWidth,
  MAX_WIDTH,
  MIN_WIDTH,
  RAIL_WIDTH,
  SIDEBAR_COOKIE,
  type SidebarState,
  serializeSidebarState,
} from "./sidebar-state";
import { type Account, UserMenu } from "./user-menu";

// Search's keyboard shortcut, as the platform writes it. The server can't know, so none there.
const noChange = () => () => {};
const useSearchShortcut = () =>
  useSyncExternalStore(
    noChange,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => null,
  );

/*
 * New and Search. Collapsed, only their icons, named by a tooltip. Also in the phone sheet, where
 * onNavigate closes it. New goes home, where a new project starts; Search opens the search dialog
 * (onSearch, see search-dialog.tsx), its shortcut showing on hover with a mouse or trackpad.
 */
export function SidebarNav({
  collapsed = false,
  onNavigate,
  onSearch,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
  onSearch: () => void;
}) {
  const pathname = usePathname();
  const shortcut = useSearchShortcut();
  const label = collapsed ? "sr-only" : "flex-1 truncate-fade text-left";
  // Collapsed, the name shows to the right of the icon (see tooltips.tsx).
  const tooltip = (name: string) =>
    collapsed ? { "data-tooltip": name, "data-tooltip-side": "right" } : {};

  return (
    <nav aria-label="Main" className="px-2">
      <ul className="flex flex-col gap-0.5">
        <li>
          <Link
            href="/"
            onClick={onNavigate}
            aria-current={pathname === "/" ? "page" : undefined}
            {...tooltip("New")}
            className={SIDEBAR_ITEM}
          >
            <SquarePenIcon className="size-5 shrink-0" />
            <span className={label}>New</span>
          </Link>
        </li>
        <li>
          <button
            type="button"
            onClick={onSearch}
            aria-haspopup="dialog"
            aria-keyshortcuts="Control+K Meta+K"
            {...tooltip("Search")}
            className={`group/search ${SIDEBAR_ITEM}`}
          >
            <SearchIcon className="size-5 shrink-0" />
            <span className={label}>Search</span>
            {shortcut && !collapsed && (
              <kbd
                aria-hidden
                className="hidden font-sans text-xs text-zinc-500 opacity-0 transition-opacity group-hover/search:opacity-100 group-focus-visible/search:opacity-100 pointer-fine:inline dark:text-zinc-400"
              >
                {shortcut}
              </kbd>
            )}
          </button>
        </li>
      </ul>
    </nav>
  );
}

/*
 * The sidebar from md up. The logo on top turns into the collapse/expand button on hover. Its right
 * edge can be dragged to resize it, between MIN_WIDTH and MAX_WIDTH; dragged narrower than
 * COLLAPSE_BELOW, it collapses to a rail of icons. The width and state are kept in a cookie (see
 * sidebar-state.ts).
 */
export function Sidebar({
  initialState,
  account,
  onSearch,
}: {
  initialState: SidebarState;
  account: Account;
  onSearch: () => void;
}) {
  const id = useId();
  const [state, setState] = useState(initialState);
  const [dragging, setDragging] = useState(false);
  // Where the drag started: the pointer, the sidebar's width then, and the width to expand to.
  const drag = useRef<{ x: number; from: number; width: number } | null>(null);
  const { width, collapsed } = state;

  // Remember it for the next page load. While dragging, only once the drag ends.
  useEffect(() => {
    if (!dragging) saveCookie(SIDEBAR_COOKIE, serializeSidebarState(state));
  }, [state, dragging]);

  const toggle = () => setState({ width, collapsed: !collapsed });

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, from: collapsed ? RAIL_WIDTH : width, width };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start) return;
    const next = start.from + event.clientX - start.x;
    // Collapsing keeps the width from before the drag, to expand to later. Between COLLAPSE_BELOW
    // and MIN_WIDTH the sidebar holds at MIN_WIDTH.
    setState(
      next < COLLAPSE_BELOW
        ? { width: start.width, collapsed: true }
        : { width: clampWidth(next), collapsed: false },
    );
  }

  function endDrag() {
    drag.current = null;
    setDragging(false);
  }

  // Arrows resize (at MIN_WIDTH, Left collapses; collapsed, Right expands), Enter toggles.
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    let next: SidebarState;
    if (event.key === "Enter") next = { width, collapsed: !collapsed };
    else if (event.key === "ArrowRight") {
      next = collapsed
        ? { width, collapsed: false }
        : { width: clampWidth(width + KEY_STEP), collapsed };
    } else if (event.key === "ArrowLeft") {
      if (collapsed) return;
      next =
        width > MIN_WIDTH
          ? { width: clampWidth(width - KEY_STEP), collapsed }
          : { width, collapsed: true };
    } else return;
    event.preventDefault();
    setState(next);
  }

  const PanelIcon = collapsed ? PanelLeftOpenIcon : PanelLeftCloseIcon;

  return (
    <aside
      id={id}
      aria-label="Sidebar"
      style={{ width: collapsed ? RAIL_WIDTH : width }}
      className={`sticky top-0 z-10 hidden h-dvh shrink-0 flex-col border-r border-zinc-950/10 bg-white/60 backdrop-blur-xl md:flex dark:border-white/10 dark:bg-zinc-900/60 ${
        // The width follows the pointer while dragging, and animates when toggled.
        dragging ? "" : "transition-[width] duration-200 ease-out motion-reduce:transition-none"
      }`}
    >
      <div className="p-2">
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          aria-controls={id}
          className="group/toggle relative grid size-10 place-items-center rounded-xl text-zinc-700 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          {/* The logo, spinning away into the panel icon on hover (like the mic and send in PromptInput). */}
          {/* biome-ignore lint/performance/noImgElement: a small SVG, nothing for next/image to optimize */}
          <img
            src="/brand/buildinio-mark.svg"
            alt=""
            width={24}
            height={24}
            className="size-6 transition duration-300 ease-spring group-hover/toggle:scale-50 group-hover/toggle:-rotate-90 group-hover/toggle:opacity-0 group-focus-visible/toggle:scale-50 group-focus-visible/toggle:-rotate-90 group-focus-visible/toggle:opacity-0 motion-reduce:transition-none"
          />
          <PanelIcon className="absolute inset-0 m-auto size-5 scale-50 rotate-90 opacity-0 transition duration-300 ease-spring group-hover/toggle:scale-100 group-hover/toggle:rotate-0 group-hover/toggle:opacity-100 group-focus-visible/toggle:scale-100 group-focus-visible/toggle:rotate-0 group-focus-visible/toggle:opacity-100 motion-reduce:transition-none" />
        </button>
      </div>

      <SidebarNav collapsed={collapsed} onSearch={onSearch} />

      {collapsed ? <div className="flex-1" /> : <ProjectsSection />}

      <div className="p-2">
        <UserMenu account={account} placement={collapsed ? "rail" : "card"} />
      </div>

      <ResizeHandle
        label="Resize sidebar"
        controls={id}
        min={RAIL_WIDTH}
        max={MAX_WIDTH}
        now={collapsed ? RAIL_WIDTH : width}
        dragging={dragging}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onDragEnd={endDrag}
        onKeyDown={handleKeyDown}
        className="-right-1.5"
      />
    </aside>
  );
}
