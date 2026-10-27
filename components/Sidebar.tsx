"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent, ReactNode, RefObject } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Search, SquarePen } from "lucide-react";
import { toast } from "sonner";
import logo from "@/brand/logo.svg";
import logoDark from "@/brand/logo-dark.svg";
import mark from "@/brand/mark.svg";
import markDark from "@/brand/mark-dark.svg";
import { AccountMenu } from "@/components/AccountMenu";
import { focusRing, shown, swap } from "@/components/styles";
import type { CurrentUser } from "@/lib/auth/session";
import { clampWidth, COLLAPSE_AT, COLLAPSED_WIDTH, MAX_WIDTH, MIN_WIDTH } from "@/lib/sidebar";
import type { SidebarState } from "@/lib/sidebar";

const iconButton = `grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl text-muted transition-colors hover:bg-foreground/5 hover:text-foreground ${focusRing}`;
const KEY_STEP = 16; // px per arrow key press on the resize handle.

type DesktopSidebarProps = {
  user: CurrentUser;
  state: SidebarState;
  onChange: (state: SidebarState) => void; // Live, while dragging too.
  onCommit: (state: SidebarState) => void; // Settled: worth saving.
};

/** The sidebar on wider screens: resizable by its right edge, and collapses to icons. */
export function DesktopSidebar({ user, state, onChange, onCommit }: DesktopSidebarProps) {
  const { width, collapsed } = state;
  const asideRef = useRef<HTMLElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartWidth = useRef(width);

  // While dragging, keep the resize cursor everywhere and don't select text.
  useEffect(() => {
    if (!dragging) return;
    const root = document.documentElement;
    root.style.cursor = "col-resize";
    root.style.userSelect = "none";
    return () => {
      root.style.cursor = "";
      root.style.userSelect = "";
    };
  }, [dragging]);

  const toggle = () => onCommit({ width, collapsed: !collapsed });

  // Where the pointer is sets the width. Far enough left, it collapses instead,
  // keeping the width from before the drag to reopen at.
  function stateAt(clientX: number): SidebarState {
    const left = asideRef.current?.getBoundingClientRect().left ?? 0;
    const next = clientX - left;
    return next < COLLAPSE_AT
      ? { width: dragStartWidth.current, collapsed: true }
      : { width: clampWidth(next), collapsed: false };
  }

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartWidth.current = width;
    setDragging(true);
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (dragging) onChange(stateAt(event.clientX));
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragging(false);
    onCommit(stateAt(event.clientX));
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter") {
      toggle();
    } else if (event.key === "ArrowRight") {
      onCommit(collapsed ? { width, collapsed: false } : { width: clampWidth(width + KEY_STEP), collapsed });
    } else if (event.key === "ArrowLeft" && !collapsed) {
      const next = width - KEY_STEP;
      onCommit(next < MIN_WIDTH ? { width, collapsed: true } : { width: next, collapsed });
    } else {
      return;
    }
    event.preventDefault();
  }

  return (
    <aside
      ref={asideRef}
      style={{ width: collapsed ? COLLAPSED_WIDTH : width }}
      className={`sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-surface md:flex ${
        dragging ? "" : "transition-[width] duration-200 ease-out motion-reduce:transition-none"
      }`}
    >
      <div className="flex h-14 shrink-0 items-center px-2">
        <LogoToggle collapsed={collapsed} onClick={toggle} />
      </div>

      <SidebarNav collapsed={collapsed} />

      <div className="shrink-0 p-2">
        <AccountMenu user={user} trigger="row" placement="above-start" collapsed={collapsed} />
      </div>

      {/* Straddles the border, so it's easy to grab. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
        aria-valuenow={collapsed ? COLLAPSED_WIDTH : width}
        aria-valuemin={COLLAPSED_WIDTH}
        aria-valuemax={MAX_WIDTH}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        className="group absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none outline-none"
      >
        <div
          className={`mx-auto h-full w-0.5 transition-colors group-hover:bg-foreground/15 group-focus-visible:bg-foreground/40 ${
            dragging ? "bg-foreground/25!" : ""
          }`}
        />
      </div>
    </aside>
  );
}

/** The brand symbol, which turns into the sidebar toggle on hover. */
function LogoToggle({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  const label = collapsed ? "Open sidebar" : "Close sidebar";
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`group ${iconButton}`}
    >
      <span
        className={`${swap} ${shown} group-hover:scale-50 group-hover:-rotate-45 group-hover:opacity-0 group-focus-visible:scale-50 group-focus-visible:-rotate-45 group-focus-visible:opacity-0`}
      >
        <Image src={mark} alt="" loading="eager" className="size-7 dark:hidden" />
        <Image src={markDark} alt="" loading="eager" className="hidden size-7 dark:block" />
      </span>
      <span
        className={`${swap} scale-50 rotate-45 opacity-0 group-hover:scale-100 group-hover:rotate-0 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:rotate-0 group-focus-visible:opacity-100`}
      >
        {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
      </span>
    </button>
  );
}

type MobileSidebarProps = {
  id: string;
  user: CurrentUser;
  open: boolean;
  onClose: () => void;
  closeRef: RefObject<HTMLButtonElement | null>;
};

/** The sidebar on phones: slides over the whole screen. */
export function MobileSidebar({ id, user, open, onClose, closeRef }: MobileSidebarProps) {
  // Escape closes it, unless a menu or dialog inside handled it first.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest("dialog")) return;
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <div
      id={id}
      role="dialog"
      aria-modal
      aria-label="Sidebar"
      inert={!open}
      // Visible right away when opening, so focus can move in; hidden only once it has slid out.
      className={`fixed inset-0 z-40 flex flex-col bg-background duration-300 ease-out motion-reduce:transition-none md:hidden ${
        open ? "visible translate-x-0 transition-[translate]" : "invisible -translate-x-full transition-[translate,visibility]"
      }`}
    >
      <div className="flex h-14 shrink-0 items-center justify-between pr-3 pl-4">
        {/* Eager: the sidebar starts hidden, and lazy images would only load once it slides in. */}
        <Image src={logo} alt="buildinio" loading="eager" className="h-7 w-auto dark:hidden" />
        <Image src={logoDark} alt="buildinio" loading="eager" className="hidden h-7 w-auto dark:block" />
        <button
          ref={closeRef}
          type="button"
          aria-label="Close sidebar"
          onClick={onClose}
          className={iconButton}
        >
          <PanelLeftClose size={20} />
        </button>
      </div>

      <SidebarNav onNavigate={onClose} />

      {/* Floats over the projects, so they can scroll under it. */}
      <div className="absolute right-4 bottom-[max(1rem,env(safe-area-inset-bottom))]">
        <AccountMenu user={user} placement="above-end" />
      </div>
    </div>
  );
}

type SidebarNavProps = {
  collapsed?: boolean; // Icons only.
  onNavigate?: () => void;
};

/** The tabs and the projects, shared by both sidebars. */
function SidebarNav({ collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  return (
    <>
      <nav aria-label="Main" className="flex shrink-0 flex-col gap-0.5 px-2">
        <Link
          href="/"
          aria-current={pathname === "/" ? "page" : undefined}
          title={collapsed ? "New" : undefined}
          onClick={onNavigate}
          className={navItem}
        >
          <NavLabel icon={<SquarePen size={20} />} label="New" collapsed={collapsed} />
        </Link>
        <button
          type="button"
          title={collapsed ? "Search" : undefined}
          onClick={() => toast.info("Search is coming soon.")}
          className={navItem}
        >
          <NavLabel icon={<Search size={20} />} label="Search" collapsed={collapsed} />
        </button>
      </nav>

      <section
        aria-label="Projects"
        className={`scrollbar-thin mt-4 min-h-0 flex-1 overflow-y-auto px-2 transition-[opacity,visibility] duration-200 ${
          collapsed ? "invisible opacity-0" : ""
        }`}
      >
        <h2 className="fade-end px-2.5 pb-1 text-xs font-medium text-muted">Projects</h2>
        <ProjectsEmpty />
      </section>
    </>
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
      <p className="mt-3 px-2.5 text-xs text-balance text-muted">Your apps will show up here.</p>
    </div>
  );
}

const navItem = `flex h-10 w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl px-2.5 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground aria-[current=page]:bg-foreground/5 aria-[current=page]:text-foreground ${focusRing}`;

/** A tab's icon and label. The icon stays put; the label fades out when the sidebar gets narrow. */
function NavLabel({ icon, label, collapsed }: { icon: ReactNode; label: string; collapsed: boolean }) {
  return (
    <>
      <span className="shrink-0">{icon}</span>
      <span className={`fade-end min-w-0 flex-1 transition-opacity duration-200 ${collapsed ? "opacity-0" : ""}`}>
        {label}
      </span>
    </>
  );
}
