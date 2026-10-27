"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { PanelLeft } from "lucide-react";
import { AccountMenu } from "@/components/AccountMenu";
import { DesktopSidebar, MobileSidebar } from "@/components/Sidebar";
import { focusRing } from "@/components/styles";
import type { CurrentUser } from "@/lib/auth/session";
import { SIDEBAR_COLLAPSED_COOKIE, SIDEBAR_WIDTH_COOKIE } from "@/lib/sidebar";
import type { SidebarState } from "@/lib/sidebar";

const YEAR_S = 365 * 24 * 60 * 60;

/** Remembered in cookies, so the page renders at this size next time with no jump. */
function saveSidebar({ width, collapsed }: SidebarState) {
  const options = `; path=/; max-age=${YEAR_S}; samesite=lax`;
  document.cookie = `${SIDEBAR_WIDTH_COOKIE}=${width}${options}`;
  document.cookie = `${SIDEBAR_COLLAPSED_COOKIE}=${collapsed ? 1 : 0}${options}`;
}

type AppShellProps = {
  user: CurrentUser;
  sidebar: SidebarState; // As saved, read by the page.
  children: ReactNode;
};

/**
 * The signed-in layout: a sidebar on the left on wider screens. On phones, a
 * header with a sidebar button and the account menu; the sidebar slides over.
 */
export function AppShell({ user, sidebar: saved, children }: AppShellProps) {
  const [sidebar, setSidebar] = useState(saved);
  const [mobileOpen, setMobileOpen] = useState(false);
  const openRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  const commitSidebar = useCallback((next: SidebarState) => {
    setSidebar(next);
    saveSidebar(next);
  }, []);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

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

  // Close it when the page is hidden (cacheComponents keeps it alive), so it isn't open on return.
  useLayoutEffect(() => {
    return () => {
      setMobileOpen(false);
      wasOpen.current = false;
    };
  }, []);

  return (
    <div className="flex flex-1">
      <DesktopSidebar user={user} state={sidebar} onChange={setSidebar} onCommit={commitSidebar} />

      {/* Out of reach while the phone sidebar covers it. */}
      <div inert={mobileOpen} className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between px-3 md:hidden">
          <button
            ref={openRef}
            type="button"
            aria-label="Open sidebar"
            aria-expanded={mobileOpen}
            aria-controls={id}
            onClick={() => setMobileOpen(true)}
            className={`grid size-10 cursor-pointer place-items-center rounded-xl text-muted transition-colors hover:bg-foreground/5 hover:text-foreground ${focusRing}`}
          >
            <PanelLeft size={20} />
          </button>
          <AccountMenu user={user} />
        </header>
        {children}
      </div>

      <MobileSidebar id={id} user={user} open={mobileOpen} onClose={closeMobile} closeRef={closeRef} />
    </div>
  );
}
