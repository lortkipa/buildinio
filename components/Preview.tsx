"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent, RefObject } from "react";
import { PanelLeft } from "lucide-react";
import { PreviewToggle, ProjectTitle } from "@/components/ProjectHeader";
import { ProjectTile } from "@/components/ProjectTile";
import { circleButton } from "@/components/styles";
import { usePlayOnce } from "@/components/usePlayOnce";
import { setMobilePreview } from "@/components/usePreviewState";
import { useSwipeSheet } from "@/components/useSwipeSheet";
import { CHAT_MIN_WIDTH, clampPreviewWidth, PREVIEW_CLOSE_AT, PREVIEW_MIN_WIDTH } from "@/lib/preview";
import type { PreviewState } from "@/lib/preview";
import { guessIdea } from "@/lib/projects/mock";
import { PROJECT_COLORS } from "@/lib/projects/options";
import { markPreviewSeen, useProject } from "@/lib/projects/store";
import type { Project } from "@/lib/projects/types";

// The app the AI builds, next to the chat on wider screens and over it on phones.
// Mocked like the AI: a skeleton while it builds, then a made-up page for the app.

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
  const { width, open } = state;
  const ref = useRef<HTMLElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartWidth = useRef(width);
  const ready = project?.ready === true;

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

  // A just-built app shows itself: the panel opens if it was hidden. Phones get a card instead (see ProjectChat).
  useEffect(() => {
    if (!ready || !window.matchMedia(WIDE).matches) return;
    if (!open) onCommit({ width, open: true });
    markPreviewSeen(projectId);
  }, [ready, open, width, onCommit, projectId]);

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
      className={`sticky top-0 hidden h-dvh min-w-0 shrink md:block ${
        dragging ? "" : "transition-[width] duration-200 ease-out motion-reduce:transition-none"
      }`}
    >
      {/* Its full width even while opening or closing, held to the right: it slides in
          and out instead of squeezing the app. */}
      <div inert={!open} className="absolute inset-0 flex justify-end overflow-hidden">
        <div style={{ width: shown }} className="h-full shrink-0 py-2 pr-2">
          <div className="h-full overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="scrollbar-thin @container h-full overflow-y-auto overscroll-contain">
              <PreviewScreen project={project} />
            </div>
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
      <div className="scrollbar-thin @container min-h-0 flex-1 touch-pan-y touch-pinch-zoom overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
        <PreviewScreen project={project} />
      </div>
    </div>
  );
}

/** The app taking shape while the AI builds it, then the app. */
function PreviewScreen({ project }: { project: Project | null }) {
  if (!project) return null;
  const built = project.messages.some((message) => message.role === "assistant");
  return built ? <MockApp project={project} /> : <AppSkeleton />;
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

/**
 * A made-up page for the app, from what the AI took from the first prompt, in the
 * project's name, icon and color (so edits show). Only a picture: nothing to click.
 */
function MockApp({ project }: { project: Project }) {
  const first = project.messages[0];
  const prompt = first?.role === "user" ? first.text : "";
  const { pitch, features } = useMemo(() => guessIdea(prompt), [prompt]);
  // Only an app that was just built appears; one opened later is just there.
  const enter = usePlayOnce("motion-safe:animate-enter", project.ready === true);
  const name = project.name ?? "Your app";
  const button = "shrink-0 rounded-full font-medium";

  return (
    <div
      style={{ "--app": PROJECT_COLORS[project.color] } as CSSProperties}
      onAnimationEnd={enter.onAnimationEnd}
      className={`flex min-h-full flex-col ${enter.className}`}
    >
      <div className="flex h-14 shrink-0 items-center gap-2.5 border-b border-border px-4 @2xl:px-8">
        <ProjectTile icon={project.icon} color={project.color} className="size-7 rounded-lg" iconSize={16} />
        <span className="min-w-0 truncate text-sm font-semibold">{name}</span>
        <span className="ml-auto hidden items-center gap-5 text-sm text-muted @xl:flex">
          <span>Home</span>
          <span>About</span>
          <span>Contact</span>
        </span>
        <span className={`${button} ml-auto bg-(--app) px-3.5 py-1.5 text-xs text-white @xl:ml-0`}>Get started</span>
      </div>

      <div className="px-6 pt-12 pb-10 text-center @2xl:pt-16">
        <ProjectTile icon={project.icon} color={project.color} className="mx-auto size-14 rounded-2xl" iconSize={28} />
        <h2 className="mt-5 text-2xl font-semibold tracking-[-0.02em] text-balance wrap-anywhere @2xl:text-4xl">
          {name}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-balance text-muted @2xl:text-base">
          {pitch[0].toUpperCase() + pitch.slice(1)}.
        </p>
        <div className="mt-6 flex justify-center gap-2 text-sm">
          <span className={`${button} bg-(--app) px-5 py-2.5 text-white`}>Get started</span>
          <span className={`${button} border border-border px-5 py-2.5`}>Learn more</span>
        </div>
      </div>

      <ul className="grid gap-3 px-5 pb-10 @2xl:grid-cols-3 @2xl:px-8">
        {features.map((feature, index) => (
          <li key={feature} className="rounded-2xl border border-border p-4">
            <span className="grid size-8 place-items-center rounded-lg bg-(--app) text-sm font-semibold text-white">
              {index + 1}
            </span>
            <p className="mt-3 text-sm leading-relaxed">{feature}</p>
          </li>
        ))}
      </ul>

      <p className="mt-auto border-t border-border px-5 py-5 text-center text-xs text-muted">Made with buildinio</p>
    </div>
  );
}
