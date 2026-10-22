"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { authClient, isUnreachable, settle } from "./auth-client";
import { LoaderIcon, LogOutIcon, TrashIcon } from "./icons";
import { Toast, useToast } from "./toast";

// For an account without a picture. The API stores the same path on new email accounts
// (DEFAULT_AVATAR in apps/api/src/auth.ts).
const DEFAULT_AVATAR = "/avatars/default.svg";

const UNREACHABLE = "Couldn’t reach Buildinio. Check your connection and try again.";

// The signed-in user on the home page: who they are, Log out and Delete account.
export function AccountCard({
  user,
}: {
  user: { name: string; email: string; image?: string | null };
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const { toast, showToast, closeToast } = useToast();

  // Server components read the session but can't pass on a refreshed session cookie. Asking once
  // from the browser lets the API extend the cookie along with the session.
  useEffect(() => {
    settle(authClient.getSession());
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
    // The home page again, signed out. The card stays "Logging out…" until then.
    router.refresh();
  }

  return (
    <>
      <section
        aria-label="Your account"
        className="w-full rounded-3xl border border-zinc-950/10 bg-white/80 p-4 text-left shadow-sm backdrop-blur-xl sm:p-5 dark:border-white/10 dark:bg-zinc-900/75"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            {/*
             * no-referrer: Google's picture links can refuse requests that come with a referrer.
             * A plain img: pictures come from Google's or GitHub's servers at a small size,
             * and next/image would need each host listed for little gain.
             */}
            {/* biome-ignore lint/performance/noImgElement: see above */}
            <img
              src={user.image || DEFAULT_AVATAR}
              alt=""
              width={48}
              height={48}
              referrerPolicy="no-referrer"
              className="size-12 shrink-0 rounded-full bg-zinc-200 object-cover dark:bg-zinc-800"
            />
            <div className="min-w-0">
              <p className="truncate font-medium">{user.name}</p>
              <p className="truncate text-sm text-zinc-600 dark:text-zinc-300">{user.email}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={logOut}
              aria-disabled={loggingOut}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-full whitespace-nowrap border border-zinc-950/10 bg-white/60 px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-white hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet aria-disabled:cursor-default sm:flex-none dark:border-white/10 dark:bg-white/5 dark:text-zinc-200 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {loggingOut ? <LoaderIcon className="size-4" /> : <LogOutIcon className="size-4" />}
              {loggingOut ? "Logging out…" : "Log out"}
            </button>
            <button
              type="button"
              onClick={() => dialogRef.current?.showModal()}
              disabled={loggingOut}
              className="flex h-9 flex-1 items-center justify-center gap-2 rounded-full whitespace-nowrap px-4 text-sm font-medium text-red-600 transition-colors hover:bg-red-600/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet disabled:cursor-default disabled:opacity-50 disabled:hover:bg-transparent sm:flex-none dark:text-red-400 dark:hover:bg-red-400/10"
            >
              <TrashIcon className="size-4" />
              Delete account
            </button>
          </div>
        </div>
      </section>

      {/* Outside the card: its backdrop blur would pin the fixed-position toast to the card. */}
      <DeleteAccountDialog dialogRef={dialogRef} />
      <Toast toast={toast} onClose={closeToast} />
    </>
  );
}

// Asks before deleting. Better Auth only deletes with a recent sign-in (within a day); with an
// older one it answers SESSION_EXPIRED, and the dialog asks the user to log in again.
function DeleteAccountDialog({
  dialogRef,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
}) {
  const id = useId();
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "deleting" | "logging-out">("idle");
  const [expired, setExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = phase !== "idle";

  async function deleteAccount() {
    if (busy) return;
    setPhase("deleting");
    setError(null);
    const { error } = await settle(authClient.deleteUser());
    if (!error) {
      // The home page again, signed out; the card and this dialog go with the account.
      router.refresh();
      return;
    }
    setPhase("idle");
    if (error.code === "SESSION_EXPIRED") setExpired(true);
    else setError(isUnreachable(error) ? UNREACHABLE : "Couldn’t delete your account. Try again.");
  }

  async function logInAgain() {
    if (busy) return;
    setPhase("logging-out");
    await settle(authClient.signOut());
    router.push("/login");
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={`${id}-heading`}
      aria-describedby={`${id}-text`}
      // Escape closes it, except while a request is on its way.
      onCancel={(event) => busy && event.preventDefault()}
      onClose={() => {
        setExpired(false);
        setError(null);
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-3xl border border-zinc-950/10 bg-white p-6 text-zinc-950 shadow-2xl backdrop:bg-zinc-950/40 backdrop:backdrop-blur-sm dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-50 dark:backdrop:bg-black/60"
    >
      <h2 id={`${id}-heading`} className="font-display text-xl font-bold tracking-tight">
        {expired ? "Log in again to continue" : "Delete your account?"}
      </h2>
      <p id={`${id}-text`} className="mt-2 text-sm text-pretty text-zinc-600 dark:text-zinc-300">
        {expired
          ? "For your security, log in again before deleting your account. Then delete it from here."
          : "Your account will be deleted for good, and you’ll be logged out. This can’t be undone."}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* method="dialog": Cancel closes the dialog without any script. */}
      <form method="dialog" className="mt-6 flex justify-end gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex h-10 items-center rounded-full px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet disabled:opacity-50 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          Cancel
        </button>
        {expired ? (
          <button
            type="button"
            onClick={logInAgain}
            aria-disabled={busy}
            className="flex h-10 items-center gap-2 rounded-full bg-zinc-950 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet aria-disabled:cursor-default dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {phase === "logging-out" && <LoaderIcon className="size-4" />}
            Log in again
          </button>
        ) : (
          <button
            type="button"
            onClick={deleteAccount}
            aria-disabled={busy}
            className="flex h-10 items-center gap-2 rounded-full bg-red-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet aria-disabled:cursor-default aria-disabled:hover:bg-red-600"
          >
            {phase === "deleting" && <LoaderIcon className="size-4" />}
            {phase === "deleting" ? "Deleting…" : "Delete account"}
          </button>
        )}
      </form>
    </dialog>
  );
}
