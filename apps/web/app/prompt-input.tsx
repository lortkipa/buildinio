"use client";

import { useEffect, useId, useRef, useState } from "react";

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

const hasFinePointer = () => window.matchMedia("(pointer: fine)").matches;

// Grow with the content; max-h-60 on the textarea caps it, after which it scrolls.
function autosize(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

export function PromptInput() {
  const id = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [exampleIndex, setExampleIndex] = useState(0);
  const hasText = value.trim() !== "";

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    // Let desktop users type right away; on phones this would pop up the keyboard.
    if (hasFinePointer()) textarea.focus();
    // A new width changes the line wrapping, and with it the height.
    const onResize = () => autosize(textarea);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Nothing to send to yet: app generation is not built. The builder flow starts here.
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
        className="relative rounded-3xl border border-zinc-950/10 bg-white/80 shadow-xl shadow-zinc-950/5 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/75 dark:shadow-black/30"
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
              autosize(event.target);
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
            title="Coming soon"
            className="grid size-9 place-items-center rounded-full text-zinc-600 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <PlusIcon className="size-5" />
          </button>

          {/* One button: a mic while the box is empty, morphing into send once there is text. */}
          <button
            type={hasText ? "submit" : "button"}
            aria-label={hasText ? "Send" : "Voice input"}
            title={hasText ? "Send" : "Coming soon"}
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

// Icons from Lucide (https://lucide.dev, ISC license).
function Icon({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </Icon>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 19v3" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <rect x="9" y="2" width="6" height="13" rx="3" />
    </Icon>
  );
}

function ArrowUpIcon({ className }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </Icon>
  );
}
