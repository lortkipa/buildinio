"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { EditProjectDialog } from "@/components/EditProjectDialog";
import { DeleteProjectDialog, ProjectMenu, type ProjectMenuAnchor } from "@/components/ProjectActions";
import { deleteProject, useProjects } from "@/lib/projects/store";
import type { Project } from "@/lib/projects/types";

type MenuState = { projectId: string; anchor: ProjectMenuAnchor; trigger: HTMLElement | null };

/**
 * The options menu of a list of projects (the sidebar's, the search's), with the Edit
 * and Delete dialogs it opens. Render `dialogs` next to the list. Deleting the project
 * that's open goes to New (`onNavigate` first). All of it closes on navigation.
 */
export function useProjectMenu(onNavigate?: () => void) {
  const { projects } = useProjects();
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Close menus and dialogs on navigation and when the workspace is hidden.
  useLayoutEffect(() => {
    return () => {
      setMenu(null);
      setEditingId(null);
      setDeletingId(null);
    };
  }, [pathname]);

  const closeMenu = useCallback(() => setMenu(null), []);

  const editing = projects.find((project) => project.id === editingId);
  const deleting = projects.find((project) => project.id === deletingId);

  function openMenu(project: Project, anchor: ProjectMenuAnchor, trigger: HTMLElement | null) {
    // The options button toggles its menu.
    setMenu((open) =>
      open?.projectId === project.id && open.anchor.from === "button" && anchor.from === "button"
        ? null
        : { projectId: project.id, anchor, trigger },
    );
  }

  function handleDelete(project: Project) {
    deleteProject(project.id);
    setDeletingId(null);
    if (pathname === `/projects/${project.id}`) {
      onNavigate?.();
      router.replace("/");
    }
    toast.success("Project deleted.");
  }

  const dialogs = (
    <>
      {menu && (
        <ProjectMenu
          key={menu.projectId}
          anchor={menu.anchor}
          trigger={menu.trigger}
          onClose={closeMenu}
          onEdit={() => {
            setMenu(null);
            setEditingId(menu.projectId);
          }}
          onDelete={() => {
            setMenu(null);
            setDeletingId(menu.projectId);
          }}
        />
      )}
      {editing && <EditProjectDialog project={editing} onClose={() => setEditingId(null)} />}
      {deleting && (
        <DeleteProjectDialog
          project={deleting}
          onDelete={() => handleDelete(deleting)}
          onClose={() => setDeletingId(null)}
        />
      )}
    </>
  );

  return { openId: menu?.projectId ?? null, openMenu, dialogs };
}
