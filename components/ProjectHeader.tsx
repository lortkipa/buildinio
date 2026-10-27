"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AppWindow, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { DeleteProjectDialog, ProjectMenu, type ProjectMenuAnchor } from "@/components/ProjectActions";
import { ProjectLabel } from "@/components/ProjectTile";
import { focusRing } from "@/components/styles";
import { deleteProject, useProject } from "@/lib/projects/store";

/** The rounded project title and shared options on every screen size. */
export function ProjectTitle({ id }: { id: string }) {
  const { project } = useProject(id);
  const router = useRouter();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [menu, setMenu] = useState<{ anchor: ProjectMenuAnchor; trigger: HTMLButtonElement } | null>(null);
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  // Hidden layouts stay mounted. Don't restore an open menu or dialog on return.
  useLayoutEffect(() => () => {
    setMenu(null);
    setDialog(null);
  }, []);

  if (!project) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Options for ${project.name ?? "new project"}`}
        aria-haspopup="menu"
        aria-expanded={menu !== null}
        onClick={() => {
          const trigger = triggerRef.current;
          if (trigger) setMenu((open) => open ? null : {
            anchor: { rect: trigger.getBoundingClientRect(), from: "button", align: "center" },
            trigger,
          });
        }}
        className={`group flex h-10 max-w-full min-w-0 cursor-pointer items-center gap-2 rounded-full border border-transparent bg-surface px-4 text-sm font-semibold transition-colors hover:border-border hover:bg-[color-mix(in_srgb,var(--surface),var(--foreground)_5%)] aria-expanded:border-border aria-expanded:bg-[color-mix(in_srgb,var(--surface),var(--foreground)_5%)] ${focusRing}`}
      >
        <ProjectLabel project={project} tile={false} ellipsis />
        <ChevronDown size={16} className="shrink-0 text-muted transition-transform group-aria-expanded:rotate-180 motion-reduce:transition-none" aria-hidden />
      </button>
      {menu && (
        <ProjectMenu
          anchor={menu.anchor}
          trigger={menu.trigger}
          onClose={closeMenu}
          onEdit={() => { setMenu(null); setDialog("edit"); }}
          onDelete={() => { setMenu(null); setDialog("delete"); }}
        />
      )}
      {dialog === "edit" && <EditProjectDialog project={project} onClose={() => setDialog(null)} />}
      {dialog === "delete" && (
        <DeleteProjectDialog
          project={project}
          onClose={() => setDialog(null)}
          onDelete={() => {
            deleteProject(id);
            setDialog(null);
            router.replace("/");
            toast.success("Project deleted.");
          }}
        />
      )}
    </>
  );
}

/** Only the toggle state for now; the preview itself will be designed later. */
export function PreviewToggle() {
  const [active, setActive] = useState(false);
  return (
    <button
      type="button"
      aria-label="Toggle preview"
      aria-pressed={active}
      onClick={() => setActive((value) => !value)}
      className={`grid size-10 cursor-pointer place-items-center rounded-full bg-surface text-muted transition-colors hover:bg-foreground/5 hover:text-foreground ${focusRing}`}
    >
      <AppWindow size={20} aria-hidden />
    </button>
  );
}
