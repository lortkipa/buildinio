"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpIcon, MicIcon, PlusIcon } from "./icons";
import { hasFinePointer } from "./pointer";
import { revealForm, VIEWPORT_GAP } from "./reveal-form";

// Shown one after another as the placeholder. Keep them frontend-only (Phase 1).
const EXAMPLES = [
  "A habit tracker with daily streaks and a calendar view",
  "A landing page for my coffee shop with the menu and opening hours",
  "A recipe box where I can save and search my favorite meals",
  "A flashcard app to help me learn Spanish",
  "A portfolio site to show off my photography",
  "A workout timer with custom intervals and rest breaks",
  "A budget planner that shows where my money goes each month",
  "A trip planner with a day-by-day plan and a packing list",
];

// Grow with the content up to the max height (see fitTextarea), after which it scrolls.
function autosize(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

// One line (text-base/6) plus the textarea's pt-3 and pb-2.
const MIN_TEXTAREA_HEIGHT = 44;

// Cap the textarea so the form fits in the visible area (see revealForm), then fit the textarea
// to its content.
function fitTextarea(textarea: HTMLTextAreaElement) {
  const viewport = window.visualViewport;
  const form = textarea.form;
  // Pinch zoom shrinks the visual viewport too; keep the last cap while zoomed.
  if (viewport && form && viewport.scale === 1) {
    const room = viewport.height - (form.offsetHeight - textarea.offsetHeight) - 2 * VIEWPORT_GAP;
    // 15rem is max-h-60, the cap before this runs and on roomy screens.
    textarea.style.maxHeight = `min(15rem, ${Math.max(room, MIN_TEXTAREA_HEIGHT)}px)`;
  }
  autosize(textarea);
}

// nextStep: where sending the prompt and every button lead, e.g. signing up first. Without it they
// do nothing yet: generating apps is not built.
export function PromptInput({ nextStep }: { nextStep?: string }) {
  const id = useId();
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);
  const hasText = value.trim() !== "";

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    // Let desktop users type right away; on phones this would pop up the keyboard.
    if (hasFinePointer()) textarea.focus();
    // The visual viewport resizes when the keyboard opens or closes, and on any window resize
    // (a new width changes the line wrapping, and with it the height).
    const onResize = () => {
      fitTextarea(textarea);
      if (document.activeElement === textarea && textarea.form) revealForm(textarea.form);
    };
    window.visualViewport?.addEventListener("resize", onResize);
    return () => window.visualViewport?.removeEventListener("resize", onResize);
  }, []);

  // Every button and sending the prompt lead to the next step, so have it ready.
  useEffect(() => {
    if (nextStep) router.prefetch(nextStep);
  }, [router, nextStep]);

  function goNext() {
    if (nextStep) router.push(nextStep);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    goNext();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends and Shift+Enter adds a line. On touch keyboards Enter always adds a line.
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    if (!hasFinePointer()) return;
    event.preventDefault();
    if (hasText) event.currentTarget.form?.requestSubmit();
  }

  return (
    <div className="w-full text-left">
      <form
        onSubmit={handleSubmit}
        className="relative scroll-my-4 rounded-3xl border border-zinc-950/10 bg-white/80 shadow-xl shadow-zinc-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/75 dark:shadow-black/30"
      >
        <div className="relative mx-2 mt-2">
          <label htmlFor={id} className="sr-only">
            Describe the app you want to build
          </label>
          {value === "" && (
            <span
              key={exampleIndex}
              aria-hidden
              onAnimationEnd={() => setExampleIndex((index) => (index + 1) % EXAMPLES.length)}
              className="pointer-events-none absolute inset-x-0 top-0 truncate px-3 pt-3 text-base/6 text-zinc-500 animate-placeholder-cycle motion-reduce:animate-placeholder-fade dark:text-zinc-400"
            >
              {EXAMPLES[exampleIndex]}
            </span>
          )}
          <textarea
            ref={textareaRef}
            id={id}
            rows={1}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              fitTextarea(event.target);
              if (event.target.form) revealForm(event.target.form);
            }}
            onKeyDown={handleKeyDown}
            onMouseMove={(event) => {
              // Chrome shows the text cursor over a custom-styled scrollbar, so switch it here.
              const textarea = event.currentTarget;
              textarea.style.cursor =
                event.nativeEvent.offsetX > textarea.clientWidth ? "default" : "";
            }}
            className="prompt-scrollbar scroll-fade-y block max-h-60 w-full resize-none overflow-y-auto bg-transparent px-3 pt-3 pb-2 text-base/6 outline-none"
          />
        </div>

        <div className="flex items-center justify-between p-3 pt-1">
          <button
            type="button"
            aria-label="Add files"
            onClick={goNext}
            className="grid size-9 place-items-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <PlusIcon className="size-5" />
          </button>

          {/* One button: a mic while the box is empty, morphing into send once there is text. */}
          <button
            type={hasText ? "submit" : "button"}
            aria-label={hasText ? "Send" : "Voice input"}
            title={hasText ? "Send" : undefined}
            // With text it submits the form instead, and handleSubmit navigates.
            onClick={hasText ? undefined : goNext}
            className="group/send relative size-9 rounded-full text-zinc-600 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <span
              aria-hidden
              className={`absolute inset-0 rounded-full bg-brand-gradient shadow-md shadow-brand-magenta/30 transition duration-300 ease-spring motion-reduce:transition-none ${
                hasText
                  ? "scale-100 opacity-100 group-hover/send:brightness-110"
                  : "scale-50 opacity-0"
              }`}
            />
            <MicIcon
              className={`absolute inset-0 m-auto size-5 transition duration-300 ease-spring motion-reduce:transition-none ${
                hasText ? "scale-50 -rotate-90 opacity-0" : ""
              }`}
            />
            <ArrowUpIcon
              className={`absolute inset-0 m-auto size-5 text-white transition duration-300 ease-spring motion-reduce:transition-none ${
                hasText ? "" : "translate-y-2 scale-50 opacity-0"
              }`}
            />
          </button>
        </div>
      </form>
    </div>
  );
}
