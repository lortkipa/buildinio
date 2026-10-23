"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { authClient, isUnreachable, settle } from "./auth-client";
import { PanelLeftCloseIcon, PanelLeftOpenIcon } from "./icons";
import { ProjectDialogsProvider } from "./project-dialogs";
import { ProjectsSection } from "./project-list";
import { useProject } from "./projects";
import { Sidebar, SidebarNav } from "./sidebar";
import type { SidebarState } from "./sidebar-state";
import { Toast, useToast } from "./toast";
import { type Account, UserMenu } from "./user-menu";

const UNREACHABLE = "Couldn’t reach Buildinio. Check your connection and try again.";

// Tailwind's md breakpoint, from which the sidebar shows instead of the phone top bar and sheet.
const WIDE = "(min-width: 48rem)";

const ICON_BUTTON =
  "grid size-10 place-items-center rounded-xl text-zinc-700 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white";

/*
 * The signed-in pages around their main content: the sidebar from md up (sidebar.tsx). On phones, a
 * top bar instead, with a button opening the sidebar's contents as a full-screen sheet, and the
 * user's avatar opening the account menu. On a project's page, the bar shows the project's name in
 * the middle, on every screen size.
 */
export function AppShell({
  user,
  sidebar,
  children,
}: {
  user: Account["user"];
  sidebar: SidebarState;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const projectId = usePathname().match(/^\/projects\/([^/]+)$/)?.[1];
  const sheetRef = useRef<HTMLDialogElement>(null);
  const [loggingOut, setLoggingOut] = useState(false);
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

  const account: Account = { user, loggingOut, onLogOut: logOut };
  const closeSheet = () => sheetRef.current?.close();

  return (
    <ProjectDialogsProvider>
      <div className="relative isolate flex min-h-dvh">
        <div aria-hidden className="glow-bg" />

        <Sidebar initialState={sidebar} account={account} />

        {/* A project's page fills the screen exactly; its chat scrolls inside (ProjectChat). */}
        <div className={`flex min-w-0 flex-1 flex-col ${projectId ? "relative h-dvh" : ""}`}>
          {/* The side columns are as wide as the buttons, so the title stays centered without them. */}
          <header
            className={`grid shrink-0 grid-cols-[2.5rem_1fr_2.5rem] items-center gap-2 p-3 ${
              projectId
                ? // Floats over the chat, which scrolls up under it. Only its contents take the pointer,
                  // so the wheel over the rest still scrolls the chat.
                  "pointer-events-none absolute inset-x-0 top-0 z-10 *:pointer-events-auto"
                : "md:hidden"
            }`}
          >
            <button
              type="button"
              onClick={() => sheetRef.current?.showModal()}
              aria-label="Open sidebar"
              aria-haspopup="dialog"
              className={`${ICON_BUTTON} md:hidden`}
            >
              <PanelLeftOpenIcon className="size-5" />
            </button>
            {projectId && <ProjectTitle key={projectId} id={projectId} />}
            <div className="col-start-3 md:hidden">
              <UserMenu account={account} placement="bar" />
            </div>
          </header>

          {children}
        </div>

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
          <SidebarNav onNavigate={closeSheet} />
          <ProjectsSection onNavigate={closeSheet} />
        </dialog>

        <Toast toast={toast} onClose={closeToast} />
      </div>
    </ProjectDialogsProvider>
  );
}

// The open project's name in the top bar, or a shimmer while the AI is naming it.
function ProjectTitle({ id }: { id: string }) {
  const project = useProject(id);
  // A name the AI picked while the page was open fades in.
  const [arrived] = useState(project?.name === null);
  if (!project) return null;

  return (
    // The name fills the column, centered in it, so it fades out only when too long to fit.
    <h1 className="col-start-2 min-w-0 text-center text-sm font-medium sm:text-base">
      {project.name === null ? (
        <>
          <span aria-hidden className="mx-auto block h-3.5 w-32 skeleton rounded-full" />
          <span className="sr-only">Naming your project…</span>
        </>
      ) : (
        <span
          className={`block truncate-fade ${arrived ? "animate-name-in motion-reduce:animate-none" : ""}`}
        >
          {project.name}
        </span>
      )}
    </h1>
  );
}
