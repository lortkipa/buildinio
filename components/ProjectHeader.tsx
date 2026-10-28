"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Ref } from "react";
import { useRouter } from "next/navigation";
import { AppWindow, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { DeleteProjectDialog, ProjectMenu, type ProjectMenuAnchor } from "@/components/ProjectActions";
import { ProjectLabel } from "@/components/ProjectTile";
import { circleButton, focusRing } from "@/components/styles";
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

type PreviewToggleProps = {
  pressed: boolean; // The preview is showing.
  controls: string; // The preview's id.
  onClick: () => void;
  ref?: Ref<HTMLButtonElement>;
};

/** Shows and hides the preview: next to the chat on wider screens, over it on phones. Same look either way. */
export function PreviewToggle({ pressed, controls, onClick, ref }: PreviewToggleProps) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Toggle preview"
      aria-pressed={pressed}
      aria-controls={controls}
      onClick={onClick}
      className={circleButton}
    >
      <AppWindow size={20} aria-hidden />
    </button>
  );
}
