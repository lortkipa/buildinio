"use client";

import { useEffect, useId, useRef, useState } from "react";
import { revealForm } from "../reveal-form";

// Something@something.something without spaces. Only a sign-in email can prove the address works.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emailError(email: string) {
  if (email === "") return "Enter your email address.";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address.";
  return null;
}

// Passwordless email sign-in, used for both logging in and signing up.
export function EmailForm() {
  const id = useId();
  const errorId = `${id}-error`;
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

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

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextError = emailError(email.trim());
    setError(nextError);
    if (nextError) {
      inputRef.current?.focus();
      return;
    }
    // Sending the sign-in email comes with auth (Better Auth). Until then, accept and clear.
    setEmail("");
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
        className="flex h-12 w-full items-center justify-center rounded-full bg-zinc-950 px-5 text-base font-medium text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
      >
        Continue with email
      </button>
    </form>
  );
}
