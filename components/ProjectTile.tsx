"use client";

import { useStreamed } from "@/components/useStreamed";
import { PROJECT_COLORS, PROJECT_ICONS } from "@/lib/projects/options";
import type { ProjectColor, ProjectIcon } from "@/lib/projects/options";
import { NAME_CHAR_MS } from "@/lib/projects/store";
import type { Project } from "@/lib/projects/types";

type ProjectTileProps = {
  icon: ProjectIcon;
  color: ProjectColor;
  className?: string; // Size and corners, if not the sidebar's.
  iconSize?: number;
};

/** The project's icon, white on its color. */
export function ProjectTile({ icon, color, className = "size-5 rounded-md", iconSize = 12 }: ProjectTileProps) {
  const Icon = PROJECT_ICONS[icon];
  return (
    <span
      style={{ backgroundColor: PROJECT_COLORS[color] }}
      className={`grid shrink-0 place-items-center text-white transition-colors duration-500 ${className}`}
    >
      <Icon size={iconSize} strokeWidth={2.25} aria-hidden />
    </span>
  );
}

type ProjectLabelProps = {
  project: Project;
  tile?: boolean; // The colored icon before the name.
  className?: string; // For the name.
  ellipsis?: boolean; // Mobile chat titles end in dots instead of fading.
};

/**
 * The tile and the name. Skeletons while the AI picks a name; then it types itself out.
 * "New project" if nothing's naming it: its first prompt was stopped.
 */
export function ProjectLabel({ project, tile = true, className = "", ellipsis = false }: ProjectLabelProps) {
  const name = useStreamed(project.name ?? "New project", project.namedAt, NAME_CHAR_MS);
  if (project.name === null && project.turn) {
    return (
      <>
        {tile && <span className="skeleton size-5 shrink-0 rounded-md motion-safe:animate-shimmer" />}
        <span className="skeleton h-2.5 w-24 max-w-full rounded-full motion-safe:animate-shimmer" />
        <span className="sr-only">Naming your app…</span>
      </>
    );
  }
  return (
    <>
      {tile && <ProjectTile icon={project.icon} color={project.color} />}
      <span className={`${ellipsis ? "truncate" : "fade-end"} min-w-0 ${className}`}>{name}</span>
    </>
  );
}
