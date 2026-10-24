"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient, isUnreachable, settle, UNREACHABLE } from "./auth-client";
import { FeedbackDialog } from "./feedback-dialog";
import { ICON_BUTTON } from "./icon-button";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "./icons";
import type { PreviewState } from "./preview-state";
import { ProjectDialogsProvider } from "./project-dialogs";
import { ProjectsSection } from "./project-list";
import { ProjectWorkspace } from "./project-workspace";
import { SearchDialog } from "./search-dialog";
import { SettingsDialog } from "./settings-dialog";
import { Sidebar, SidebarNav } from "./sidebar";
import type { SidebarState } from "./sidebar-state";
import { Toast, useToast } from "./toast";
import { type Account, UserMenu } from "./user-menu";
import { WIDE } from "./wide";

/*
 * The signed-in pages around their main content: the sidebar from md up (sidebar.tsx). On phones, a
 * top bar instead, with a button opening the sidebar's contents as a full-screen sheet, and the
 * user's avatar opening the account menu (also at the sheet's bottom right), whose Settings opens
 * the settings dialog (settings-dialog.tsx) and Send feedback the feedback dialog
 * (feedback-dialog.tsx). Search opens from either, and with Ctrl+K or ⌘K
 * (search-dialog.tsx). A project's page has its own top bar and its preview
 * (project-workspace.tsx); the preview's width and whether it shows are kept here, so the next
 * project opens with them as the user left them.
 */
export function AppShell({
  user,
  sidebar,
  preview: initialPreview,
  children,
}: {
  user: Account["user"];
  sidebar: SidebarState;
  preview: PreviewState;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const projectId = usePathname().match(/^\/projects\/([^/]+)$/)?.[1];
  const sheetRef = useRef<HTMLDialogElement>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [preview, setPreview] = useState(initialPreview);
  // Whether search is open, and a new session each time it opens, for a fresh search.
  const [search, setSearch] = useState({ open: false, session: 0 });
  // The same for settings, which open on their first tab with nothing changed.
  const [settings, setSettings] = useState({ open: false, session: 0 });
  // And for feedback, which opens with an empty message.
  const [feedback, setFeedback] = useState({ open: false, session: 0 });
  const { toast, showToast, closeToast } = useToast();

  // Server components read the session but can't pass on a refreshed session cookie. Asking once
  // from the browser lets the API extend the cookie along with the session.
  useEffect(() => {
    settle(authClient.getSession());
  }, []);

  // The sheet is for phones. Close it if the screen gets wide enough for the sidebar, rather than
  // leave a full-screen dialog over it.
  useEffect(() => {
    const wide = window.matchMedia(WIDE);
    const onChange = () => {
      if (wide.matches) sheetRef.current?.close();
    };
    wide.addEventListener("change", onChange);
    return () => wide.removeEventListener("change", onChange);
  }, []);

  // Ctrl+K or ⌘K opens search, also over the phone sheet, but not over a project's dialog. With
  // search open, it selects the field again.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "k" || !(event.ctrlKey || event.metaKey)) return;
      if (event.altKey || event.shiftKey) return;
      if (search.open) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("dialog[open] input[role=combobox]")?.select();
        return;
      }
      const otherModal = Array.from(document.querySelectorAll("dialog")).some(
        (dialog) => dialog !== sheetRef.current && dialog.matches(":modal"),
      );
      if (otherModal) return;
      event.preventDefault();
      setSearch(({ session }) => ({ open: true, session: session + 1 }));
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [search.open]);

  async function logOut() {
    if (loggingOut) return;
    setLoggingOut(true);
    const { error } = await settle(authClient.signOut());
    if (error) {
      setLoggingOut(false);
      showToast(isUnreachable(error) ? UNREACHABLE : "Couldn’t log out. Try again.");
      return;
    }
    // The landing page again, signed out. The menu stays "Logging out…" until then.
    router.refresh();
  }

  const openSettings = () => setSettings(({ session }) => ({ open: true, session: session + 1 }));
  const closeSettings = () => setSettings(({ session }) => ({ open: false, session }));
  const openFeedback = () => setFeedback(({ session }) => ({ open: true, session: session + 1 }));
  const closeFeedback = () => setFeedback(({ session }) => ({ open: false, session }));
  const account: Account = {
    user,
    loggingOut,
    onLogOut: logOut,
    onOpenSettings: openSettings,
    onOpenFeedback: openFeedback,
  };
  const openSheet = () => sheetRef.current?.showModal();
  const closeSheet = () => sheetRef.current?.close();
  const openSearch = () => setSearch(({ session }) => ({ open: true, session: session + 1 }));
  const closeSearch = () => setSearch(({ session }) => ({ open: false, session }));

  return (
    <ProjectDialogsProvider>
      <div className="relative isolate flex min-h-dvh">
        <div aria-hidden className="glow-bg" />

        <Sidebar initialState={sidebar} account={account} onSearch={openSearch} />

        {projectId ? (
          // A project's page fills the screen exactly; its chat scrolls inside (ProjectChat).
          <ProjectWorkspace
            key={projectId}
            id={projectId}
            preview={preview}
            onPreviewChange={setPreview}
            onOpenSheet={openSheet}
          >
            {children}
          </ProjectWorkspace>
        ) : (
          <div className="flex min-w-0 flex-1 flex-col">
            {/* The side columns are as wide as the buttons. */}
            <header className="grid shrink-0 grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 p-3 md:hidden">
              <button
                type="button"
                onClick={openSheet}
                aria-label="Open sidebar"
                aria-haspopup="dialog"
                className={ICON_BUTTON}
              >
                <PanelLeftOpenIcon className="size-5" />
              </button>
              <div className="col-start-3">
                <UserMenu account={account} placement="bar" />
              </div>
            </header>

            {children}
          </div>
        )}

        {/* Modal: focus stays inside, Escape closes it, and the page behind can't be used. */}
        <dialog
          ref={sheetRef}
          aria-label="Sidebar"
          className="m-0 h-dvh max-h-none w-full max-w-none -translate-x-full flex-col overflow-hidden bg-page text-zinc-950 transition-[translate,display,overlay] duration-300 ease-out transition-discrete backdrop:bg-transparent open:flex open:translate-x-0 starting:open:-translate-x-full motion-reduce:transition-none dark:text-zinc-50"
        >
          <div className="flex items-center justify-between p-3">
            <picture className="pl-2.5">
              <source
                media="(prefers-color-scheme: dark)"
                srcSet="/brand/buildinio-logo-dark-bg.svg"
              />
              <img
                src="/brand/buildinio-logo-light-bg.svg"
                alt="Buildinio"
                width={140}
                height={27}
              />
            </picture>
            <button
              type="button"
              onClick={closeSheet}
              aria-label="Close sidebar"
              className={ICON_BUTTON}
            >
              <PanelLeftCloseIcon className="size-5" />
            </button>
          </div>
          <SidebarNav onNavigate={closeSheet} onSearch={openSearch} />
          <ProjectsSection onNavigate={closeSheet} endGap />
          {/* Over the projects, so it moves nothing. The dialog is fixed, so this sits in its corner. */}
          <div className="absolute right-2 bottom-[max(0.5rem,env(safe-area-inset-bottom))]">
            <UserMenu account={account} placement="sheet" />
          </div>
        </dialog>

        {/* After the sheet, so they open above it. */}
        <SearchDialog
          open={search.open}
          session={search.session}
          onClose={closeSearch}
          onNavigate={closeSheet}
        />
        <SettingsDialog
          open={settings.open}
          session={settings.session}
          user={user}
          onClose={closeSettings}
        />
        <FeedbackDialog open={feedback.open} session={feedback.session} onClose={closeFeedback} />

        <Toast toast={toast} onClose={closeToast} />
      </div>
    </ProjectDialogsProvider>
  );
}
