"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useParams, usePathname } from "next/navigation";
import { PanelLeft } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { PreviewToggle, ProjectTitle } from "@/components/ProjectHeader";
import { DesktopSidebar, MobileSidebar } from "@/components/Sidebar";
import { focusRing } from "@/components/styles";
import { setSidebarState, useSidebarState } from "@/components/useSidebarState";
import type { CurrentUser } from "@/lib/auth/session";
import { loadProjects } from "@/lib/projects/store";
import type { SidebarState } from "@/lib/sidebar";

type AppShellProps = {
  user: CurrentUser;
  sidebar: SidebarState; // As saved, read by the shared layout.
  children: ReactNode;
};

/**
 * The signed-in layout: a sidebar on the left on wider screens. On phones, a
 * header with a sidebar button and the account menu; the sidebar slides over.
 */
export function AppShell({ user, sidebar: saved, children }: AppShellProps) {
  const pathname = usePathname();
  const { id: projectId } = useParams<{ id?: string }>();
  const title = projectId ? <ProjectTitle key={projectId} id={projectId} /> : null;
  const sidebar = useSidebarState(saved);
  const [mobileOpen, setMobileOpen] = useState(false);
  const openRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const changeSidebar = useCallback((next: SidebarState) => setSidebarState(next, false), []);
  const commitSidebar = useCallback((next: SidebarState) => setSidebarState(next, true), []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  // The user's projects live in this browser (see lib/projects/store.ts).
  useEffect(() => {
    loadProjects(user.id);
  }, [user.id]);

  // Focus moves into the phone sidebar when it opens, and back to its button when it
  // closes. After rendering: until then, one or the other is still hidden or inert.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (mobileOpen) closeRef.current?.focus();
    else if (wasOpen.current) openRef.current?.focus();
    wasOpen.current = mobileOpen;
  }, [mobileOpen]);

  // It's only there on phones: close it if the screen gets wider.
  useEffect(() => {
    if (!mobileOpen) return;
    const wide = window.matchMedia("(min-width: 48rem)");
    const onChange = () => wide.matches && setMobileOpen(false);
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, [mobileOpen]);

  // Close on navigation and when the layout is hidden.
  useLayoutEffect(() => {
    return () => {
      setMobileOpen(false);
      wasOpen.current = false;
    };
  }, [pathname]);

  return (
    <div className="flex flex-1">
      <DesktopSidebar user={user} state={sidebar} onChange={changeSidebar} onCommit={commitSidebar} />

      {/* Out of reach while the phone sidebar covers it. */}
      <div inert={mobileOpen} className="flex min-w-0 flex-1 flex-col">
        {/* With a title it stays on top while the page scrolls under it, and shows on wider
            screens too (just the title: the sidebar has the rest). No background of its own:
            the mobile chat blurs behind it (see ProjectChat). */}
        <header
          className={`relative flex h-14 shrink-0 items-center justify-between px-3 ${
            title ? "sticky top-0 z-20" : "md:hidden"
          }`}
        >
          <button
            ref={openRef}
            type="button"
            aria-label="Open sidebar"
            aria-expanded={mobileOpen}
            aria-controls={id}
            onClick={() => setMobileOpen(true)}
            className={`grid size-10 cursor-pointer place-items-center ${projectId ? "rounded-full bg-surface" : "rounded-xl"} text-muted transition-colors hover:bg-foreground/5 hover:text-foreground md:hidden ${focusRing}`}
          >
            <PanelLeft size={20} />
          </button>
          {title && (
            <div className="absolute inset-x-16 inset-y-0 flex items-center justify-center md:inset-x-6">
              {title}
            </div>
          )}
          <div className="md:hidden">
            {projectId ? <PreviewToggle key={projectId} /> : <AccountMenu user={user} />}
          </div>
        </header>
        {children}
      </div>

      <MobileSidebar id={id} user={user} open={mobileOpen} onClose={closeMobile} closeRef={closeRef} />
    </div>
  );
}
