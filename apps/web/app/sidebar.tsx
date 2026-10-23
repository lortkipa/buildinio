"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { PanelLeftCloseIcon, PanelLeftOpenIcon, SearchIcon, SquarePenIcon } from "./icons";
import { ProjectsSection } from "./project-list";
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

// How far one arrow key press moves the resize handle.
const KEY_STEP = 16;

const ONE_YEAR = 60 * 60 * 24 * 365;

function saveSidebarState(state: SidebarState) {
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is missing in older Safari
  document.cookie = `${SIDEBAR_COOKIE}=${serializeSidebarState(state)}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
}

// The name of an icon-only item, shown to its right on hover or keyboard focus. Comes right after
// the item (the peer), outside it, so the item's overflow-hidden doesn't clip it.
function Tooltip({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute top-1/2 left-full z-10 ml-3 -translate-y-1/2 rounded-lg bg-zinc-950 px-2 py-1 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-md transition-opacity peer-hover:opacity-100 peer-focus-visible:opacity-100 dark:bg-white dark:text-zinc-950"
    >
      {children}
    </span>
  );
}

/*
 * New and Search. Collapsed, only their icons, named by a tooltip. Also in the phone sheet, where
 * onNavigate closes it. Only New works yet: home is where a new project starts.
 */
export function SidebarNav({
  collapsed = false,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const label = collapsed ? "sr-only" : "flex-1 truncate-fade text-left";

  return (
    <nav aria-label="Main" className="px-2">
      <ul className="flex flex-col gap-0.5">
        <li className="relative">
          <Link
            href="/"
            onClick={onNavigate}
            aria-current={pathname === "/" ? "page" : undefined}
            className={SIDEBAR_ITEM}
          >
            <SquarePenIcon className="size-5 shrink-0" />
            <span className={label}>New</span>
          </Link>
          {collapsed && <Tooltip>New</Tooltip>}
        </li>
        <li className="relative">
          {/* Not built yet. */}
          <button type="button" className={SIDEBAR_ITEM}>
            <SearchIcon className="size-5 shrink-0" />
            <span className={label}>Search</span>
          </button>
          {collapsed && <Tooltip>Search</Tooltip>}
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
}: {
  initialState: SidebarState;
  account: Account;
}) {
  const id = useId();
  const [state, setState] = useState(initialState);
  const [dragging, setDragging] = useState(false);
  // Where the drag started: the pointer, the sidebar's width then, and the width to expand to.
  const drag = useRef<{ x: number; from: number; width: number } | null>(null);
  const { width, collapsed } = state;

  // Remember it for the next page load. While dragging, only once the drag ends.
  useEffect(() => {
    if (!dragging) saveSidebarState(state);
  }, [state, dragging]);

  // While dragging, keep the resize cursor and select nothing, wherever the pointer goes.
  useEffect(() => {
    if (!dragging) return;
    const { style } = document.body;
    style.cursor = "col-resize";
    style.userSelect = "none";
    style.webkitUserSelect = "none";
    return () => {
      style.cursor = "";
      style.userSelect = "";
      style.webkitUserSelect = "";
    };
  }, [dragging]);

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

      <SidebarNav collapsed={collapsed} />

      {collapsed ? <div className="flex-1" /> : <ProjectsSection />}

      <div className="p-2">
        <UserMenu account={account} placement={collapsed ? "rail" : "card"} />
      </div>

      {/* Straddles the right border; a line shows on hover and while dragging. */}
      {/* biome-ignore lint/a11y/useSemanticElements: an <hr> can't hold the line inside */}
      <div
        role="separator"
        tabIndex={0}
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-controls={id}
        aria-valuemin={RAIL_WIDTH}
        aria-valuemax={MAX_WIDTH}
        aria-valuenow={collapsed ? RAIL_WIDTH : width}
        data-dragging={dragging || undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onLostPointerCapture={endDrag}
        onKeyDown={handleKeyDown}
        className="group/handle absolute inset-y-0 -right-1.5 w-3 cursor-col-resize touch-none outline-none"
      >
        <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-brand-violet opacity-0 transition-opacity group-hover/handle:opacity-60 group-focus-visible/handle:opacity-100 group-data-dragging/handle:opacity-100" />
      </div>
    </aside>
  );
}
