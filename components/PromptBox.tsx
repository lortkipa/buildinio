"use client";

import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent } from "react";
import { ArrowUp, Mic, Plus } from "lucide-react";

const EXAMPLES = [
  "A booking app for my hair salon…",
  "A habit tracker that nudges me every morning…",
  "An online menu for my café…",
  "A client portal for my design studio…",
  "A shared gift list for my family…",
];

const TYPE_MS = 45;
const DELETE_MS = 20;
const HOLD_MS = 1800;
const NEXT_MS = 400;

/**
 * Types out example ideas one by one as the placeholder while `active`.
 * Pauses where it is when inactive and resumes from there.
 * Shows the first example without animating if the user prefers reduced motion.
 */
function useTypingPlaceholder(active: boolean) {
  const [text, setText] = useState(EXAMPLES[0]);
  // Start on a fully typed first example, so the loop begins by deleting it.
  const state = useRef({ index: 0, length: EXAMPLES[0].length, deleting: true });

  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let timer: number;
    const tick = () => {
      const s = state.current;
      const full = EXAMPLES[s.index];
      let delay: number;

      if (s.deleting) {
        s.length -= 1;
        delay = DELETE_MS;
        if (s.length <= 0) {
          s.length = 0;
          s.deleting = false;
          s.index = (s.index + 1) % EXAMPLES.length;
          delay = NEXT_MS;
        }
      } else {
        s.length += 1;
        delay = TYPE_MS;
        if (s.length >= full.length) {
          s.length = full.length;
          s.deleting = true;
          delay = HOLD_MS;
        }
      }

      setText(EXAMPLES[s.index].slice(0, s.length));
      timer = window.setTimeout(tick, delay);
    };

    timer = window.setTimeout(tick, HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [active]);

  return text;
}

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";
const iconButton = `grid size-9 cursor-pointer place-items-center rounded-full ${focusRing}`;
const swap = "col-start-1 row-start-1 transition duration-200 ease-out motion-reduce:transition-none";
const shown = "scale-100 rotate-0 opacity-100";

export function PromptBox({ className = "" }: { className?: string }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const placeholder = useTypingPlaceholder(value.length === 0);
  const hasText = value.trim().length > 0;

  // Put the cursor in the box on desktop. Skipped on touch so the keyboard doesn't pop up.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) {
      textareaRef.current?.focus();
    }
  }, []);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setValue(event.target.value);
    // Grow with the text; max-height caps it and then it scrolls.
    const el = event.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      if (hasText) event.currentTarget.form?.requestSubmit();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Not wired up yet.
  }

  return (
    <form onSubmit={handleSubmit} className={`relative isolate w-full max-w-2xl ${className}`}>
      <div
        aria-hidden
        className="bg-glow pointer-events-none absolute -inset-x-24 -inset-y-20 -z-10"
      />
      <div className="rounded-3xl border border-border bg-surface text-left shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.12)] transition focus-within:border-foreground/20 focus-within:shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-12px_rgb(0_0_0/0.18)]">
        <label htmlFor="prompt" className="sr-only">
          Describe the app you want to build
        </label>
        <textarea
          ref={textareaRef}
          id="prompt"
          name="prompt"
          rows={2}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="block max-h-48 w-full resize-none bg-transparent px-5 pt-4 pb-1 text-base leading-relaxed text-foreground outline-none placeholder:text-muted"
        />

        <div className="flex items-center justify-between px-3 pb-3">
          {/* Not wired up yet. */}
          <button
            type="button"
            aria-label="Add files"
            className={`${iconButton} text-muted transition-colors hover:bg-foreground/5 hover:text-foreground`}
          >
            <Plus size={20} />
          </button>

          {/* Mic and submit share one spot and swap when there's text. */}
          <div className="grid">
            <button
              type="button"
              aria-label="Use voice input"
              inert={hasText}
              className={`${iconButton} ${swap} text-muted hover:bg-foreground/5 hover:text-foreground ${
                hasText ? "scale-50 -rotate-45 opacity-0" : shown
              }`}
            >
              <Mic size={20} />
            </button>
            <button
              type="submit"
              aria-label="Start building"
              inert={!hasText}
              className={`${iconButton} ${swap} bg-foreground text-background hover:bg-foreground/85 ${
                hasText ? shown : "scale-50 rotate-45 opacity-0"
              }`}
            >
              <ArrowUp size={18} strokeWidth={2.25} />
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}
