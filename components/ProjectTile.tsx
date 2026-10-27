"use client";

import { useStreamed } from "@/components/useStreamed";
import { PROJECT_COLORS, PROJECT_ICONS } from "@/lib/projects/options";
import type { ProjectColor, ProjectIcon } from "@/lib/projects/options";
import { NAME_CHAR_MS, useProject } from "@/lib/projects/store";
import type { Project } from "@/lib/projects/types";

/** The project's icon, white on its color. */
export function ProjectTile({ icon, color }: { icon: ProjectIcon; color: ProjectColor }) {
  const Icon = PROJECT_ICONS[icon];
  return (
    <span
      style={{ backgroundColor: PROJECT_COLORS[color] }}
      className="grid size-5 shrink-0 place-items-center rounded-md text-white transition-colors duration-500"
    >
      <Icon size={12} strokeWidth={2.25} aria-hidden />
    </span>
  );
}

/** The tile and the name. Skeletons while the AI picks a name; then it types itself out. */
export function ProjectLabel({ project, className = "" }: { project: Project; className?: string }) {
  const name = useStreamed(project.name ?? "", project.namedAt, NAME_CHAR_MS);
  if (project.name === null) {
    return (
      <>
        <span className="skeleton size-5 shrink-0 rounded-md motion-safe:animate-shimmer" />
        <span className="skeleton h-2.5 w-24 rounded-full motion-safe:animate-shimmer" />
        <span className="sr-only">Naming your app…</span>
      </>
    );
  }
  return (
    <>
      <ProjectTile icon={project.icon} color={project.color} />
      <span className={`fade-end min-w-0 ${className}`}>{name}</span>
    </>
  );
}

/** Whether the sidebar and the chat's title show the project yet: from when the AI starts naming it. */
export function isListed(project: Project) {
  return project.name !== null || project.turn?.phase !== "thinking";
}

/** The project's name at the top of its chat. */
export function ProjectTitle({ id }: { id: string }) {
  const { project } = useProject(id);
  if (!project || !isListed(project)) return null;
  // The name sits in its own width plus room for the fade (balanced on the left), so a
  // name that fits doesn't fade and one that doesn't still fades out.
  return (
    <div className="flex max-w-full min-w-0 items-center gap-2 pl-8 text-sm font-semibold">
      <ProjectLabel project={project} className="pr-8" />
    </div>
  );
}
