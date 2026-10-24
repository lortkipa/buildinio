"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { authClient, isUnreachable, settle, UNREACHABLE } from "./auth-client";
import {
  CANCEL_BUTTON,
  DANGER_BUTTON,
  DIALOG_TITLE,
  Dialog,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
} from "./dialog";
import {
  CircleAlertIcon,
  LaptopIcon,
  LoaderIcon,
  SmartphoneIcon,
  TabletIcon,
  TriangleAlertIcon,
} from "./icons";
import { MOCK_SESSIONS } from "./mock-settings";
import { DANGER_FIELD, HINT, SettingsGroup } from "./settings-parts";

export type Device = { name: string; kind: "computer" | "phone" | "tablet" };

const DEVICE_ICONS = { computer: LaptopIcon, phone: SmartphoneIcon, tablet: TabletIcon };

// The first match names the browser, so those built on another come before it (Edge before Chrome,
// Chrome before Safari).
const BROWSERS: [RegExp, string][] = [
  [/Edg(e|A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser/, "Samsung Internet"],
  [/Firefox\/|FxiOS/, "Firefox"],
  [/Chrome\/|CriOS/, "Chrome"],
  [/Safari\//, "Safari"],
];

const SYSTEMS: [RegExp, string, Device["kind"]][] = [
  [/iPhone/, "iPhone", "phone"],
  [/iPad/, "iPad", "tablet"],
  [/Android.*Mobile/, "Android", "phone"],
  [/Android/, "Android", "tablet"],
  [/Windows/, "Windows", "computer"],
  [/CrOS/, "ChromeOS", "computer"],
  [/Mac OS X|Macintosh/, "macOS", "computer"],
  [/Linux/, "Linux", "computer"],
];

// A device from its browser's user agent, e.g. "Chrome on Linux".
function describeDevice(userAgent: string): Device {
  const browser = BROWSERS.find(([pattern]) => pattern.test(userAgent))?.[1];
  const system = SYSTEMS.find(([pattern]) => pattern.test(userAgent));
  const name = [browser, system?.[1]].filter(Boolean).join(" on ");
  return { name: name || "This browser", kind: system?.[2] ?? "computer" };
}

// This device, worked out once. The server can't know, so null there.
let thisDevice: Device | undefined;
const noChange = () => () => {};
const useThisDevice = () =>
  useSyncExternalStore(
    noChange,
    () => {
      thisDevice ??= describeDevice(navigator.userAgent);
      return thisDevice;
    },
    () => null,
  );

/*
 * The devices the user is logged in on, and deleting the account. This device is real, the others
 * are mocked (mock-settings.ts), and logging them out does nothing yet. Deleting works: the
 * button opens DeleteAccountDialog, which SettingsDialog renders.
 */
export function AccountTab({ onDeleteAccount }: { onDeleteAccount: () => void }) {
  const device = useThisDevice() ?? { name: "This browser", kind: "computer" };
  const deleteTitleId = useId();

  return (
    <>
      <SettingsGroup title="Devices" description="Where you’re logged in.">
        <ul className="divide-y divide-zinc-950/10 rounded-2xl border border-zinc-950/10 dark:divide-white/10 dark:border-white/10">
          <DeviceRow device={device} current />
          {MOCK_SESSIONS.map((session) => (
            <DeviceRow key={session.id} device={session} lastActive={session.lastActive} />
          ))}
        </ul>
        {/* Not built yet. */}
        <button type="button" className={`mt-3 ${SECONDARY_BUTTON}`}>
          Log out of all other devices
        </button>
      </SettingsGroup>

      <section
        aria-labelledby={deleteTitleId}
        className="mt-6 flex gap-3 rounded-2xl border border-red-600/20 bg-red-600/[0.04] p-4 dark:border-red-400/20 dark:bg-red-400/[0.06]"
      >
        <TriangleAlertIcon className="mt-px size-5 shrink-0 text-red-600 dark:text-red-400" />
        <div className="min-w-0 flex-1">
          <h4 id={deleteTitleId} className="text-sm font-semibold text-red-700 dark:text-red-400">
            Delete account
          </h4>
          <p className={`mt-1 ${HINT}`}>
            Permanently delete your account and everything in it. This can’t be undone.
          </p>
          <button
            type="button"
            aria-haspopup="dialog"
            onClick={onDeleteAccount}
            className={`mt-4 ${DANGER_BUTTON}`}
          >
            Delete account
          </button>
        </div>
      </section>
    </>
  );
}

function DeviceRow({
  device,
  current = false,
  lastActive,
}: {
  device: Device;
  current?: boolean;
  lastActive?: string;
}) {
  const Icon = DEVICE_ICONS[device.kind];
  return (
    <li className="flex items-center gap-3 p-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-950/5 text-zinc-700 dark:bg-white/10 dark:text-zinc-300">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate-fade text-sm font-medium">{device.name}</p>
        <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
          {current ? (
            <>
              <span aria-hidden className="size-1.5 rounded-full bg-emerald-500" />
              Active now
            </>
          ) : (
            `Last active ${lastActive}`
          )}
        </p>
      </div>
      {current ? (
        <span className="shrink-0 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          This device
        </span>
      ) : (
        // Not built yet.
        <button
          type="button"
          aria-label={`Log out of ${device.name}`}
          className="h-8 shrink-0 rounded-full px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
        >
          Log out
        </button>
      )}
    </li>
  );
}

/*
 * Confirming the account's deletion: typing the account's email turns on Delete, which deletes it
 * in the API (Better Auth's deleteUser; its sessions and linked sign-ins go with it) and loads the
 * signed-out landing page.
 *
 * session: a new number each time it opens, for an empty field.
 */
export function DeleteAccountDialog({
  open,
  session,
  email,
  onClose,
}: {
  open: boolean;
  session: number;
  email: string;
  onClose: () => void;
}) {
  const titleId = useId();
  return (
    <Dialog
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      className="w-[min(calc(100%-2rem),24rem)]"
    >
      <DeleteAccountForm key={session} email={email} titleId={titleId} onCancel={onClose} />
    </Dialog>
  );
}

function DeleteAccountForm({
  email,
  titleId,
  onCancel,
}: {
  email: string;
  titleId: string;
  onCancel: () => void;
}) {
  const fieldId = useId();
  const [typed, setTyped] = useState("");
  // Deleting, or logging out to log in again.
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Without a password, Better Auth deletes an account only from a session started within the last
  // day (its freshAge); an older one has to log in again first.
  const [mustLogIn, setMustLogIn] = useState(false);
  const submitRef = useRef<HTMLButtonElement>(null);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  // The field goes, which may have had the focus (Enter submits): Log in again takes it.
  useEffect(() => {
    if (mustLogIn) submitRef.current?.focus();
  }, [mustLogIn]);

  async function deleteAccount() {
    setBusy(true);
    setError(null);
    const { error } = await settle(authClient.deleteUser());
    if (error) {
      setBusy(false);
      if (error.code === "SESSION_EXPIRED") setMustLogIn(true);
      else
        setError(isUnreachable(error) ? UNREACHABLE : "Couldn’t delete your account. Try again.");
      return;
    }
    // A full page load: the landing page, signed out, without the deleted account's projects and
    // files still in memory. The button stays "Deleting…" until then.
    window.location.replace("/");
  }

  async function logInAgain() {
    setBusy(true);
    setError(null);
    const { error } = await settle(authClient.signOut());
    if (error) {
      setBusy(false);
      setError(isUnreachable(error) ? UNREACHABLE : "Couldn’t log out. Try again.");
      return;
    }
    window.location.replace("/login");
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        if (mustLogIn) logInAgain();
        else if (matches) deleteAccount();
      }}
      className="p-5"
    >
      <h2 id={titleId} className={DIALOG_TITLE}>
        Delete your account?
      </h2>
      {mustLogIn ? (
        <p role="alert" className={`mt-2 ${HINT}`}>
          For your security, log in again, then delete your account. You logged in more than a day
          ago.
        </p>
      ) : (
        <>
          <p className={`mt-2 ${HINT}`}>
            Your account, your projects and their chats will be deleted, and you’ll be logged out.
            This can’t be undone.
          </p>
          <label htmlFor={fieldId} className="mt-4 block text-sm text-pretty">
            To confirm, type{" "}
            <span className="font-semibold wrap-anywhere text-zinc-950 dark:text-white">
              {email}
            </span>
          </label>
          <input
            id={fieldId}
            data-autofocus
            type="text"
            inputMode="email"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            value={typed}
            // Not disabled: that would drop the focus and close the phone keyboard.
            readOnly={busy}
            onChange={(event) => setTyped(event.target.value)}
            className={`mt-2 ${DANGER_FIELD}`}
          />
        </>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 text-sm text-pretty text-red-600 dark:text-red-400"
        >
          <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onCancel} disabled={busy} className={CANCEL_BUTTON}>
          Cancel
        </button>
        {/* One button for both, so it keeps the focus when it turns into Log in again. */}
        <button
          ref={submitRef}
          type="submit"
          disabled={!mustLogIn && !matches}
          aria-disabled={busy}
          className={`flex items-center gap-2 aria-disabled:cursor-default ${
            mustLogIn ? PRIMARY_BUTTON : DANGER_BUTTON
          }`}
        >
          {busy && <LoaderIcon className="size-4" />}
          {mustLogIn
            ? busy
              ? "Logging out…"
              : "Log in again"
            : busy
              ? "Deleting…"
              : "Delete account"}
        </button>
      </div>
    </form>
  );
}
