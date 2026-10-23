"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderIcon, LogOutIcon, MessageSquareIcon, SettingsIcon } from "./icons";

// For an account without a picture. The API stores the same path on new email accounts
// (DEFAULT_AVATAR in apps/api/src/auth.ts).
const DEFAULT_AVATAR = "/avatars/default.svg";

// Between the menu and what opened it.
const GAP = 8;

// The signed-in user, and logging out. AppShell runs the logging out, so its toast sits outside the
// sidebar (whose backdrop blur would pin the fixed-position toast to it).
export type Account = {
  user: { name: string; email: string; image?: string | null };
  loggingOut: boolean;
  onLogOut: () => void;
};

/*
 * Where the menu opens from: the user card at the bottom of the expanded sidebar (the menu opens
 * above it), the avatar at the bottom of the collapsed sidebar (to its right), or the avatar in the
 * phone top bar (below it). Without the card, the menu starts with the name and email.
 */
type Placement = "card" | "rail" | "bar";

const MENU_PLACEMENT: Record<Placement, string> = {
  card: "min-w-56 origin-bottom",
  rail: "w-60 origin-bottom-left",
  bar: "w-60 max-w-[calc(100vw-2rem)] origin-top-right",
};

// The menu is a popover, drawn above everything at a fixed position, so nothing in the sidebar
// clips it. Places it next to the trigger, as it opens.
function placeMenu(menu: HTMLElement, trigger: HTMLElement, placement: Placement) {
  const rect = trigger.getBoundingClientRect();
  // The viewport without scrollbars, which fixed positions are measured in.
  const { clientWidth, clientHeight } = document.documentElement;
  const { style } = menu;
  if (placement === "card") {
    // Above the card, as wide as it.
    style.left = `${rect.left}px`;
    style.bottom = `${clientHeight - rect.top + GAP}px`;
    style.width = `${rect.width}px`;
  } else if (placement === "rail") {
    // To the right of the avatar, level with its bottom.
    style.left = `${rect.right + GAP}px`;
    style.bottom = `${clientHeight - rect.bottom}px`;
  } else {
    // Below the avatar, level with its right edge.
    style.top = `${rect.bottom + GAP}px`;
    style.right = `${clientWidth - rect.right}px`;
  }
}

// The user's picture: Google's or GitHub's, else the default silhouette.
function Avatar({ image, className = "" }: { image?: string | null; className?: string }) {
  return (
    <>
      {/*
       * no-referrer: Google's picture links can refuse requests that come with a referrer.
       * A plain img: pictures come from Google's or GitHub's servers at a small size,
       * and next/image would need each host listed for little gain.
       */}
      {/* biome-ignore lint/performance/noImgElement: see above */}
      <img
        src={image || DEFAULT_AVATAR}
        alt=""
        width={32}
        height={32}
        referrerPolicy="no-referrer"
        className={`size-8 shrink-0 rounded-full bg-zinc-200 object-cover dark:bg-zinc-800 ${className}`}
      />
    </>
  );
}

// The signed-in user, opening a menu with Settings, Send feedback and Log out. Only Log out works yet.
export function UserMenu({ account, placement }: { account: Account; placement: Placement }) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const { user, loggingOut, onLogOut } = account;

  // The menu stays where it opened, so close it when the window resizes rather than leave it
  // floating away from its trigger (which may even be hidden by then).
  useEffect(() => {
    if (!open) return;
    const close = () => menuRef.current?.hidePopover();
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [open]);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = index <= 0 ? items.length - 1 : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else {
      // Tab leaves the menu: close it, which puts focus back on the trigger, and Tab goes on from there.
      if (event.key === "Tab") menuRef.current?.hidePopover();
      return;
    }
    event.preventDefault();
    items[next]?.focus();
  }

  const close = () => menuRef.current?.hidePopover();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={`${id}-menu`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={placement === "card" ? undefined : "Your account"}
        className={`${
          placement === "card"
            ? "flex w-full items-center gap-3 p-1 text-left"
            : "grid size-10 place-items-center"
        } rounded-xl transition-colors hover:bg-zinc-950/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet aria-expanded:bg-zinc-950/5 dark:hover:bg-white/10 dark:aria-expanded:bg-white/10`}
      >
        <Avatar image={user.image} />
        {placement === "card" && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium">{user.name}</span>
            <span className="block truncate text-xs text-zinc-600 dark:text-zinc-300">
              {user.email}
            </span>
          </span>
        )}
      </button>

      <div
        ref={menuRef}
        id={`${id}-menu`}
        popover="auto"
        role="menu"
        aria-label="Your account"
        onBeforeToggle={(event) => {
          const trigger = triggerRef.current;
          if (event.newState === "open" && trigger)
            placeMenu(event.currentTarget, trigger, placement);
        }}
        onToggle={(event) => {
          const isOpen = event.newState === "open";
          setOpen(isOpen);
          if (isOpen) event.currentTarget.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
        }}
        onKeyDown={handleKeyDown}
        className={`${MENU_PLACEMENT[placement]} inset-auto m-0 rounded-2xl border border-zinc-950/10 bg-white/90 p-1.5 text-sm text-zinc-950 shadow-xl shadow-zinc-950/10 backdrop-blur-xl transition-[opacity,scale] duration-150 ease-out starting:open:scale-95 starting:open:opacity-0 motion-reduce:transition-none dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-50 dark:shadow-black/40`}
      >
        {placement !== "card" && (
          <div className="mb-1.5 flex items-center gap-3 border-b border-zinc-950/10 px-2 pt-1 pb-2.5 dark:border-white/10">
            <Avatar image={user.image} />
            <div className="min-w-0">
              <p className="truncate font-medium">{user.name}</p>
              <p className="truncate text-xs text-zinc-600 dark:text-zinc-300">{user.email}</p>
            </div>
          </div>
        )}
        {/* Settings and Send feedback are not built yet. */}
        <MenuItem icon={<SettingsIcon className="size-4" />} onClick={close}>
          Settings
        </MenuItem>
        <MenuItem icon={<MessageSquareIcon className="size-4" />} onClick={close}>
          Send feedback
        </MenuItem>
        {/* Stays open while logging out; the page then reloads signed out. */}
        <MenuItem
          icon={loggingOut ? <LoaderIcon className="size-4" /> : <LogOutIcon className="size-4" />}
          onClick={onLogOut}
          busy={loggingOut}
        >
          {loggingOut ? "Logging out…" : "Log out"}
        </MenuItem>
      </div>
    </>
  );
}

function MenuItem({
  icon,
  onClick,
  busy = false,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  busy?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      aria-disabled={busy}
      className="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-zinc-700 outline-none transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:bg-zinc-950/5 focus-visible:text-zinc-950 aria-disabled:cursor-default dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:bg-white/10 dark:focus-visible:text-white"
    >
      {icon}
      {children}
    </button>
  );
}
