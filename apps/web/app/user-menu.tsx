"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderIcon, LogOutIcon, MessageSquareIcon, SettingsIcon } from "./icons";
import { handleMenuKeyDown, MENU_GAP, MENU_SURFACE, MenuItem } from "./menu";

// For an account without a picture. The API stores the same path on new email accounts
// (DEFAULT_AVATAR in apps/api/src/auth.ts).
const DEFAULT_AVATAR = "/avatars/default.svg";

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
    style.bottom = `${clientHeight - rect.top + MENU_GAP}px`;
    style.width = `${rect.width}px`;
  } else if (placement === "rail") {
    // To the right of the avatar, level with its bottom.
    style.left = `${rect.right + MENU_GAP}px`;
    style.bottom = `${clientHeight - rect.bottom}px`;
  } else {
    // Below the avatar, level with its right edge.
    style.top = `${rect.bottom + MENU_GAP}px`;
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
            <span className="block truncate-fade text-sm font-medium">{user.name}</span>
            <span className="block truncate-fade text-xs text-zinc-600 dark:text-zinc-300">
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
        onKeyDown={(event) => handleMenuKeyDown(event, close)}
        className={`${MENU_PLACEMENT[placement]} ${MENU_SURFACE}`}
      >
        {placement !== "card" && (
          <div className="mb-1.5 flex items-center gap-3 border-b border-zinc-950/10 px-2 pt-1 pb-2.5 dark:border-white/10">
            <Avatar image={user.image} />
            <div className="min-w-0 flex-1">
              <p className="truncate-fade font-medium">{user.name}</p>
              <p className="truncate-fade text-xs text-zinc-600 dark:text-zinc-300">{user.email}</p>
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
