"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent, ReactNode } from "react";
import {
  Camera,
  Check,
  Database,
  Download,
  LoaderCircle,
  Lock,
  Monitor,
  Moon,
  SlidersHorizontal,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { AvatarCropper } from "@/components/AvatarCropper";
import { dialogButton, dialogPanel, focusRing } from "@/components/styles";
import { useCloseOnBackdrop } from "@/components/useCloseOnBackdrop";
import { cleanName, DEFAULT_AVATAR, MAX_NAME, THEME_COLORS } from "@/lib/account/options";
import type { Theme } from "@/lib/account/options";
import { forgetAccount, removeAvatar, renameAccount, setAutocorrect, setTheme } from "@/lib/account/store";
import { deleteAccount } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/auth/session";
import { forgetProjects } from "@/lib/projects/store";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "general", label: "General", icon: SlidersHorizontal },
  { id: "data", label: "Data", icon: Database },
];
type Tab = "profile" | "general" | "data";

const closeButton = `grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-foreground/5 hover:text-foreground ${focusRing}`;
const pillButton = `flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;
const outlineButton = `${pillButton} border border-border bg-surface enabled:hover:border-foreground/25`;
const textInput =
  "h-11 w-full rounded-full border border-border bg-surface px-5 text-base text-foreground outline-none transition-colors placeholder:text-muted focus:border-foreground/40";

type SettingsDialogProps = {
  user: CurrentUser; // As the account store has them, so changes show here right away.
  onClose: () => void;
};

/** The account's settings, in tabs. Opens when it mounts. */
export function SettingsDialog({ user, onClose }: SettingsDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const tabRefs = useRef(new Map<Tab, HTMLButtonElement>());
  const id = useId();
  const backdrop = useCloseOnBackdrop(ref);
  const [tab, setTab] = useState<Tab>("profile");
  const [photo, setPhoto] = useState<string | null>(null); // A picked photo being cropped, as an object URL.
  const photoRef = useRef(photo);

  useEffect(() => {
    ref.current?.showModal();
    tabRefs.current.get("profile")?.focus();
  }, []);

  // The picked photo is the dialog's to let go of: when cropping ends, or when it closes mid-crop.
  useEffect(() => {
    photoRef.current = photo;
  }, [photo]);
  useEffect(() => () => void (photoRef.current && URL.revokeObjectURL(photoRef.current)), []);

  function endCrop() {
    if (photo) URL.revokeObjectURL(photo);
    setPhoto(null);
  }

  function select(next: Tab) {
    setTab(next);
    endCrop();
  }

  // Arrow keys move between the tabs (up and down beside the content, left and right above it).
  function handleTabKey(event: KeyboardEvent<HTMLDivElement>) {
    const index = TABS.findIndex((t) => t.id === tab);
    const steps: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    let next: number;
    if (event.key in steps) next = (index + steps[event.key] + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;
    event.preventDefault();
    select(TABS[next].id);
    tabRefs.current.get(TABS[next].id)?.focus();
  }

  const current = TABS.find((t) => t.id === tab)!;
  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      // React passes these on from the delete dialog inside too: only this one's count.
      onClose={(event) => event.target === event.currentTarget && onClose()}
      // Escape while cropping only puts the photo back.
      onCancel={(event) => {
        if (event.target !== event.currentTarget || !photo) return;
        event.preventDefault();
        endCrop();
      }}
      {...backdrop}
      className="m-auto h-[min(40rem,calc(100dvh-1rem))] w-[calc(100%-1rem)] max-w-3xl overflow-hidden rounded-3xl border border-border bg-surface p-0 text-left text-foreground shadow-[0_24px_64px_-16px_rgb(0_0_0/0.35)] outline-none backdrop:bg-black/40 open:motion-safe:animate-pop sm:h-[min(36rem,calc(100dvh-2rem))] sm:w-[calc(100%-2rem)]"
    >
      <div className="flex h-full flex-col sm:flex-row">
        <div className="shrink-0 px-4 pt-4 sm:w-52 sm:border-r sm:border-border sm:p-2">
          <div className="flex h-9 items-center justify-between pl-1 sm:h-12 sm:pl-2.5">
            <h2 id={`${id}-title`} className="text-lg font-semibold tracking-[-0.01em]">
              Settings
            </h2>
            <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className={`${closeButton} sm:hidden`}>
              <X size={18} />
            </button>
          </div>
          <div
            role="tablist"
            aria-label="Settings"
            onKeyDown={handleTabKey}
            className="mt-3 grid grid-cols-3 gap-1 rounded-full bg-foreground/5 p-1 sm:mt-1 sm:flex sm:flex-col sm:gap-0.5 sm:rounded-none sm:bg-transparent sm:p-0"
          >
            {TABS.map(({ id: value, label, icon: Icon }) => (
              <button
                key={value}
                ref={(element) => {
                  if (element) tabRefs.current.set(value, element);
                  else tabRefs.current.delete(value);
                }}
                type="button"
                role="tab"
                id={`${id}-tab-${value}`}
                aria-selected={tab === value}
                aria-controls={`${id}-panel`}
                tabIndex={tab === value ? 0 : -1}
                onClick={() => select(value)}
                className={`flex h-9 cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-medium text-muted transition-colors hover:text-foreground aria-selected:bg-surface aria-selected:text-foreground aria-selected:shadow-[0_1px_2px_rgb(0_0_0/0.08)] dark:aria-selected:bg-foreground/10 sm:h-10 sm:justify-start sm:gap-3 sm:rounded-xl sm:px-2.5 sm:text-foreground/80 sm:hover:bg-foreground/5 sm:aria-selected:bg-foreground/5 sm:aria-selected:shadow-none dark:sm:aria-selected:bg-foreground/5 ${focusRing}`}
              >
                <Icon size={18} className="shrink-0" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          role="tabpanel"
          id={`${id}-panel`}
          aria-labelledby={`${id}-tab-${tab}`}
          className="scrollbar-thin flex min-h-0 flex-1 flex-col overflow-y-auto"
        >
          <div className="hidden h-14 shrink-0 items-center justify-between pr-3 pl-7 sm:flex">
            <h3 className="text-base font-semibold">{current.label}</h3>
            <button type="button" aria-label="Close" onClick={() => ref.current?.close()} className={closeButton}>
              <X size={18} />
            </button>
          </div>
          <div className="flex-1 px-5 pt-6 pb-6 sm:px-7 sm:pt-2">
            {tab === "profile" &&
              (photo ? (
                <AvatarCropper src={photo} onDone={endCrop} />
              ) : (
                <ProfileTab user={user} onPick={(file) => setPhoto(URL.createObjectURL(file))} />
              ))}
            {tab === "general" && <GeneralTab user={user} />}
            {tab === "data" && <DataTab user={user} />}
          </div>
        </div>
      </div>
    </dialog>
  );
}

function ProfileTab({ user, onPick }: { user: CurrentUser; onPick: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [removing, setRemoving] = useState(false);
  const id = useId();

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // So picking the same file again still counts.
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Pick a picture, like a PNG or JPEG.");
      return;
    }
    onPick(file);
  }

  async function handleRemove() {
    setRemoving(true);
    await removeAvatar();
    setRemoving(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-5">
        {/* The same as "Change photo", for the pointer. */}
        <button
          type="button"
          tabIndex={-1}
          aria-hidden
          onClick={() => inputRef.current?.click()}
          className="group relative shrink-0 cursor-pointer rounded-full"
        >
          <Avatar src={user.avatarUrl} size={80} />
          <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Camera size={22} />
          </span>
        </button>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} className={outlineButton}>
            <Camera size={16} />
            Change photo
          </button>
          {user.avatarUrl !== DEFAULT_AVATAR && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing}
              className={`${pillButton} text-muted enabled:hover:bg-foreground/5 enabled:hover:text-foreground`}
            >
              {removing && <LoaderCircle size={16} className="motion-safe:animate-spin" />}
              Remove
            </button>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          aria-label="Photo"
          onChange={handleFile}
          className="hidden"
        />
      </div>

      <NameField user={user} />

      <div>
        <label htmlFor={`${id}-email`} className="block text-sm font-medium">
          Email
        </label>
        <div className="relative mt-2">
          <input
            id={`${id}-email`}
            type="email"
            value={user.email}
            readOnly
            className={`${textInput} cursor-default bg-foreground/[0.03] pr-12 text-muted focus:border-border`}
          />
          <Lock aria-hidden size={16} className="pointer-events-none absolute top-1/2 right-5 -translate-y-1/2 text-muted" />
        </div>
      </div>
    </div>
  );
}

/** The name, saved with Enter or the button that shows once it's changed. */
function NameField({ user }: { user: CurrentUser }) {
  const [name, setName] = useState(user.name);
  const [saved, setSaved] = useState(false);
  const id = useId();
  const clean = cleanName(name);
  const changed = clean !== "" && clean !== user.name;

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), 1600);
    return () => window.clearTimeout(timer);
  }, [saved]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!changed) return;
    renameAccount(clean);
    setName(clean);
    setSaved(true);
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor={`${id}-name`} className="block text-sm font-medium">
        Name
      </label>
      <div className="relative mt-2">
        <input
          id={`${id}-name`}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setSaved(false);
          }}
          maxLength={MAX_NAME}
          autoComplete="name"
          autoCapitalize="words"
          placeholder="Your name"
          className={`${textInput} pr-24`}
        />
        <div className="absolute inset-y-0 right-1.5 grid place-items-center">
          <button
            type="submit"
            inert={!changed}
            className={`col-start-1 row-start-1 h-8 cursor-pointer rounded-full bg-foreground px-3.5 text-sm font-medium text-background transition duration-200 hover:bg-foreground/85 ${focusRing} ${
              changed ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0"
            }`}
          >
            Save
          </button>
          <span
            role="status"
            className={`col-start-1 row-start-1 flex items-center gap-1 pr-3 text-sm font-medium text-emerald-600 transition duration-200 dark:text-emerald-400 ${
              saved && !changed ? "scale-100 opacity-100" : "scale-90 opacity-0"
            }`}
          >
            {saved && !changed && (
              <>
                <Check size={16} strokeWidth={2.5} />
                Saved
              </>
            )}
          </span>
        </div>
      </div>
    </form>
  );
}

const THEME_OPTIONS: { value: Theme; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

function GeneralTab({ user }: { user: CurrentUser }) {
  const id = useId();
  return (
    <div className="flex flex-col">
      <fieldset>
        <legend className="text-sm font-medium">Theme</legend>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
            const checked = user.theme === value;
            return (
              <label key={value} className="group cursor-pointer">
                <input
                  type="radio"
                  name={`${id}-theme`}
                  value={value}
                  checked={checked}
                  onChange={() => setTheme(value)}
                  className="peer sr-only"
                />
                <span
                  className={`relative block aspect-[4/3] overflow-hidden rounded-2xl border border-border transition-shadow peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-foreground ${
                    checked
                      ? "shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--foreground)]"
                      : "group-hover:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--border)]"
                  }`}
                >
                  <ThemePreview theme={value} />
                  <span
                    aria-hidden
                    className={`absolute top-1.5 right-1.5 grid size-5 place-items-center rounded-full bg-foreground text-background transition duration-200 ${
                      checked ? "scale-100 opacity-100" : "scale-50 opacity-0"
                    }`}
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                </span>
                <span className={`mt-2.5 flex items-center justify-center gap-1.5 text-sm font-medium transition-colors sm:justify-start ${checked ? "text-foreground" : "text-muted group-hover:text-foreground"}`}>
                  <Icon aria-hidden size={15} />
                  {label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div aria-hidden className="my-6 h-px bg-border" />

      <SettingRow
        title="Autocorrect"
        description="Underline misspelled words in prompts and suggest fixes."
        labelId={`${id}-autocorrect`}
      >
        <Switch
          checked={user.autocorrect}
          onChange={setAutocorrect}
          labelledBy={`${id}-autocorrect`}
        />
      </SettingRow>
    </div>
  );
}

// The app in miniature, in one theme's colors whatever the current one is.
const PREVIEW_COLORS = {
  light: { background: THEME_COLORS.light, surface: "#ffffff", line: "rgb(28 28 31 / 0.1)", text: "rgb(28 28 31 / 0.8)", faint: "rgb(28 28 31 / 0.12)" },
  dark: { background: THEME_COLORS.dark, surface: "#1c1c1f", line: "rgb(255 255 255 / 0.1)", text: "rgb(255 255 255 / 0.85)", faint: "rgb(255 255 255 / 0.16)" },
};

function ThemePreview({ theme }: { theme: Theme }) {
  if (theme === "system") {
    return (
      <>
        <MiniApp colors={PREVIEW_COLORS.light} />
        <div className="absolute inset-0 [clip-path:polygon(58%_0,100%_0,100%_100%,42%_100%)]">
          <MiniApp colors={PREVIEW_COLORS.dark} />
        </div>
      </>
    );
  }
  return <MiniApp colors={PREVIEW_COLORS[theme]} />;
}

function MiniApp({ colors }: { colors: (typeof PREVIEW_COLORS)["light"] }) {
  return (
    <span aria-hidden className="absolute inset-0 flex" style={{ background: colors.background }}>
      <span className="flex w-[30%] flex-col gap-1.5 border-r p-2" style={{ background: colors.surface, borderColor: colors.line }}>
        <span className="mb-1 size-2 rounded-full bg-[#ef4444]" />
        <span className="h-1.5 w-4/5 rounded-full" style={{ background: colors.faint }} />
        <span className="h-1.5 w-3/5 rounded-full" style={{ background: colors.faint }} />
        <span className="h-1.5 w-2/3 rounded-full" style={{ background: colors.faint }} />
      </span>
      <span className="flex flex-1 flex-col items-center justify-center gap-2 px-[10%]">
        <span className="h-1.5 w-3/5 rounded-full" style={{ background: colors.text }} />
        <span
          className="flex h-5 w-full items-center justify-end rounded-md border px-1"
          style={{ background: colors.surface, borderColor: colors.line }}
        >
          <span className="size-3 rounded-full" style={{ background: colors.text }} />
        </span>
      </span>
    </span>
  );
}

function SettingRow({
  title,
  description,
  labelId,
  children,
}: {
  title: string;
  description: string;
  labelId?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p id={labelId} className="text-sm font-medium">
          {title}
        </p>
        <p className="mt-0.5 text-sm text-muted">{description}</p>
      </div>
      {children}
    </div>
  );
}

function Switch({ checked, onChange, labelledBy }: { checked: boolean; onChange: (checked: boolean) => void; labelledBy: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-200 ${focusRing} ${
        checked ? "bg-foreground" : "bg-foreground/15"
      }`}
    >
      <span
        aria-hidden
        className={`absolute top-0.5 left-0.5 size-5 rounded-full shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition duration-200 ease-out motion-reduce:transition-none ${
          checked ? "translate-x-5 bg-background" : "bg-white"
        }`}
      />
    </button>
  );
}

function DataTab({ user }: { user: CurrentUser }) {
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const response = await fetch("/api/account/export");
      if (!response.ok) throw new Error(`Export failed: ${response.status}`);
      const name = /filename="([^"]+)"/.exec(response.headers.get("Content-Disposition") ?? "")?.[1];
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = name ?? "buildinio-export.zip";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      console.error(error);
      toast.error("Couldn’t export your data. Try again in a moment.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col">
      <SettingRow title="Export data" description="Your account, projects, chats and code, in a .zip file.">
        <button type="button" onClick={handleExport} disabled={exporting} className={outlineButton}>
          {exporting ? <LoaderCircle size={16} className="motion-safe:animate-spin" /> : <Download size={16} />}
          Export
        </button>
      </SettingRow>

      <div aria-hidden className="my-6 h-px bg-border" />

      <SettingRow title="Delete account" description="Permanently deletes your account and all your projects.">
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setConfirming(true)}
          className={`${pillButton} border border-error/30 text-error enabled:hover:border-error/60 enabled:hover:bg-error/5`}
        >
          Delete
        </button>
      </SettingRow>

      {confirming && <DeleteAccountDialog user={user} onClose={() => setConfirming(false)} />}
    </div>
  );
}

/** Asks before deleting the account. Opens when it mounts, over the settings. */
function DeleteAccountDialog({ user, onClose }: { user: CurrentUser; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  const backdrop = useCloseOnBackdrop(ref);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  // Deleting logs out, and the signed-in app (settings and all) gives way to the landing page.
  async function handleDelete() {
    setDeleting(true);
    await deleteAccount();
    forgetProjects(user.id);
    forgetAccount();
    toast.success("Your account was deleted.");
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-text`}
      onClose={onClose}
      // Stay open while the account is being deleted.
      onCancel={(event) => deleting && event.preventDefault()}
      {...(deleting ? {} : backdrop)}
      className={`max-w-sm ${dialogPanel}`}
    >
      <h2 id={`${id}-title`} className="text-lg font-semibold tracking-[-0.01em]">
        Delete your account?
      </h2>
      <p id={`${id}-text`} className="mt-2 text-sm text-balance text-muted">
        This permanently deletes your account for{" "}
        <span className="font-medium wrap-anywhere text-foreground">{user.email}</span>. It can&rsquo;t be undone.
      </p>
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
        <button
          type="button"
          autoFocus
          onClick={() => ref.current?.close()}
          disabled={deleting}
          className={`${dialogButton} border border-border bg-surface enabled:hover:border-foreground/25`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className={`${dialogButton} bg-error text-background enabled:hover:bg-error/85`}
        >
          {deleting && <LoaderCircle size={16} className="motion-safe:animate-spin" />}
          Delete account
        </button>
      </div>
    </dialog>
  );
}
