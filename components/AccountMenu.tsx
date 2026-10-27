"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { LoaderCircle, LogOut, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { focusRing } from "@/components/styles";
import { deleteAccount, logOut } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/auth/session";

const menuItem = `flex h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;
const dialogButton = `flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:flex-1 ${focusRing}`;

// Where the menu opens, next to the button.
const PLACEMENTS = {
  "below-end": "top-full right-0 mt-2 origin-top-right",
  "above-start": "bottom-full left-0 mb-2 origin-bottom-left",
  "above-end": "bottom-full right-0 mb-2 origin-bottom-right",
};

type AccountMenuProps = {
  user: CurrentUser;
  trigger?: "avatar" | "row"; // Just the avatar, or a full-width row with the name and email too.
  placement?: keyof typeof PLACEMENTS;
  collapsed?: boolean; // Row only: hide the name and email, leaving the avatar.
};

/** The signed-in user's avatar; opens a menu to log out or delete the account. */
export function AccountMenu({
  user,
  trigger = "avatar",
  placement = "below-end",
  collapsed = false,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"logout" | "delete" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const id = useId();

  // Close everything when the page is hidden (cacheComponents keeps it alive),
  // so it isn't still open when you come back.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      setOpen(false);
      dialog?.close();
    };
  }, []);

  // Close on a click outside, or Escape.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
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
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open]);

  // Clearing the session cookie re-renders the home page, which swaps the app for the landing page.
  async function handleLogOut() {
    setBusy("logout");
    await logOut();
    toast.success("You’re logged out.");
  }

  async function handleDelete() {
    setBusy("delete");
    await deleteAccount();
    dialogRef.current?.close();
    toast.success("Your account was deleted.");
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label="Account"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        onClick={() => setOpen((value) => !value)}
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

      {open && (
        <div
          id={`${id}-menu`}
          className={`absolute z-50 w-64 rounded-2xl border border-border bg-surface p-1.5 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.18)] motion-safe:animate-pop ${PLACEMENTS[placement]}`}
        >
          <div className="flex items-center gap-3 px-3 pt-2.5 pb-3">
            <Avatar src={user.avatarUrl} size={40} />
            <NameAndEmail user={user} />
          </div>
          <div aria-hidden className="mx-1.5 mb-1.5 h-px bg-border" />
          <button
            type="button"
            onClick={handleLogOut}
            disabled={busy !== null}
            className={`${menuItem} text-foreground`}
          >
            {busy === "logout" ? (
              <LoaderCircle size={16} className="motion-safe:animate-spin" />
            ) : (
              <LogOut size={16} />
            )}
            Log out
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              dialogRef.current?.showModal();
            }}
            disabled={busy !== null}
            className={`${menuItem} text-error`}
          >
            <Trash2 size={16} />
            Delete account
          </button>
        </div>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
        // Stay open while the account is being deleted.
        onCancel={(event) => busy && event.preventDefault()}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-border bg-surface p-6 text-left text-foreground shadow-[0_24px_64px_-16px_rgb(0_0_0/0.35)] backdrop:bg-black/40 open:motion-safe:animate-pop"
      >
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-[-0.01em]">
          Delete your account?
        </h2>
        <p id={`${id}-text`} className="mt-2 text-sm text-balance text-muted">
          This permanently deletes your account for{" "}
          <span className="font-medium wrap-anywhere text-foreground">{user.email}</span>. It
          can&rsquo;t be undone.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <button
            type="button"
            autoFocus
            onClick={() => dialogRef.current?.close()}
            disabled={busy === "delete"}
            className={`${dialogButton} border border-border bg-surface enabled:hover:border-foreground/25`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busy === "delete"}
            className={`${dialogButton} bg-error text-background enabled:hover:bg-error/85`}
          >
            {busy === "delete" && <LoaderCircle size={16} className="motion-safe:animate-spin" />}
            Delete account
          </button>
        </div>
      </dialog>
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

function Avatar({ src, size }: { src: string; size: number }) {
  return (
    <Image
      src={src}
      alt=""
      width={size}
      height={size}
      unoptimized // Small pictures from Google, GitHub or our own SVG: nothing to gain.
      referrerPolicy="no-referrer" // Google's picture links can refuse requests from other sites.
      className="shrink-0 rounded-full bg-border object-cover"
      style={{ width: size, height: size }}
    />
  );
}
