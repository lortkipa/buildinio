"use client";

import { useEffect, useId, useRef, useState } from "react";
import { LoaderIcon } from "../icons";
import { hasFinePointer } from "../pointer";
import { revealForm } from "../reveal-form";
import { type SentCode, sendCode } from "./email-code";

// Something@something.something without spaces. Only a sign-in email can prove the address works.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailError(email: string) {
  if (email === "") return "Enter your email address.";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address.";
  return null;
}

// Passwordless email sign-in, used for both logging in and signing up. Sends a code to the email.
// onError: why sending failed, for the toast.
export function EmailForm({
  defaultEmail,
  autoFocus,
  onSent,
  onError,
}: {
  defaultEmail: string;
  autoFocus: boolean;
  onSent: (email: string, sent: SentCode) => void;
  onError: (message: string) => void;
}) {
  const id = useId();
  const errorId = `${id}-error`;
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  // False once the form is gone, e.g. after switching to the other auth page while sending.
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    // Only with a mouse or trackpad: on phones this would pop up the keyboard.
    if (autoFocus && hasFinePointer()) inputRef.current?.focus();
    return () => {
      mounted.current = false;
    };
  }, [autoFocus]);

  // Keep the whole form, button included, above the phone keyboard (see revealForm).
  useEffect(() => {
    const onResize = () => {
      const form = formRef.current;
      if (form && document.activeElement === inputRef.current) revealForm(form);
    };
    window.visualViewport?.addEventListener("resize", onResize);
    return () => window.visualViewport?.removeEventListener("resize", onResize);
  }, []);

  // The error message makes the form taller, which can push the button under the keyboard.
  useEffect(() => {
    const form = formRef.current;
    if (error && form && document.activeElement === inputRef.current) revealForm(form);
  }, [error]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const address = email.trim();
    const nextError = emailError(address);
    setError(nextError);
    if (nextError) {
      inputRef.current?.focus();
      return;
    }
    setSending(true);
    const result = await sendCode(address);
    if (!mounted.current) return;
    if (result.ok) {
      onSent(address, result);
      return;
    }
    setSending(false);
    onError(result.message);
  }

  return (
    <form
      ref={formRef}
      noValidate
      onSubmit={handleSubmit}
      className="flex scroll-my-4 flex-col gap-3"
    >
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="sr-only">
          Email
        </label>
        {/* text-base: iOS zooms into fields with smaller text, and revealForm pauses while zoomed. */}
        <input
          ref={inputRef}
          id={id}
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="Email address"
          value={email}
          // Not disabled: that would drop the focus and close the phone keyboard.
          readOnly={sending}
          onChange={(event) => {
            setEmail(event.target.value);
            setError(null);
          }}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className="h-12 w-full rounded-full border border-zinc-950/10 bg-white/80 px-5 text-base shadow-sm backdrop-blur-xl placeholder:text-zinc-500 outline-none aria-invalid:border-red-500 dark:border-white/10 dark:bg-zinc-900/75 dark:placeholder:text-zinc-400 dark:aria-invalid:border-red-400"
        />
        {error && (
          <p id={errorId} role="alert" className="px-5 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      <button
        type="submit"
        aria-disabled={sending}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-zinc-950 px-5 text-base font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet aria-disabled:cursor-default aria-disabled:hover:bg-zinc-950 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:aria-disabled:hover:bg-white"
      >
        {sending ? (
          <>
            <LoaderIcon className="size-5" />
            Sending code…
          </>
        ) : (
          "Continue with email"
        )}
      </button>
    </form>
  );
}
