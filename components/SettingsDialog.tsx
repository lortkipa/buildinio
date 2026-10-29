"use client";

import { useEffect, useId, useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { ArrowDownToLine, Check, ChevronRight, ImagePlus, Laptop, LoaderCircle, LockKeyhole, Moon, Palette, ShieldCheck, Sun, Trash2, UserRound, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { dialogButton, dialogPanel, focusRing } from "@/components/styles";
import { useCloseOnBackdrop } from "@/components/useCloseOnBackdrop";
import { useAppearance } from "@/components/AppearanceProvider";
import { deleteAccount } from "@/lib/auth/actions";
import type { CurrentUser } from "@/lib/auth/session";
import { forgetProjects } from "@/lib/projects/store";
import { MAX_NAME, MAX_PHOTO_BYTES, THEMES, type Appearance, type Theme } from "@/lib/settings";
import { saveAppearance, saveProfile } from "@/lib/settings/actions";

const SECTIONS = [
  { id: "account", label: "Account", icon: UserRound },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "privacy", label: "Privacy & data", icon: ShieldCheck },
] as const;
const THEME_DETAILS = {
  light: { label: "Light", icon: Sun },
  dark: { label: "Dark", icon: Moon },
  system: { label: "System", icon: Laptop },
};
const inputStyle = `h-11 w-full rounded-xl border border-border bg-background/60 px-3.5 text-sm outline-none transition-colors focus:border-foreground/35 ${focusRing}`;
const primaryButton = `inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;
const quietButton = `inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-full border border-border px-3.5 text-xs font-medium transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;

type Section = (typeof SECTIONS)[number]["id"];

export function SettingsDialog({ user, onClose }: { user: CurrentUser; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const deleteRef = useRef<HTMLDialogElement>(null);
  const id = useId();
  const backdrop = useCloseOnBackdrop(ref);
  const [section, setSection] = useState<Section>("account");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    const confirmation = deleteRef.current;
    dialog?.showModal();
    return () => {
      confirmation?.close();
      dialog?.close();
    };
  }, []);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
      forgetProjects(user.id);
      deleteRef.current?.close();
      ref.current?.close();
      toast.success("Your account was deleted.");
    } catch {
      setDeleting(false);
      toast.error("We couldn’t delete your account. Please try again.");
    }
  }

  return (
    <>
      <dialog ref={ref} aria-labelledby={`${id}-title`} onClose={onClose} {...backdrop}
        className={`max-h-[calc(100dvh-2rem)] max-w-3xl overflow-hidden p-0! ${dialogPanel}`}>
        <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2.5">
              <span aria-hidden className="size-2 rounded-full bg-red-500" />
              <h2 id={`${id}-title`} className="text-base font-semibold tracking-tight">Settings</h2>
            </div>
            <button type="button" aria-label="Close settings" autoFocus onClick={() => ref.current?.close()}
              className={`grid size-8 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-foreground/5 hover:text-foreground ${focusRing}`}>
              <X size={18} />
            </button>
          </header>
          <div className="flex min-h-0 flex-col md:min-h-[520px] md:flex-row">
            <nav aria-label="Settings sections" className="flex shrink-0 gap-1 overflow-x-auto border-b border-border bg-background/50 p-2 md:w-48 md:flex-col md:border-r md:border-b-0 md:p-3">
              {SECTIONS.map(({ id: value, label, icon: Icon }) => (
                <button key={value} type="button" aria-current={section === value ? "page" : undefined}
                  onClick={() => setSection(value)}
                  className={`flex min-h-10 shrink-0 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-left text-xs font-medium whitespace-nowrap transition-colors md:text-sm ${focusRing} ${section === value ? "bg-surface text-foreground shadow-[0_1px_4px_rgb(0_0_0/0.06)] ring-1 ring-border" : "text-muted hover:bg-foreground/4 hover:text-foreground"}`}>
                  <Icon size={16} className={section === value ? "text-red-500" : ""} />
                  {label}
                  {section === value && <ChevronRight size={14} className="ml-auto hidden text-muted md:block" />}
                </button>
              ))}
              <div className="mt-auto hidden px-3 pt-10 pb-2 md:block">
                <p className="text-xs font-medium">Your space. Your rules.</p>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">Make Buildinio feel like you.</p>
              </div>
            </nav>
            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-7">
              <div hidden={section !== "account"}>
                <AccountSettings user={user} onDelete={() => deleteRef.current?.showModal()} />
              </div>
              {section === "appearance" && <AppearanceSettings />}
              {section === "privacy" && <PrivacySettings />}
            </div>
          </div>
        </div>
      </dialog>
      <dialog ref={deleteRef} aria-labelledby={`${id}-delete-title`} aria-describedby={`${id}-delete-text`}
        onCancel={(event) => { if (deleting) event.preventDefault(); }} className={`max-w-sm ${dialogPanel}`}>
        <div aria-hidden className="mb-4 grid size-11 place-items-center rounded-2xl bg-error/10 text-error"><Trash2 size={20} /></div>
        <h2 id={`${id}-delete-title`} className="text-lg font-semibold tracking-tight">Delete your account?</h2>
        <p id={`${id}-delete-text`} className="mt-2 text-sm leading-relaxed text-muted">
          This permanently deletes your account for <span className="font-medium wrap-anywhere text-foreground">{user.email}</span>, including all your projects and chats. It can&rsquo;t be undone.
        </p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row">
          <button type="button" autoFocus disabled={deleting} onClick={() => deleteRef.current?.close()}
            className={`${dialogButton} border border-border enabled:hover:bg-foreground/5`}>Cancel</button>
          <button type="button" disabled={deleting} onClick={handleDelete}
            className={`${dialogButton} bg-error text-background enabled:hover:bg-error/85`}>
            {deleting && <LoaderCircle size={16} className="motion-safe:animate-spin" />}Delete account
          </button>
        </div>
      </dialog>
    </>
  );
}

function AccountSettings({ user, onDelete }: { user: CurrentUser; onDelete: () => void }) {
  const id = useId();
  const [name, setName] = useState(user.name);
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const changed = name.trim() !== user.name || photo !== null || removePhoto;

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function choosePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Choose a JPG, PNG or WebP photo smaller than 2 MB.");
      event.target.value = "";
      return;
    }
    setError("");
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
    setRemovePhoto(false);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData();
    form.set("name", name);
    if (photo) form.set("photo", photo);
    if (removePhoto) form.set("removePhoto", "true");
    setError("");
    startTransition(async () => {
      try {
        const result = await saveProfile(form);
        if (result.error) { setError(result.error); return; }
        setName(name.trim().replace(/\s+/g, " "));
        setPhoto(null);
        setPreview(null);
        setRemovePhoto(false);
        if (fileRef.current) fileRef.current.value = "";
        toast.success("Profile saved.");
      } catch {
        setError("We couldn’t save your profile. Please try again.");
      }
    });
  }

  return (
    <section aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="text-xl font-semibold tracking-tight">Your account</h3>
      <p className="mt-1.5 text-sm text-muted">A little more you.</p>
      <form onSubmit={submit} className="mt-6">
        <fieldset disabled={pending} className="space-y-5 disabled:opacity-70">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Image src={preview ?? (removePhoto ? "/avatars/default.svg" : user.avatarUrl)} alt="Profile photo" width={64} height={64} unoptimized referrerPolicy="no-referrer"
                className="size-16 rounded-full bg-background object-cover ring-4 ring-background" />
              <span aria-hidden className="absolute -right-0.5 -bottom-0.5 grid size-6 place-items-center rounded-full border-2 border-surface bg-foreground text-background"><ImagePlus size={12} /></span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => fileRef.current?.click()} className={quietButton}>Upload photo</button>
                {(photo || (!removePhoto && user.avatarUrl !== "/avatars/default.svg")) && (
                  <button type="button" onClick={() => {
                    setPhoto(null); setPreview(null); setRemovePhoto(true);
                    if (fileRef.current) fileRef.current.value = "";
                  }} className={`cursor-pointer rounded-md px-1 text-xs text-muted hover:text-foreground ${focusRing}`}>Remove</button>
                )}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">JPG, PNG or WebP · up to 2 MB</p>
              <input ref={fileRef} type="file" aria-label="Profile photo upload" accept="image/jpeg,image/png,image/webp" onChange={choosePhoto} className="hidden" />
            </div>
          </div>
          <div>
            <label htmlFor={`${id}-name`} className="mb-2 block text-xs font-medium">Name</label>
            <input id={`${id}-name`} name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required maxLength={MAX_NAME} className={inputStyle} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor={`${id}-email`} className="text-xs font-medium">Email</label>
              <span className="flex items-center gap-1 text-[11px] text-muted"><LockKeyhole size={11} />Read-only</span>
            </div>
            <input id={`${id}-email`} type="email" value={user.email} readOnly aria-describedby={`${id}-email-note`} className={`${inputStyle} text-muted`} />
            <p id={`${id}-email-note`} className="mt-2 text-xs text-muted">Your email is used to sign in and can&rsquo;t be changed.</p>
          </div>
        </fieldset>
        {error && <p role="alert" className="mt-3 text-sm text-error">{error}</p>}
        <div className="mt-5 flex items-center justify-end">
          <button type="submit" disabled={pending || !changed || !name.trim()} className={primaryButton}>
            {pending ? <LoaderCircle size={15} className="motion-safe:animate-spin" /> : <Check size={15} />}
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
      <div className="mt-7 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-xs font-medium">Delete account</h4>
          <p className="mt-1 max-w-64 text-xs leading-relaxed text-muted">Permanently delete your account, projects and chats.</p>
        </div>
        <button type="button" onClick={onDelete} className={`${quietButton} shrink-0 self-start border-error/20 text-error hover:bg-error/5 sm:self-auto`}>
          <Trash2 size={13} />Delete account
        </button>
      </div>
    </section>
  );
}

function AppearanceSettings() {
  const appearance = useAppearance();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const id = useId();

  function save(next: Appearance) {
    setError("");
    startTransition(async () => {
      try {
        const result = await saveAppearance(next);
        if (result.error) setError(result.error);
      } catch {
        setError("We couldn’t save your preferences. Please try again.");
      }
    });
  }

  return (
    <section aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="text-xl font-semibold tracking-tight">Set the mood</h3>
      <p className="mt-1.5 text-sm text-muted">A space that feels right, day or night.</p>
      <fieldset disabled={pending} className="mt-7">
        <legend className="text-xs font-medium">Theme</legend>
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {THEMES.map((theme) => {
            const { label, icon: Icon } = THEME_DETAILS[theme];
            const selected = appearance.theme === theme;
            return (
              <label key={theme} className="relative min-w-0 cursor-pointer">
                <input type="radio" name={`${id}-theme`} value={theme} checked={selected} onChange={() => save({ ...appearance, theme })}
                  className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 disabled:cursor-wait" />
                <span className={`block overflow-hidden rounded-2xl border p-1 transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-foreground peer-disabled:cursor-wait ${selected ? "border-red-500 ring-1 ring-red-500/20" : "border-border hover:border-foreground/25"}`}>
                  <ThemePreview theme={theme} />
                  <span className="flex items-center justify-between gap-1 px-1.5 pt-3 pb-2 text-xs font-medium">
                    <span className="flex items-center gap-1.5"><Icon size={13} />{label}</span>
                    <span className={`grid size-3.5 shrink-0 place-items-center rounded-full ${selected ? "bg-red-500 text-white" : "border border-border"}`}>
                      {selected && <Check size={10} strokeWidth={3} />}
                    </span>
                  </span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <p className="mt-3 text-xs leading-relaxed text-muted">System follows your device&rsquo;s light or dark appearance.</p>
      <div className="mt-7 rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-xl bg-background text-muted"><Zap size={17} /></span>
            <div>
              <label htmlFor={`${id}-motion`} className="cursor-pointer text-sm font-medium">Reduced motion</label>
              <p id={`${id}-motion-note`} className="mt-1 text-xs leading-relaxed text-muted">A calmer experience with fewer animations.</p>
            </div>
          </div>
          <button id={`${id}-motion`} type="button" role="switch" aria-label="Reduced motion"
            aria-checked={appearance.reducedMotion} disabled={pending} aria-describedby={`${id}-motion-note`}
            onClick={() => save({ ...appearance, reducedMotion: !appearance.reducedMotion })}
            className={`relative h-6 w-10 shrink-0 cursor-pointer rounded-full transition-colors disabled:cursor-wait ${focusRing} ${appearance.reducedMotion ? "bg-red-500" : "bg-foreground/15"}`}>
            <span className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-sm transition-transform ${appearance.reducedMotion ? "translate-x-4" : ""}`} />
          </button>
        </div>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted">Your device&rsquo;s reduced motion setting is always respected.</p>
      {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
      <p role="status" className="mt-8 flex items-center gap-1.5 text-xs text-muted">
        {pending ? <LoaderCircle size={13} className="motion-safe:animate-spin" /> : <Check size={13} />}
        {pending ? "Saving preferences…" : "Preferences saved to your account"}
      </p>
    </section>
  );
}

/** A miniature of the shell, showing the theme before choosing it. */
function ThemePreview({ theme }: { theme: Theme }) {
  return (
    <span aria-hidden className="relative block h-24 overflow-hidden rounded-xl border border-black/5 sm:h-28">
      {(theme === "system" ? ["light", "dark"] : [theme]).map((mode, index) => (
        <span key={mode} className={`absolute inset-0 flex ${mode === "dark" ? "bg-[#111113] text-white" : "bg-[#fafaf9] text-[#1c1c1f]"}`}
          style={theme === "system" ? { clipPath: index === 0 ? "polygon(0 0, 100% 0, 0 100%)" : "polygon(100% 0, 100% 100%, 0 100%)" } : undefined}>
          <span className={`flex w-[27%] flex-col gap-2 border-r p-2 ${mode === "dark" ? "border-white/10 bg-white/4" : "border-black/5 bg-white"}`}>
            <span className="size-2 rounded-[2px] bg-current opacity-70" />
            <span className="mt-2 h-1 rounded-full bg-current opacity-20" /><span className="h-1 rounded-full bg-current opacity-10" />
          </span>
          <span className="flex flex-1 flex-col justify-center gap-2 px-3">
            <span className="h-1.5 w-3/4 rounded-full bg-current opacity-60" />
            <span className="h-1 w-full rounded-full bg-current opacity-15" />
            <span className="h-1 w-2/3 rounded-full bg-current opacity-15" />
            <span className={`mt-2 flex h-5 items-center justify-end rounded-md border px-1 ${mode === "dark" ? "border-white/15 bg-white/5" : "border-black/10 bg-white"}`}><span className="size-2 rounded-full bg-red-500" /></span>
          </span>
        </span>
      ))}
    </span>
  );
}

function PrivacySettings() {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/account/export", { cache: "no-store" });
      if (!response.ok) throw new Error("Export failed");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "buildinio-export.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success("Your export is ready.");
    } catch {
      setError("We couldn’t export your data. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="text-xl font-semibold tracking-tight">Your work goes with you</h3>
      <p className="mt-1.5 text-sm text-muted">Keep a copy of everything you&rsquo;ve created.</p>
      <div className="relative mt-7 overflow-hidden rounded-2xl border border-border bg-background/60 p-5">
        <div aria-hidden className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-red-500/7 blur-2xl" />
        <div aria-hidden className="relative mb-5 flex h-20 items-center justify-center">
          <div className="absolute h-16 w-24 -translate-x-5 -rotate-12 rounded-xl border border-border bg-surface shadow-sm" />
          <div className="absolute h-16 w-24 translate-x-5 rotate-12 rounded-xl border border-border bg-surface shadow-sm" />
          <div className="relative grid size-16 place-items-center rounded-2xl border border-border bg-surface shadow-sm"><ArrowDownToLine size={25} strokeWidth={1.5} /></div>
        </div>
        <h4 className="relative text-sm font-semibold">Export projects and chats</h4>
        <p className="relative mt-2 text-xs leading-relaxed text-muted">One ZIP with your project source files, project details and complete chat history.</p>
        <div className="relative mt-4 flex flex-wrap gap-2">
          {["Source files", "Project details", "Chat history"].map((label) => <span key={label} className="rounded-full border border-border bg-surface px-2.5 py-1 text-[10px] font-medium text-muted">{label}</span>)}
        </div>
        <button type="button" disabled={pending} onClick={download} className={`relative mt-6 w-full ${primaryButton}`}>
          {pending ? <LoaderCircle size={15} className="motion-safe:animate-spin" /> : <ArrowDownToLine size={15} />}
          {pending ? "Preparing your export…" : "Export projects and chats"}
        </button>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted">Includes all saved projects and chats. Installed dependencies and build output are left out. For the latest files, wait for active builds to finish.</p>
      {error && <p role="alert" className="mt-4 text-sm text-error">{error}</p>}
    </section>
  );
}
