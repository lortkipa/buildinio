"use client";

import { useLayoutEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis } from "lucide-react";
import type { ProjectMenuAnchor } from "@/components/ProjectActions";
import { ProjectLabel } from "@/components/ProjectTile";
import { navItem, rowOptions, rowOptionsOnHover } from "@/components/styles";
import { useMenuPress } from "@/components/useMenuPress";
import { usePlayOnce } from "@/components/usePlayOnce";
import { useProjectMenu } from "@/components/useProjectMenu";
import { useScrollEdges } from "@/components/useScrollEdges";
import { isNew, useProjects } from "@/lib/projects/store";
import type { Project } from "@/lib/projects/types";

// Preserve the desktop and mobile list positions when the workspace is hidden.
const listScroll = { desktop: 0, mobile: 0 };

type ProjectListProps = {
  mobile?: boolean; // The phone sidebar: options always show, and the avatar floats over the end.
  onNavigate?: () => void;
};

/** The projects in the sidebar, newest first, with a menu to edit or delete each. */
export function ProjectList({ mobile = false, onNavigate }: ProjectListProps) {
  const { loaded, projects } = useProjects();
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const menu = useProjectMenu(onNavigate);
  useScrollEdges(scrollRef);

  // Pick up where the list was, before it paints: on mount, when a hidden page shows
  // again, and once the projects are in (until then it's too short to scroll).
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const slot = mobile ? "mobile" : "desktop";
    el.scrollTop = listScroll[slot];
    const onScroll = () => {
      listScroll[slot] = el.scrollTop;
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [mobile, loaded]);

  return (
    <>
      <div ref={scrollRef} className="scrollbar-thin fade-y min-h-0 flex-1 overflow-y-auto px-2">
        <div className={mobile ? "pb-24" : "pb-2"}>
          {loaded &&
            (projects.length === 0 ? (
              <ProjectsEmpty />
            ) : (
              <ul className="flex flex-col gap-0.5">
                {projects.map((project) => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    current={pathname === `/projects/${project.id}`}
                    mobile={mobile}
                    menuOpen={menu.openId === project.id}
                    onMenu={(anchor, trigger) => menu.openMenu(project, anchor, trigger)}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>
            ))}
        </div>
      </div>

      {menu.dialogs}
    </>
  );
}

type ProjectRowProps = {
  project: Project;
  current: boolean;
  mobile: boolean;
  menuOpen: boolean;
  onMenu: (anchor: ProjectMenuAnchor, trigger: HTMLElement | null) => void;
  onNavigate?: () => void;
};

/**
 * A project: opens its chat. The options button shows on hover with a mouse, and
 * always on touch screens. Right-click, or holding a finger on it, opens the menu too.
 */
function ProjectRow({ project, current, mobile, menuOpen, onMenu, onNavigate }: ProjectRowProps) {
  const enter = usePlayOnce("motion-safe:animate-enter", isNew(project.id));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const { openFromButton, handlers } = useMenuPress(buttonRef, onMenu, onNavigate);

  return (
    <li className={`group/row relative ${enter.className}`} onAnimationEnd={enter.onAnimationEnd}>
      <Link
        href={`/projects/${project.id}`}
        aria-current={current ? "page" : undefined}
        draggable={false}
        {...handlers}
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
        className={`absolute top-1/2 right-1 -translate-y-1/2 ${rowOptions} ${mobile ? "" : rowOptionsOnHover}`}
      >
        <Ellipsis size={16} />
      </button>
    </li>
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
