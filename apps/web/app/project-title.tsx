"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDownIcon } from "./icons";
import { type MenuAnchor, ProjectMenu } from "./project-menu";
import { useProject } from "./projects";

/*
 * The open project's name in the top bar, or a shimmer while the AI is naming it. The name and its
 * arrow are a button opening the project's menu, the same as in the sidebar.
 */
export function ProjectTitle({ id }: { id: string }) {
  const project = useProject(id);
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const nameRef = useRef<HTMLSpanElement>(null);
  const anchor = useRef<MenuAnchor>({ point: null });
  const [menuOpen, setMenuOpen] = useState(false);
  // A name the AI picked while the page was open fades in.
  const [arrived] = useState(project?.name === null);
  const name = project?.name;

  // The button hugs the name, so the name fades out only when it is cut off (a pixel of slack for
  // fractional widths), not always at its end.
  // biome-ignore lint/correctness/useExhaustiveDependencies: checks again when the name changes
  useEffect(() => {
    const span = nameRef.current;
    if (!span) return;
    const update = () =>
      span.toggleAttribute("data-overflowing", span.scrollWidth > span.clientWidth + 1);
    update();
    const resize = new ResizeObserver(update);
    resize.observe(span);
    return () => resize.disconnect();
  }, [name]);

  if (!project) return null;

  return (
    <>
      {/* Only the button takes the pointer, so the wheel beside it still scrolls the chat. */}
      <h1 className="col-start-2 flex min-w-0 justify-center text-sm font-medium pointer-events-none! sm:text-base">
        {project.name === null ? (
          <>
            <span aria-hidden className="block h-3.5 w-32 skeleton rounded-full" />
            <span className="sr-only">Naming your project…</span>
          </>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            popoverTarget={menuId}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className={`pointer-events-auto flex h-9 max-w-full items-center gap-1 rounded-xl px-3 transition-colors hover:bg-zinc-950/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet aria-expanded:bg-zinc-950/5 dark:hover:bg-white/10 dark:aria-expanded:bg-white/10 ${
              arrived ? "animate-name-in motion-reduce:animate-none" : ""
            }`}
          >
            <span
              ref={nameRef}
              className="min-w-0 overflow-hidden whitespace-nowrap data-overflowing:truncate-fade"
            >
              {project.name}
            </span>
            <ChevronDownIcon className="size-4 shrink-0 text-zinc-500 dark:text-zinc-400" />
          </button>
        )}
      </h1>
      {/* Beside the heading, not in it, so it doesn't take on the heading's styles. */}
      {project.name !== null && (
        <ProjectMenu
          project={project}
          id={menuId}
          menuRef={menuRef}
          triggerRef={triggerRef}
          anchor={anchor}
          align="center"
          onOpenChange={setMenuOpen}
        />
      )}
    </>
  );
}
