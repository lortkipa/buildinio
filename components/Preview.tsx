"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent, MouseEvent, PointerEvent, RefObject } from "react";
import { AppWindow, PanelLeft } from "lucide-react";
import { PreviewToggle, ProjectTitle } from "@/components/ProjectHeader";
import { circleButton } from "@/components/styles";
import { usePlayOnce } from "@/components/usePlayOnce";
import { setMobilePreview } from "@/components/usePreviewState";
import { useSwipeSheet } from "@/components/useSwipeSheet";
import { CHAT_MIN_WIDTH, clampPreviewWidth, PREVIEW_CLOSE_AT, PREVIEW_MIN_WIDTH } from "@/lib/preview";
import type { PreviewState } from "@/lib/preview";
import { markPreviewSeen, useProject } from "@/lib/projects/store";
import type { Project } from "@/lib/projects/types";

// The app the AI builds, next to the chat on wider screens and over it on phones:
// a skeleton while it builds the first version, then the app itself, in a frame.

const KEY_STEP = 16; // px per arrow key press on the resize handle.
const WIDE = "(min-width: 48rem)";

type DesktopPreviewProps = {
  id: string;
  projectId: string;
  state: PreviewState;
  sidebarWidth: number; // So the chat between them keeps its room.
  onChange: (state: PreviewState) => void; // Live, while dragging too.
  onCommit: (state: PreviewState) => void; // Settled: worth saving.
};

/**
 * The preview on wider screens: a panel right of the chat, resizable by its left edge.
 * Dragging it narrow hides it; the edge stays there to drag it back out.
 */
export function DesktopPreview({ id, projectId, state, sidebarWidth, onChange, onCommit }: DesktopPreviewProps) {
  const { project } = useProject(projectId);
  const wide = useWide();
  const { width, open } = state;
  const ref = useRef<HTMLElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartWidth = useRef(width);
  const ready = project?.ready === true;

  // While dragging, keep the resize cursor everywhere, don't select text, and keep
  // the pointer out of the app's frame (see globals.css).
  useEffect(() => {
    if (!dragging) return;
    const root = document.documentElement;
    root.style.cursor = "col-resize";
    root.style.userSelect = "none";
    root.dataset.dragging = "";
    return () => {
      root.style.cursor = "";
      root.style.userSelect = "";
      delete root.dataset.dragging;
    };
  }, [dragging]);

  // A just-built app shows itself: the panel opens if it was hidden. Phones get a card instead (see ProjectChat).
  useEffect(() => {
    if (!ready || !wide) return;
    if (!open) onCommit({ width, open: true });
    markPreviewSeen(projectId);
  }, [ready, wide, open, width, onCommit, projectId]);

  const toggle = () => onCommit({ width, open: !open });

  // As wide as it's set to, as long as the sidebar and the chat still fit.
  const room = Math.max(0, usePageWidth() - sidebarWidth - CHAT_MIN_WIDTH);
  const shown = Math.min(width, room);

  // Where the pointer is sets the width. Far enough right, it hides instead,
  // keeping the width from before the drag to reopen at.
  function stateAt(clientX: number): PreviewState {
    const right = ref.current?.getBoundingClientRect().right ?? window.innerWidth;
    const next = right - clientX;
    return next < PREVIEW_CLOSE_AT
      ? { width: dragStartWidth.current, open: false }
      : { width: clampPreviewWidth(next, room), open: true };
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

  // The handle is on the left, so left makes it wider.
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter") {
      toggle();
    } else if (event.key === "ArrowLeft") {
      onCommit(open ? { width: clampPreviewWidth(width + KEY_STEP, room), open } : { width, open: true });
    } else if (event.key === "ArrowRight" && open) {
      const next = width - KEY_STEP;
      onCommit(next < PREVIEW_MIN_WIDTH ? { width, open: false } : { width: next, open });
    } else {
      return;
    }
    event.preventDefault();
  }

  return (
    <section
      ref={ref}
      id={id}
      aria-label="Preview"
      style={{ width: open ? shown : 0 }}
      className={`sticky top-0 z-20 hidden h-dvh min-w-0 shrink md:block ${
        dragging ? "" : "transition-[width] duration-200 ease-out motion-reduce:transition-none"
      }`}
    >
      {/* Its full width even while opening or closing, held to the right: it slides in
          and out instead of squeezing the app. */}
      <div inert={!open} className="absolute inset-0 flex justify-end overflow-hidden">
        <div style={{ width: shown }} className="h-full shrink-0 py-2 pr-2">
          <div className="h-full overflow-hidden rounded-2xl border border-border bg-surface">
            {wide && <PreviewScreen project={project} />}
          </div>
        </div>
      </div>

      {/* Straddles the edge, so it's easy to grab. Inside the screen while hidden. */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize preview"
        aria-controls={id}
        aria-valuenow={open ? shown : 0}
        aria-valuemin={0}
        tabIndex={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
        className={`group absolute inset-y-0 z-10 w-2 cursor-col-resize touch-none outline-none ${
          open ? "-left-1" : "-left-2"
        }`}
      >
        <div
          className={`mx-auto h-full w-0.5 transition-colors group-hover:bg-foreground/15 group-focus-visible:bg-foreground/40 ${
            dragging ? "bg-foreground/25!" : ""
          }`}
        />
      </div>
    </section>
  );
}

// The page's own size, so a scrollbar showing up counts too, not just the window.
function subscribeResize(listener: () => void) {
  const observer = new ResizeObserver(listener);
  observer.observe(document.documentElement);
  return () => observer.disconnect();
}

/** The page's width without its scrollbar. Unknown (no limit) while rendering on the server. */
function usePageWidth() {
  return useSyncExternalStore(
    subscribeResize,
    () => document.documentElement.clientWidth,
    () => Infinity,
  );
}

function subscribeWide(listener: () => void) {
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

/**
 * Whether the screen is wide enough for the preview panel, rather than the phone
 * sheet. Only the one that shows loads the app.
 */
function useWide() {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
}

type MobilePreviewProps = {
  id: string;
  projectId: string;
  open: boolean;
  sidebarId: string;
  sidebarOpen: boolean; // Over this, so this is out of reach.
  onClose: () => void;
  onOpenSidebar: (event: MouseEvent<HTMLButtonElement>) => void;
  closeRef: RefObject<HTMLButtonElement | null>;
  swipeAreaRef: RefObject<HTMLElement | null>; // The chat: swiping left on it pulls this in.
};

/**
 * The preview on phones: slides over the whole screen from the right, with the chat
 * header's buttons on a bar of their own above the app. Swiping left on the chat pulls
 * it in and swiping right pushes it back out, following the finger.
 */
export function MobilePreview({
  id,
  projectId,
  open,
  sidebarId,
  sidebarOpen,
  onClose,
  onOpenSidebar,
  closeRef,
  swipeAreaRef,
}: MobilePreviewProps) {
  const { project } = useProject(projectId);
  const wide = useWide();
  const ready = project?.ready === true;
  const ref = useRef<HTMLDivElement>(null);
  useSwipeSheet(swipeAreaRef, ref, open, setMobilePreview);

  // Escape closes it, unless the sidebar over it, a menu or a dialog handled it first.
  useEffect(() => {
    if (!open || sidebarOpen) return;
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest("dialog")) return;
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, sidebarOpen, onClose]);

  // The app was seen: no "ready" card once it's closed.
  useEffect(() => {
    if (open && ready) markPreviewSeen(projectId);
  }, [open, ready, projectId]);

  return (
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-modal
      aria-label="Preview"
      inert={!open || sidebarOpen}
      // Visible right away when opening, so focus can move in; hidden only once it has slid out.
      className={`fixed inset-0 z-40 flex touch-pan-y touch-pinch-zoom flex-col bg-surface duration-300 ease-out motion-reduce:transition-none md:hidden ${
        open ? "visible translate-x-0 transition-[translate]" : "invisible translate-x-full transition-[translate,visibility]"
      }`}
    >
      {/* Like the chat header, on a solid bar so it stands apart from the app. */}
      <div className="relative flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-3">
        <button
          type="button"
          aria-label="Open sidebar"
          aria-expanded={sidebarOpen}
          aria-controls={sidebarId}
          onClick={onOpenSidebar}
          className={circleButton}
        >
          <PanelLeft size={20} />
        </button>
        <div className="absolute inset-x-16 inset-y-0 flex items-center justify-center">
          <ProjectTitle key={projectId} id={projectId} />
        </div>
        <PreviewToggle ref={closeRef} pressed controls={id} onClick={onClose} />
      </div>
      <div className="relative min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
        {!wide && <PreviewScreen project={project} />}
        {/* The app's frame keeps touches to itself: a strip along its left edge still
            takes the swipe that pushes the preview back out. */}
        <div aria-hidden className="absolute inset-y-0 left-0 w-4 touch-pan-y" />
      </div>
    </div>
  );
}

/** The app, or a skeleton while the AI builds the first version of it. */
function PreviewScreen({ project }: { project: Project | null }) {
  if (!project) return null;
  if (project.appVersion > 0) return <AppFrame key={project.appVersion} project={project} />;
  return (
    <div className="scrollbar-thin @container h-full touch-pan-y touch-pinch-zoom overflow-y-auto overscroll-contain">
      {project.turn ? <AppSkeleton /> : <NothingYet />}
    </div>
  );
}

/** The built app (served by app/preview), sandboxed: its scripts can't reach this site. */
function AppFrame({ project }: { project: Project }) {
  // Only an app that was just built appears; one opened later is just there.
  const enter = usePlayOnce("motion-safe:animate-enter", project.ready);
  return (
    <iframe
      src={`/preview/${project.id}/index.html?v=${project.appVersion}`}
      title={project.name ?? "Your app"}
      sandbox="allow-scripts allow-forms allow-modals allow-popups"
      onAnimationEnd={enter.onAnimationEnd}
      className={`block size-full bg-white ${enter.className}`}
    />
  );
}

/** Nothing built yet, and the AI isn't working on it. */
function NothingYet() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <AppWindow size={28} aria-hidden className="text-muted" />
      <p className="max-w-64 text-sm text-balance text-muted">
        Your app shows up here once there&rsquo;s something to see. Ask for what you&rsquo;d like to build.
      </p>
    </div>
  );
}

// The shimmer's length (animate-shimmer in globals.css), and how far behind the one
// before it each bone's sweep runs, so the light moves down the page in a wave.
const SHIMMER_MS = 2000;
const WAVE_MS = 70;

/** A grey block standing in for part of the app; `at` is its place in the wave. */
function Bone({ at, className }: { at: number; className: string }) {
  return (
    <span
      style={{ animationDelay: `${at * WAVE_MS - SHIMMER_MS}ms` }}
      className={`skeleton block motion-safe:animate-shimmer ${className}`}
    />
  );
}

/** What any app might look like (we don't know its layout yet): a top bar, a hero and cards. */
function AppSkeleton() {
  return (
    <div aria-busy className="flex min-h-full flex-col">
      <div aria-hidden className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 @2xl:px-8">
        <Bone at={0} className="size-7 rounded-lg" />
        <Bone at={1} className="h-2.5 w-20 rounded-full" />
        <div className="ml-auto hidden items-center gap-5 @xl:flex">
          <Bone at={2} className="h-2 w-10 rounded-full" />
          <Bone at={3} className="h-2 w-12 rounded-full" />
          <Bone at={4} className="h-2 w-10 rounded-full" />
        </div>
        <Bone at={5} className="ml-auto h-8 w-24 rounded-full @xl:ml-0" />
      </div>

      <div aria-hidden className="flex flex-col items-center gap-3 px-6 pt-12 pb-10 @2xl:pt-16">
        <Bone at={6} className="size-14 rounded-2xl" />
        <Bone at={7} className="mt-3 h-5 w-3/5 max-w-72 rounded-full" />
        <Bone at={8} className="mt-1 h-2.5 w-4/5 max-w-96 rounded-full" />
        <Bone at={9} className="h-2.5 w-3/5 max-w-72 rounded-full" />
        <div className="mt-4 flex gap-2">
          <Bone at={10} className="h-10 w-28 rounded-full" />
          <Bone at={11} className="h-10 w-24 rounded-full" />
        </div>
      </div>

      {/* Three cards in one column, six in two or three columns. */}
      <div aria-hidden className="grid gap-3 px-5 pb-10 @md:grid-cols-2 @2xl:grid-cols-3 @2xl:px-8">
        {[0, 1, 2, 3, 4, 5].map((card) => (
          <div
            key={card}
            className={`rounded-2xl border border-border p-3 ${card >= 3 ? "hidden @md:block" : ""}`}
          >
            <Bone at={12 + card} className="aspect-video w-full rounded-xl" />
            <Bone at={13 + card} className="mt-3 h-2.5 w-3/4 rounded-full" />
            <Bone at={14 + card} className="mt-2 h-2 w-1/2 rounded-full" />
          </div>
        ))}
      </div>

      <div className="sticky bottom-4 mt-auto flex justify-center pb-4">
        <p className="rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.18)]">
          <span className="text-shimmer motion-safe:animate-shimmer">Building your app</span>
        </p>
      </div>
    </div>
  );
}
