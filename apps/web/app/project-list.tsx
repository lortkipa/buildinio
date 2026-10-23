"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState } from "react";
import { EllipsisIcon } from "./icons";
import { ProjectIcon } from "./project-icon";
import { type MenuAnchor, ProjectMenu } from "./project-menu";
import { type Project, useProjects } from "./projects";
import { useScrollFade } from "./scroll-fade";
import { SIDEBAR_ITEM } from "./sidebar-item";

/*
 * The user's projects, newest first, in the sidebar and the phone sheet, where onNavigate closes the
 * sheet. The heading stays put while the list scrolls, fading out at the edges.
 */
export function ProjectsSection({ onNavigate }: { onNavigate?: () => void }) {
  const id = useId();
  const projects = useProjects();
  const pathname = usePathname();
  const listRef = useRef<HTMLDivElement>(null);
  useScrollFade(listRef);

  return (
    <section aria-labelledby={id} className="mt-6 flex min-h-0 flex-1 flex-col whitespace-nowrap">
      <h2 id={id} className="px-4.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        Projects
      </h2>
      <div
        ref={listRef}
        className="prompt-scrollbar scroll-fade-edges mt-2 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2"
      >
        {projects.length === 0 ? (
          <p className="truncate-fade px-2.5 text-sm text-zinc-600 dark:text-zinc-300">
            No projects yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {projects.map((project) => (
              <ProjectItem
                key={project.id}
                project={project}
                current={pathname === `/projects/${project.id}`}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/*
 * A project: its icon and name, or a shimmer while the AI is naming it. The three dots open its menu,
 * as does a right-click. With a mouse or trackpad the dots show only on hover or focus; on touch
 * screens, always.
 */
function ProjectItem({
  project,
  current,
  onNavigate,
}: {
  project: Project;
  current: boolean;
  onNavigate?: () => void;
}) {
  const menuId = useId();
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const anchor = useRef<MenuAnchor>({ point: null });
  const [menuOpen, setMenuOpen] = useState(false);
  // Projects that showed up while the page was open come in with an animation, and so does a name
  // the AI picked while the page was open. Not those already there when the page loaded.
  const [arrived] = useState(project.name === null);
  const naming = project.name === null;

  function openAtPointer(event: React.MouseEvent) {
    const menu = menuRef.current;
    if (!menu) return;
    event.preventDefault();
    const point = { x: event.clientX, y: event.clientY };
    const show = () => {
      if (menu.matches(":popover-open")) menu.hidePopover();
      anchor.current.point = point;
      menu.showPopover();
    };
    // On Linux and macOS this comes as the button goes down, and the button coming up would count as
    // a click outside the menu, closing it again. So the menu opens once the button is up.
    if (event.buttons === 0) {
      show();
      return;
    }
    const released = () => {
      window.removeEventListener("pointerup", released, true);
      window.removeEventListener("pointercancel", released, true);
      setTimeout(show);
    };
    window.addEventListener("pointerup", released, true);
    window.addEventListener("pointercancel", released, true);
  }

  const reveal = arrived ? "animate-name-in motion-reduce:animate-none" : "";

  return (
    <li
      className={`group/project relative ${arrived ? "animate-item-in motion-reduce:animate-none" : ""}`}
    >
      <Link
        href={`/projects/${project.id}`}
        onClick={onNavigate}
        onContextMenu={openAtPointer}
        aria-current={current ? "page" : undefined}
        // Stays highlighted while its menu is open.
        className={`${SIDEBAR_ITEM} pr-10 ${menuOpen ? "bg-zinc-950/5 text-zinc-950 dark:bg-white/10 dark:text-white" : ""}`}
      >
        {naming ? (
          <>
            <span aria-hidden className="-mx-0.5 size-6 shrink-0 skeleton rounded-lg" />
            <span aria-hidden className="h-3 w-28 skeleton rounded-full" />
            <span className="sr-only">Naming your project…</span>
          </>
        ) : (
          <>
            <ProjectIcon
              icon={project.icon}
              color={project.color}
              className={`-mx-0.5 size-6 rounded-lg ${reveal}`}
            />
            <span className={`flex-1 truncate-fade ${reveal}`}>{project.name}</span>
          </>
        )}
      </Link>

      <button
        ref={triggerRef}
        type="button"
        popoverTarget={menuId}
        aria-label={`Options for ${project.name ?? "your new project"}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="absolute top-1/2 right-1 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 transition hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet aria-expanded:text-zinc-950 pointer-fine:opacity-0 pointer-fine:group-hover/project:opacity-100 pointer-fine:group-focus-within/project:opacity-100 pointer-fine:aria-expanded:opacity-100 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white dark:aria-expanded:text-white"
      >
        <EllipsisIcon className="size-4" />
      </button>

      <ProjectMenu
        project={project}
        id={menuId}
        menuRef={menuRef}
        triggerRef={triggerRef}
        anchor={anchor}
        onOpenChange={setMenuOpen}
      />
    </li>
  );
}
