"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, SyntheticEvent } from "react";

const LENGTH = 6;

type CodeInputProps = {
  onComplete: (code: string) => void; // Called once all digits are in.
  locked?: boolean; // Set after a wrong code: no more tries.
  errorId?: string; // Id of the error message, when there is one.
};

/**
 * Six boxes for a one-time code. A single real input sits on top of them,
 * so typing, pasting, backspace and SMS autofill all just work.
 */
export function CodeInput({ onComplete, locked = false, errorId }: CodeInputProps) {
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    // Digits only, so a pasted "123 456" still fits.
    const digits = event.target.value.replace(/\D/g, "").slice(0, LENGTH);
    setCode(digits);
    if (digits.length === LENGTH) onComplete(digits);
  }

  // The boxes only show a caret at the end, so keep the real one there too.
  function keepCaretAtEnd(event: SyntheticEvent<HTMLInputElement>) {
    const el = event.currentTarget;
    const end = el.value.length;
    if (el.selectionStart !== end || el.selectionEnd !== end) {
      el.setSelectionRange(end, end);
    }
  }

  return (
    <div className="relative mx-auto w-fit">
      <div aria-hidden className="flex gap-2 sm:gap-3">
        {Array.from({ length: LENGTH }, (_, i) => {
          const active = focused && !locked && i === code.length;
          return (
            <div
              key={i}
              className={`grid size-12 place-items-center rounded-xl border bg-surface text-xl font-semibold transition-colors ${
                locked
                  ? "border-error"
                  : active
                    ? "border-foreground/50"
                    : "border-border"
              }`}
            >
              {code[i] ??
                (active && (
                  <span className="h-6 w-px bg-foreground motion-safe:animate-blink" />
                ))}
            </div>
          );
        })}
      </div>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="6-digit code"
        aria-invalid={locked}
        aria-describedby={errorId}
        disabled={locked}
        value={code}
        onChange={handleChange}
        onSelect={keepCaretAtEnd}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 size-full cursor-text bg-transparent text-transparent caret-transparent outline-none selection:bg-transparent disabled:cursor-not-allowed"
      />
    </div>
  );
}
