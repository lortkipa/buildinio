"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { LoaderCircle, LogOut, Settings } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { SettingsDialog } from "@/components/SettingsDialog";
import { focusRing, menuItem, menuPanel } from "@/components/styles";
import { forgetAccount, useAccount } from "@/lib/account/store";
import { logOut } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/auth/session";

// The animation starts at the corner nearest the account button.
const PLACEMENTS = {
  "below-end": "origin-top-right",
  "above-start": "origin-bottom-left",
  "above-end": "origin-bottom-right",
};

type AccountMenuProps = {
  user: CurrentUser;
  trigger?: "avatar" | "row"; // Just the avatar, or a full-width row with the name and email too.
  placement?: keyof typeof PLACEMENTS;
  collapsed?: boolean; // Row only: hide the name and email, leaving the avatar.
};

/** The signed-in user's avatar; opens a menu with the settings and logging out. */
export function AccountMenu({
  user: savedUser,
  trigger = "avatar",
  placement = "below-end",
  collapsed = false,
}: AccountMenuProps) {
  const user = useAccount(savedUser);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const id = useId();

  // Close everything on navigation and when the containing layout is hidden.
  useLayoutEffect(() => {
    return () => {
      setOpen(false);
      setSettingsOpen(false);
    };
  }, [pathname]);

  // Position outside the sidebar's stacking and clipping contexts, before paint.
  useLayoutEffect(() => {
    const button = buttonRef.current;
    const menu = menuRef.current;
    if (!open || !button || !menu) return;
    const rect = button.getBoundingClientRect();
    const edge = 8;
    const gap = 4;
    const left = placement === "above-start" ? rect.left : rect.right - menu.offsetWidth;
    const top = placement === "below-end" ? rect.bottom + gap : rect.top - menu.offsetHeight - gap;
    menu.style.left = `${Math.max(edge, Math.min(left, window.innerWidth - menu.offsetWidth - edge))}px`;
    menu.style.top = `${Math.max(edge, Math.min(top, window.innerHeight - menu.offsetHeight - edge))}px`;
  }, [open, placement]);

  // Close on a click outside, or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    // Captured and marked handled, so the phone sidebar around it stays open.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown, true);
    const close = () => setOpen(false);
    document.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  // Clearing the session cookie re-renders the home page, which swaps the app for the landing page.
  async function handleLogOut() {
    setLoggingOut(true);
    await logOut();
    forgetAccount();
    toast.success("You’re logged out.");
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={(event) => {
          // Keep the portal in the phone sidebar's focus scope while it is open.
          setPortalContainer(event.currentTarget.closest<HTMLElement>("[role=dialog]") ?? document.body);
          setOpen((value) => !value);
        }}
        className={
          trigger === "row"
            ? `flex w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl p-1 text-left transition-colors hover:bg-foreground/5 aria-expanded:bg-foreground/5 ${focusRing}`
            : `block cursor-pointer rounded-full ${focusRing}`
        }
      >
        <Avatar src={user.avatarUrl} size={trigger === "row" ? 32 : 36} />
        {trigger === "row" && (
          <NameAndEmail
            user={user}
            className={`flex-1 leading-tight transition-opacity duration-200 ${collapsed ? "opacity-0" : ""}`}
          />
        )}
      </button>

      {open && portalContainer && createPortal(
        <div
          ref={menuRef}
          id={`${id}-menu`}
          className={`fixed top-0 left-0 z-50 w-64 max-w-[calc(100%-1rem)] ${menuPanel} ${PLACEMENTS[placement]}`}
        >
          <div className="flex items-center gap-3 px-3 pt-2.5 pb-3">
            <Avatar src={user.avatarUrl} size={40} />
            <NameAndEmail user={user} />
          </div>
          <div aria-hidden className="mx-1.5 mb-1.5 h-px bg-border" />
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={() => {
              setOpen(false);
              setSettingsOpen(true);
            }}
            disabled={loggingOut}
            className={`${menuItem} text-foreground`}
          >
            <Settings size={16} />
            Settings
          </button>
          <button
            type="button"
            onClick={handleLogOut}
            disabled={loggingOut}
            className={`${menuItem} text-foreground`}
          >
            {loggingOut ? <LoaderCircle size={16} className="motion-safe:animate-spin" /> : <LogOut size={16} />}
            Log out
          </button>
        </div>,
        portalContainer,
      )}

      {/* In the body: it stays put if the sidebar it was opened from is hidden by a resize. */}
      {settingsOpen &&
        createPortal(
          <SettingsDialog
            user={user}
            onClose={() => {
              setSettingsOpen(false);
              buttonRef.current?.focus();
            }}
          />,
          document.body,
        )}
    </div>
  );
}

/** Name over email; long ones fade out at the end. */
function NameAndEmail({ user, className = "" }: { user: CurrentUser; className?: string }) {
  return (
    <div className={`min-w-0 text-sm ${className}`}>
      <p className="fade-end font-semibold">{user.name}</p>
      <p className="fade-end text-muted">{user.email}</p>
    </div>
  );
}
