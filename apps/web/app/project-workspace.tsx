"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ICON_BUTTON } from "./icon-button";
import {
  AppWindowIcon,
  MessageSquareIcon,
  PanelLeftOpenIcon,
  PanelRightCloseIcon,
  PanelRightOpenIcon,
} from "./icons";
import { PreviewPanel } from "./preview-panel";
import {
  CHAT_MIN,
  HIDE_BELOW,
  PREVIEW_COOKIE,
  PREVIEW_MIN,
  type PreviewState,
  serializePreviewState,
} from "./preview-state";
import { ProjectTitle } from "./project-title";
import { useProject } from "./projects";
import { KEY_STEP, ResizeHandle } from "./resize-handle";
import { saveCookie } from "./save-cookie";
import { useWide, WIDE } from "./wide";

// The panel's width in pixels for a share of the workspace, as the CSS below works it out.
const previewWidth = (share: number, width: number) =>
  Math.min(Math.max(share * width, PREVIEW_MIN), width - CHAT_MIN);

/*
 * A project's page: its chat (children) and its preview (preview-panel.tsx), with the top bar
 * floating over the chat: on phones, the button opening the sidebar sheet (onOpenSheet); the
 * project's name; and the button showing or hiding the preview.
 *
 * From md up, the preview sits to the right of the chat. Its left edge can be dragged: narrower than
 * HIDE_BELOW it hides, and dragged back out it shows again. The share and whether it shows are kept
 * in a cookie (see preview-state.ts), and reported to AppShell, which outlives this page.
 *
 * On phones, the chat and the preview take turns filling the screen under the top bar. The preview
 * slides in from the right while the chat recedes to the left, and back.
 */
export function ProjectWorkspace({
  id,
  preview,
  onPreviewChange,
  onOpenSheet,
  children,
}: {
  id: string;
  preview: PreviewState;
  onPreviewChange: (state: PreviewState) => void;
  onOpenSheet: () => void;
  children: React.ReactNode;
}) {
  const panelId = useId();
  const wide = useWide();
  const project = useProject(id);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState(preview);
  const [dragging, setDragging] = useState(false);
  // Where the drag started: the workspace's right edge and width, and the share to show again at.
  const drag = useRef<{ right: number; width: number; share: number } | null>(null);
  // Phones only: the preview fills the screen instead of the chat. Each project opens on its chat.
  const [showPreview, setShowPreview] = useState(false);
  const { share, open } = state;

  // Remember it for the next page load and the next project. While dragging, only once the drag ends.
  useEffect(() => {
    if (dragging) return;
    saveCookie(PREVIEW_COOKIE, serializePreviewState(state));
    onPreviewChange(state);
  }, [state, dragging, onPreviewChange]);

  // Asks the screen itself, in case it changed size a moment ago.
  function toggle() {
    if (window.matchMedia(WIDE).matches) setState({ share, open: !open });
    else setShowPreview(!showPreview);
  }

  // The share for a width dragged or stepped to, between the minimums. In a window too narrow for
  // both, the two split it evenly whatever the share, so it stays as it was.
  function shareFor(px: number, width: number) {
    if (width - CHAT_MIN < PREVIEW_MIN) return share;
    return previewWidth(px / width, width) / width;
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const box = workspaceRef.current?.getBoundingClientRect();
    if (event.button !== 0 || !box) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { right: box.right, width: box.width, share };
    setDragging(true);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start) return;
    const px = start.right - event.clientX;
    // Hiding keeps the share from before the drag, to show at later. Between HIDE_BELOW and
    // PREVIEW_MIN the panel holds at PREVIEW_MIN.
    setState(
      px < HIDE_BELOW
        ? { share: start.share, open: false }
        : { share: shareFor(px, start.width), open: true },
    );
  }

  function endDrag() {
    drag.current = null;
    setDragging(false);
  }

  // The handle is on the panel's left edge: Left widens it (hidden, shows it), Right narrows it (at
  // PREVIEW_MIN, hides it), Enter toggles.
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const width = workspaceRef.current?.clientWidth ?? 0;
    const px = previewWidth(share, width);
    let next: PreviewState;
    if (event.key === "Enter") next = { share, open: !open };
    else if (event.key === "ArrowLeft") {
      next = open ? { share: shareFor(px + KEY_STEP, width), open } : { share, open: true };
    } else if (event.key === "ArrowRight") {
      if (!open) return;
      next =
        px > PREVIEW_MIN + 0.5
          ? { share: shareFor(px - KEY_STEP, width), open }
          : { share, open: false };
    } else return;
    event.preventDefault();
    setState(next);
  }

  const previewShown = wide ? open : showPreview;

  return (
    // A size container, so the panel can size itself against the workspace (cqw).
    <div
      ref={workspaceRef}
      className="@container relative flex h-dvh min-w-0 flex-1 overflow-hidden"
    >
      {/* From md up, the chat keeps CHAT_MIN, or half the width in a window too narrow for both. */}
      <div className="relative flex min-w-[min(22.5rem,50%)] flex-1 flex-col max-md:min-w-0">
        {/*
         * Floats over the chat, which scrolls up under it. Only its controls take the pointer, so the
         * wheel over the rest still scrolls the chat. From md up, its row lines up with the prompt
         * input, so the preview button sits above the input's right end. The side columns are as
         * wide as the buttons, so the title stays centered.
         */}
        <header className="pointer-events-none absolute inset-x-0 top-0 z-20 p-3 md:px-4">
          <div className="mx-auto grid max-w-3xl grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 *:pointer-events-auto">
            <button
              type="button"
              onClick={onOpenSheet}
              aria-label="Open sidebar"
              aria-haspopup="dialog"
              className={`${ICON_BUTTON} md:hidden`}
            >
              <PanelLeftOpenIcon className="size-5" />
            </button>
            <ProjectTitle id={id} />
            <button
              type="button"
              onClick={toggle}
              aria-label={previewShown ? (wide ? "Hide preview" : "Back to chat") : "Show preview"}
              aria-expanded={previewShown}
              aria-controls={panelId}
              className={`${ICON_BUTTON} relative col-start-3`}
            >
              {/* From md up: the panel's icon. */}
              {open ? (
                <PanelRightCloseIcon className="size-5 max-md:hidden" />
              ) : (
                <PanelRightOpenIcon className="size-5 max-md:hidden" />
              )}
              {/* On phones: the preview's icon, spinning into the chat's and back. */}
              <AppWindowIcon
                className={`absolute inset-0 m-auto size-5 transition duration-300 ease-spring motion-reduce:transition-none md:hidden ${
                  showPreview ? "scale-50 -rotate-90 opacity-0" : ""
                }`}
              />
              <MessageSquareIcon
                className={`absolute inset-0 m-auto size-5 transition duration-300 ease-spring motion-reduce:transition-none md:hidden ${
                  showPreview ? "" : "scale-50 rotate-90 opacity-0"
                }`}
              />
            </button>
          </div>
        </header>

        {/*
         * On phones, recedes to the left as the preview comes in, and comes back from the left. At
         * rest it has no transform, which would pin the chat's toast (position: fixed) to it.
         */}
        <div
          inert={!wide && showPreview}
          className={`flex min-h-0 flex-1 flex-col transition-[translate,scale,opacity] duration-500 ease-slide motion-reduce:transition-none ${
            showPreview ? "max-md:-translate-x-1/3 max-md:scale-[0.92] max-md:opacity-0" : ""
          }`}
        >
          {children}
        </div>
      </div>

      {/* Between the chat and the panel; at the right edge while the panel is hidden. */}
      <div className="relative shrink-0 max-md:hidden">
        <ResizeHandle
          label="Resize preview"
          controls={panelId}
          min={0}
          max={100}
          now={open ? Math.round(share * 100) : 0}
          dragging={dragging}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onDragEnd={endDrag}
          onKeyDown={handleKeyDown}
          className={open ? "-left-1.5" : "-left-3"}
        />
      </div>

      <aside
        id={panelId}
        aria-label="Preview"
        inert={!previewShown}
        style={{
          flexBasis: open
            ? `clamp(${PREVIEW_MIN}px, ${share * 100}%, 100% - ${CHAT_MIN}px)`
            : "0px",
        }}
        className={`flex min-w-0 shrink flex-col overflow-hidden md:border-l md:bg-white/60 md:backdrop-blur-xl md:dark:bg-zinc-900/60 ${
          open ? "md:border-zinc-950/10 md:dark:border-white/10" : "md:border-transparent"
        } ${
          // From md up, the width follows the pointer while dragging and animates when toggled.
          dragging
            ? ""
            : "transition-[flex-basis,border-color,translate,scale,border-radius,visibility] duration-200 ease-out max-md:duration-500 max-md:ease-slide motion-reduce:transition-none"
        } max-md:absolute max-md:inset-x-0 max-md:top-16 max-md:bottom-0 max-md:z-10 max-md:bg-page max-md:shadow-[-1.5rem_0_3rem_-1.5rem_rgb(0_0_0/0.25)] ${
          showPreview
            ? ""
            : "max-md:invisible max-md:translate-x-full max-md:scale-[0.96] max-md:rounded-[2rem]"
        }`}
      >
        {project && <PreviewPanel project={project} dragging={dragging} />}
      </aside>
    </div>
  );
}
