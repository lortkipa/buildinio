"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { MouseEvent, ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { DesktopPreview, MobilePreview } from "@/components/Preview";
import { PreviewToggle, ProjectTitle } from "@/components/ProjectHeader";
import { ShareButton } from "@/components/ShareButton";
import { DesktopSidebar, MobileSidebar } from "@/components/Sidebar";
import { circleButton } from "@/components/styles";
import { useApplyTheme } from "@/components/useApplyTheme";
import { setMobilePreview, setPreviewState, useMobilePreview, usePreviewState } from "@/components/usePreviewState";
import { setSidebarState, useSidebarState } from "@/components/useSidebarState";
import { loadAccount, useAccount } from "@/lib/account/store";
import type { CurrentUser } from "@/lib/auth/session";
import type { PreviewState } from "@/lib/preview";
import { loadProjects, useProject } from "@/lib/projects/store";
import type { ProjectData } from "@/lib/projects/types";
import { COLLAPSED_WIDTH } from "@/lib/sidebar";
import type { SidebarState } from "@/lib/sidebar";

type AppShellProps = {
  user: CurrentUser;
  sidebar: SidebarState; // As saved, read by the shared layout.
  preview: PreviewState; // Likewise.
  projects: ProjectData[]; // Likewise.
  children: ReactNode;
};

/**
 * The signed-in layout: a sidebar on the left on wider screens, and a project's
 * preview on the right. On phones, a header with a sidebar button and the account
 * menu (or the preview button in project chats); the sidebar and preview slide over.
 */
export function AppShell({ user, sidebar: savedSidebar, preview: savedPreview, projects, children }: AppShellProps) {
  const pathname = usePathname();
  const { id: projectId } = useParams<{ id?: string }>();
  const sidebar = useSidebarState(savedSidebar);
  const preview = usePreviewState(savedPreview);
  const previewOpen = useMobilePreview(); // On phones; wider screens use `preview.open`.
  const [mobileOpen, setMobileOpen] = useState(false);
  const openRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null); // The button that opened the phone sidebar.
  const previewOpenRef = useRef<HTMLButtonElement>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const previewId = `${id}-preview`;
  const panelId = `${id}-panel`;

  // The project to preview: none on New, or for a project that doesn't exist.
  const { loaded, project } = useProject(projectId ?? "");
  const previewProject = projectId && (project || !loaded) ? projectId : null;

  const changeSidebar = useCallback((next: SidebarState) => setSidebarState(next, false), []);
  const commitSidebar = useCallback((next: SidebarState) => setSidebarState(next, true), []);
  const changePreview = useCallback((next: PreviewState) => setPreviewState(next, false), []);
  const commitPreview = useCallback((next: PreviewState) => setPreviewState(next, true), []);

  const openMobile = useCallback((event: MouseEvent<HTMLButtonElement>) => {
    opener.current = event.currentTarget;
    setMobileOpen(true);
  }, []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const closePreview = useCallback(() => setMobilePreview(false), []);

  // From here on the stores keep them up to date (see lib/projects/store.ts and lib/account/store.ts).
  useEffect(() => {
    loadProjects(user.id, projects);
  }, [user.id, projects]);
  useEffect(() => {
    loadAccount(user);
  }, [user]);
  useApplyTheme(useAccount(user).theme);

  // Focus moves into the phone sidebar when it opens, and back to the button that
  // opened it when it closes. After rendering: until then, one or the other is still
  // hidden or inert.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (mobileOpen) closeRef.current?.focus();
    else if (wasOpen.current) (opener.current ?? openRef.current)?.focus();
    wasOpen.current = mobileOpen;
  }, [mobileOpen]);

  // The same for the phone preview and its buttons.
  const wasPreviewOpen = useRef(false);
  useEffect(() => {
    if (previewOpen) previewCloseRef.current?.focus();
    else if (wasPreviewOpen.current) previewOpenRef.current?.focus();
    wasPreviewOpen.current = previewOpen;
  }, [previewOpen]);

  // They're only there on phones: close them if the screen gets wider.
  useEffect(() => {
    if (!mobileOpen && !previewOpen) return;
    const wide = window.matchMedia("(min-width: 48rem)");
    const onChange = () => {
      if (!wide.matches) return;
      setMobileOpen(false);
      setMobilePreview(false);
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [mobileOpen, previewOpen]);

  // Close on navigation and when the layout is hidden.
  useLayoutEffect(() => {
    return () => {
      setMobileOpen(false);
      setMobilePreview(false);
      wasOpen.current = false;
      wasPreviewOpen.current = false;
    };
  }, [pathname]);

  return (
    <div className="flex flex-1">
      <DesktopSidebar user={user} state={sidebar} onChange={changeSidebar} onCommit={commitSidebar} />

      {/* Out of reach while the phone sidebar or preview covers it. Keeps room for
          the chat next to the preview on wider screens. On phones, sideways swipes are
          left to the preview (see useSwipeSheet). */}
      <div
        ref={chatRef}
        inert={mobileOpen || previewOpen}
        className="flex min-w-0 flex-1 touch-pan-y touch-pinch-zoom flex-col md:min-w-90 md:touch-auto"
      >
        {/* With a title it stays on top while the page scrolls under it, and shows on wider
            screens too (just the title and the preview button: the sidebar has the rest).
            No background of its own: the chat fades out behind it (see ProjectChat). */}
        <header
          className={`relative flex h-14 shrink-0 items-center justify-between px-3 ${
            projectId ? "sticky top-0 z-20 md:px-6" : "md:hidden"
          }`}
        >
          <button
            ref={openRef}
            type="button"
            aria-label="Open sidebar"
            aria-expanded={mobileOpen}
            aria-controls={id}
            onClick={openMobile}
            className={`${circleButton} md:hidden`}
          >
            <PanelLeft size={20} />
          </button>
          {projectId ? (
            // On wider screens, as wide as the prompt box (see ProjectChat), so the
            // preview button lines up with its right edge.
            <div className="contents md:relative md:mx-auto md:flex md:h-full md:w-full md:max-w-2xl md:items-center md:justify-end">
              {/* Clear of the buttons on both sides, so it stays centered. */}
              <div
                className={`absolute inset-x-16 inset-y-0 flex items-center justify-center ${
                  previewProject && preview.open ? "md:inset-x-24" : "md:inset-x-12"
                }`}
              >
                <ProjectTitle key={projectId} id={projectId} />
              </div>
              {previewProject && (
                <>
                  <div className="md:hidden">
                    <PreviewToggle
                      ref={previewOpenRef}
                      pressed={previewOpen}
                      controls={previewId}
                      onClick={() => setMobilePreview(true)}
                    />
                  </div>
                  {/* Sharing the app sits next to it while the panel shows. */}
                  <div className="hidden items-center gap-2 md:flex">
                    {preview.open && <ShareButton key={previewProject} projectId={previewProject} />}
                    <PreviewToggle
                      pressed={preview.open}
                      controls={panelId}
                      onClick={() => commitPreview({ ...preview, open: !preview.open })}
                    />
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="md:hidden">
              <AccountMenu user={user} />
            </div>
          )}
        </header>
        {children}
      </div>

      {previewProject && (
        <>
          <DesktopPreview
            id={panelId}
            projectId={previewProject}
            state={preview}
            sidebarWidth={sidebar.collapsed ? COLLAPSED_WIDTH : sidebar.width}
            onChange={changePreview}
            onCommit={commitPreview}
          />
          <MobilePreview
            id={previewId}
            projectId={previewProject}
            open={previewOpen}
            onClose={closePreview}
            closeRef={previewCloseRef}
            swipeAreaRef={chatRef}
          />
        </>
      )}

      <MobileSidebar id={id} user={user} open={mobileOpen} onClose={closeMobile} closeRef={closeRef} />
    </div>
  );
}
