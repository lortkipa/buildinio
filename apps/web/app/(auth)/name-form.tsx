"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { LoaderIcon } from "../icons";
import { hasFinePointer } from "../pointer";
import { revealForm } from "../reveal-form";
import { saveName } from "./mock-auth";

// There is no workspace yet, so after the name comes the landing page.
const NEXT_STEP = "/";

// Asked after every sign-in. The button stays disabled until a name is typed.
export function NameForm() {
  const id = useId();
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  // False once the form is gone, e.g. after going back while saving.
  const mounted = useRef(false);

  const empty = name.trim() === "";

  useEffect(() => {
    mounted.current = true;
    // Only with a mouse or trackpad: on phones this would pop up the keyboard.
    if (hasFinePointer()) inputRef.current?.focus();
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    router.prefetch(NEXT_STEP);
  }, [router]);

  // Keep the whole form, button included, above the phone keyboard (see revealForm).
  useEffect(() => {
    const onResize = () => {
      const form = formRef.current;
      if (form && document.activeElement === inputRef.current) revealForm(form);
    };
    window.visualViewport?.addEventListener("resize", onResize);
    return () => window.visualViewport?.removeEventListener("resize", onResize);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || empty) return;
    setSaving(true);
    await saveName(name.trim());
    if (mounted.current) router.replace(NEXT_STEP);
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      className="flex scroll-my-4 flex-col gap-3"
    >
      <label htmlFor={id} className="sr-only">
        Name
      </label>
      {/* text-base: iOS zooms into fields with smaller text, and revealForm pauses while zoomed. */}
      <input
        ref={inputRef}
        id={id}
        type="text"
        autoComplete="name"
        autoCapitalize="words"
        enterKeyHint="go"
        maxLength={100}
        placeholder="Your name"
        value={name}
        // Not disabled: that would drop the focus and close the phone keyboard.
        readOnly={saving}
        onChange={(event) => setName(event.target.value)}
        className="h-12 w-full rounded-full border border-zinc-950/10 bg-white/80 px-5 text-base shadow-sm backdrop-blur-xl placeholder:text-zinc-500 outline-none dark:border-white/10 dark:bg-zinc-900/75 dark:placeholder:text-zinc-400"
      />

      {/* Disabled while empty, which also keeps Enter from submitting. */}
      <button
        type="submit"
        disabled={empty}
        aria-disabled={saving}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-base font-medium text-white shadow-sm transition hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-zinc-950 aria-disabled:cursor-default aria-disabled:hover:bg-zinc-950 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:disabled:hover:bg-white dark:aria-disabled:hover:bg-white"
      >
        {saving ? (
          <>
            <LoaderIcon className="size-5" />
            Saving…
          </>
        ) : (
          "Continue"
        )}
      </button>
    </form>
  );
}
