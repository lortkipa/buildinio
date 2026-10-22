"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { LoaderIcon } from "../icons";
import { hasFinePointer } from "../pointer";
import { revealForm } from "../reveal-form";
import { CODE_LENGTH, type SendResult, sendCode, verifyCode } from "./mock-auth";

// There is no workspace yet, so signing in leads back to the landing page.
const NEXT_STEP = "/";

const SLOTS = Array.from({ length: CODE_LENGTH }, (_, index) => index);

const triesLeftText = (triesLeft: number) =>
  triesLeft === 0
    ? "No tries left. Request a new code."
    : `${triesLeft} ${triesLeft === 1 ? "try" : "tries"} left.`;

// Puts the caret after the last digit, so typing always adds a digit and Backspace removes one.
function caretToEnd(input: HTMLInputElement) {
  const end = input.value.length;
  if (input.selectionStart !== end || input.selectionEnd !== end) input.setSelectionRange(end, end);
}

// The code from the sign-in email. It is checked as soon as all digits are in; there is no button.
export function CodeForm({ email, sent }: { email: string; sent: SendResult }) {
  const id = useId();
  const messageId = `${id}-message`;
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<"idle" | "checking" | "resending" | "signing-in">("idle");
  // Starts from the send that opened this step; resends update it here.
  const [triesLeft, setTriesLeft] = useState(sent.triesLeft);
  const [resendAt, setResendAt] = useState(sent.resendAt);
  const [error, setError] = useState(triesLeft === 0 ? triesLeftText(0) : null);
  const [notice, setNotice] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // False once the form is gone (Back), so late answers are ignored.
  const mounted = useRef(false);

  const secondsToResend = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const status =
    phase === "checking" ? "Checking code…" : phase === "signing-in" ? "Signing you in…" : notice;
  const message = error ?? status;

  useEffect(() => {
    mounted.current = true;
    // Let desktop users type right away; on phones this would pop up the keyboard.
    if (hasFinePointer()) inputRef.current?.focus();
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    router.prefetch(NEXT_STEP);
  }, [router]);

  // Tick once a second until resending is allowed.
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= resendAt) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  // Keep the whole form, resend button included, above the phone keyboard (see revealForm).
  useEffect(() => {
    const onResize = () => {
      const form = formRef.current;
      if (form && document.activeElement === inputRef.current) revealForm(form);
    };
    window.visualViewport?.addEventListener("resize", onResize);
    return () => window.visualViewport?.removeEventListener("resize", onResize);
  }, []);

  // A message can wrap onto a second line, which makes the form taller.
  useEffect(() => {
    const form = formRef.current;
    if (message && form && document.activeElement === inputRef.current) revealForm(form);
  }, [message]);

  async function verify(digits: string) {
    setPhase("checking");
    const result = await verifyCode(email, digits);
    if (!mounted.current) return;
    if (result.ok) {
      setPhase("signing-in");
      router.replace(NEXT_STEP);
      return;
    }
    const left = result.error === "invalid" ? result.triesLeft : 0;
    setTriesLeft(left);
    setCode("");
    setError(`Incorrect code. ${triesLeftText(left)}`);
    setPhase("idle");
  }

  async function resend() {
    setPhase("resending");
    setError(null);
    setNotice(null);
    const result = await sendCode(email);
    if (!mounted.current) return;
    // Synchronously, so the input is enabled again before it gets the focus.
    flushSync(() => {
      setTriesLeft(result.triesLeft);
      setResendAt(result.resendAt);
      setCode("");
      setNotice("We sent a new code.");
      setPhase("idle");
    });
    if (hasFinePointer()) inputRef.current?.focus();
  }

  const busy = phase !== "idle";
  const activeSlot = Math.min(code.length, CODE_LENGTH - 1);

  return (
    <form
      ref={formRef}
      noValidate
      // Enter does nothing: a full code is already being checked, and a partial one isn't a try.
      onSubmit={(event) => event.preventDefault()}
      className="flex scroll-my-4 flex-col gap-5"
    >
      <div className="flex flex-col gap-3">
        <div className="relative">
          <div aria-hidden className="grid grid-cols-6 gap-2">
            {SLOTS.map((slot) => {
              const active = focused && !busy && slot === activeSlot;
              return (
                <div
                  key={slot}
                  className={`flex h-14 items-center justify-center rounded-2xl border bg-white/80 text-2xl font-medium tabular-nums shadow-sm backdrop-blur-xl transition dark:bg-zinc-900/75 ${
                    error
                      ? "border-red-500 dark:border-red-400"
                      : active
                        ? "border-brand-violet ring-3 ring-brand-violet/20"
                        : "border-zinc-950/10 dark:border-white/10"
                  } ${busy || triesLeft === 0 ? "opacity-50" : ""}`}
                >
                  {code[slot] ??
                    (active && (
                      <span className="h-7 w-px animate-caret-blink bg-zinc-950 motion-reduce:animate-none dark:bg-white" />
                    ))}
                </div>
              );
            })}
          </div>

          <label htmlFor={id} className="sr-only">
            Verification code
          </label>
          {/*
           * One real input over the slots, with its text and caret hidden, so pasting, code
           * autofill and screen readers work as with any field. text-base: iOS zooms into fields
           * with smaller text, and revealForm pauses while zoomed.
           */}
          <input
            ref={inputRef}
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            enterKeyHint="done"
            spellCheck={false}
            value={code}
            onChange={(event) => {
              // Keeps only digits, so a pasted "123 456" or "123-456" works too.
              const digits = event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
              setCode(digits);
              setError(null);
              setNotice(null);
              if (digits.length === CODE_LENGTH) verify(digits);
            }}
            onFocus={(event) => {
              setFocused(true);
              caretToEnd(event.currentTarget);
            }}
            onBlur={() => setFocused(false)}
            onSelect={(event) => caretToEnd(event.currentTarget)}
            // Read-only rather than disabled while busy: disabling drops the focus and closes the
            // phone keyboard. With no tries left it is disabled until a new code is sent.
            readOnly={busy}
            disabled={triesLeft === 0}
            aria-invalid={error !== null}
            aria-describedby={message ? messageId : undefined}
            className="absolute inset-0 size-full rounded-2xl bg-transparent text-base text-transparent caret-transparent outline-none selection:bg-transparent disabled:cursor-not-allowed"
          />
        </div>

        {/* min-h-5: room for one line, so the resend button doesn't jump when a message appears. */}
        <div className="min-h-5 text-center text-sm">
          {error ? (
            <p id={messageId} role="alert" className="text-red-600 dark:text-red-400">
              {error}
            </p>
          ) : (
            status && (
              <p
                id={messageId}
                role="status"
                className="flex items-center justify-center gap-2 text-zinc-600 dark:text-zinc-300"
              >
                {(phase === "checking" || phase === "signing-in") && (
                  <LoaderIcon className="size-4" />
                )}
                {status}
              </p>
            )
          )}
        </div>
      </div>

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-300">
        Didn’t get the email?{" "}
        <button
          type="button"
          onClick={resend}
          disabled={secondsToResend > 0 || busy}
          className="rounded font-medium text-zinc-950 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet disabled:text-zinc-500 disabled:no-underline dark:text-white dark:disabled:text-zinc-400"
        >
          {phase === "resending"
            ? "Sending…"
            : secondsToResend > 0
              ? `Resend code in ${secondsToResend}s`
              : "Resend code"}
        </button>
      </p>
    </form>
  );
}
