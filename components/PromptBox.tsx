"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, FormEvent, KeyboardEvent, RefObject } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Mic, Plus } from "lucide-react";
import { toast } from "sonner";
import { focusRing, shown, swap } from "@/components/styles";
import { DOCK_CHROME, DOCK_GAP } from "@/components/useKeyboardDock";
import type { Dock } from "@/components/useKeyboardDock";
import { autoBullet, dropEmptyItems, listKey } from "@/lib/lists";
import type { Edit, ListKey } from "@/lib/lists";

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

let editing = false; // While applyEdit types, so its own typing isn't taken for a new "- ".

/**
 * Puts a list edit in the text box the way typing would, so Undo takes it back:
 * only the part that changed is typed over. (execCommand is old, but it's the only
 * way into a text box's undo history.)
 */
function applyEdit(textarea: HTMLTextAreaElement, { value, start, end }: Edit) {
  const old = textarea.value;
  if (old !== value) {
    let from = 0;
    while (from < old.length && from < value.length && old[from] === value[from]) from++;
    let back = 0;
    while (back < old.length - from && back < value.length - from && old.at(-1 - back) === value.at(-1 - back)) back++;
    const text = value.slice(from, value.length - back);
    textarea.setSelectionRange(from, old.length - back);
    editing = true;
    try {
      const done = document.execCommand(text ? "insertText" : "delete", false, text);
      if (!done) {
        textarea.setRangeText(text, from, old.length - back);
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } finally {
      editing = false;
    }
  }
  textarea.setSelectionRange(start, end);
}

/** The keys that do something special in a list. */
function listKeyOf(event: KeyboardEvent<HTMLTextAreaElement>): ListKey | null {
  if (event.altKey || event.ctrlKey || event.metaKey) return null;
  if (event.key === "Enter") return event.shiftKey ? "Shift+Enter" : "Enter";
  if (event.key === "Tab") return event.shiftKey ? "Shift+Tab" : "Tab";
  if (event.key === "Backspace" && !event.shiftKey) return "Backspace";
  return null;
}

const iconButton = `grid size-9 cursor-pointer place-items-center rounded-full ${focusRing}`;

// Grows to 12 lines, then scrolls. lh is one line; 0.75rem is the textarea's pt-2 + pb-1.
const MAX_HEIGHT = "calc(12lh + 0.75rem)";

const VARIANTS = {
  // On the home page: types out example ideas, with a glow behind.
  hero: { label: "Describe the app you want to build", placeholder: null, rows: 2 },
  // Under a project's chat: one line to start with.
  chat: { label: "Ask for changes", placeholder: "Ask for changes…", rows: 1 },
};

type PromptBoxProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  dock: Dock | null; // Set while the phone keyboard is open; see useKeyboardDock.
  onSubmit: (prompt: string) => void;
  variant?: keyof typeof VARIANTS;
  busy?: boolean; // The AI is still answering: typing works, sending waits.
  signedIn?: boolean;
  className?: string;
};

export function PromptBox({
  textareaRef,
  dock,
  onSubmit,
  variant = "hero",
  busy = false,
  signedIn = false,
  className = "",
}: PromptBoxProps) {
  const router = useRouter();
  const id = useId();
  const [value, setValue] = useState("");
  const { label, placeholder, rows } = VARIANTS[variant];
  const example = useTypingPlaceholder(!placeholder && value.length === 0);
  const prompt = dropEmptyItems(value).trim();
  const hasText = prompt.length > 0;
  const canSend = hasText && !busy;

  // Put the cursor in the box on desktop. Skipped on touch so the keyboard doesn't pop up.
  useEffect(() => {
    if (window.matchMedia("(pointer: fine)").matches) {
      textareaRef.current?.focus();
    }
  }, [textareaRef]);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>) {
    setValue(event.target.value);
    // Grow with the text; max-height caps it at 12 lines and then it scrolls.
    const el = event.target;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
    // "- " or "* " at the start of a line becomes a bullet: after React is done with
    // this change (still before the screen updates), or it puts the "-" back.
    const input = event.nativeEvent as InputEvent;
    if (!editing && input.inputType === "insertText" && input.data === " " && !input.isComposing) {
      queueMicrotask(() => {
        const edit = autoBullet(el.value, el.selectionStart);
        if (edit && el.selectionStart === el.selectionEnd) applyEdit(el, edit);
      });
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    const textarea = event.currentTarget;
    // Ctrl or Cmd+Enter always sends, even in a list or on a phone's keyboard.
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      if (canSend) textarea.form?.requestSubmit();
      return;
    }
    // In a list, Enter starts the next item, Tab moves it in a level, and so on.
    const key = listKeyOf(event);
    const edit = key && listKey(textarea.value, textarea.selectionStart, textarea.selectionEnd, key);
    if (edit) {
      event.preventDefault();
      applyEdit(textarea, edit);
      return;
    }
    // On phones Enter adds a new line; the send button is there to submit.
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (canSend) textarea.form?.requestSubmit();
    }
  }

  // Files and voice aren't there yet: signed-out people go to sign-up, signed-in ones hear it's coming.
  function notYet(what: string) {
    if (signedIn) toast.info(`${what} is coming soon.`);
    else router.push("/signup");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    onSubmit(prompt);
    // Signed out, the prompt stays for when they come back from signing up.
    if (!signedIn) return;
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "";
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative isolate w-full max-w-2xl ${className}`}
    >
      {/* Hidden while docked: the box has moved, so the glow would float on its own. */}
      {variant === "hero" && !dock && (
        <div
          aria-hidden
          className="bg-glow pointer-events-none absolute -inset-x-24 -inset-y-20 -z-10"
        />
      )}
      <div
        style={
          dock
            ? {
                position: "fixed",
                left: dock.boxLeft,
                width: dock.boxWidth,
                bottom: dock.keyboardInset + DOCK_GAP,
                zIndex: 50,
              }
            : undefined
        }
        className="rounded-3xl border border-border bg-surface text-left shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.12)] transition-[border-color,box-shadow] focus-within:border-foreground/20 focus-within:shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-12px_rgb(0_0_0/0.18)]">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        {/* Inset top-right so the scrollbar stays clear of the rounded corner. */}
        <div className="pt-2 pr-2">
          <textarea
            ref={textareaRef}
            id={id}
            name="prompt"
            rows={rows}
            enterKeyHint="enter"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? example}
            style={{
              maxHeight: dock
                ? `min(${MAX_HEIGHT}, ${dock.visibleHeight - DOCK_CHROME}px)`
                : MAX_HEIGHT,
            }}
            className="scrollbar-thin block w-full resize-none bg-transparent pt-2 pr-3 pb-1 pl-5 text-base leading-relaxed text-foreground outline-none placeholder:text-muted"
          />
        </div>

        {/* preventDefault keeps focus in the text box, so tapping a button
            doesn't close the phone keyboard. */}
        <div
          onMouseDown={(event) => event.preventDefault()}
          className="flex items-center justify-between px-3 pb-3"
        >
          {/* Plus and mic aren't built yet. */}
          <button
            type="button"
            aria-label="Add files"
            onClick={() => notYet("Adding files")}
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
              onClick={() => notYet("Voice input")}
              className={`${iconButton} ${swap} text-muted hover:bg-foreground/5 hover:text-foreground ${
                hasText ? "scale-50 -rotate-45 opacity-0" : shown
              }`}
            >
              <Mic size={20} />
            </button>
            <button
              type="submit"
              aria-label={variant === "hero" ? "Start building" : "Send"}
              title={busy ? "Wait for the answer to finish" : undefined}
              inert={!hasText}
              disabled={busy}
              className={`${iconButton} ${swap} bg-foreground text-background enabled:hover:bg-foreground/85 disabled:cursor-not-allowed ${
                !hasText ? "scale-50 rotate-45 opacity-0" : busy ? "scale-100 rotate-0 opacity-30" : shown
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
