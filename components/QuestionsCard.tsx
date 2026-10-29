"use client";

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { Check, ChevronLeft, PenLine } from "lucide-react";
import { focusRing } from "@/components/styles";
import { usePlayOnce } from "@/components/usePlayOnce";
import { useKeyboardDock } from "@/components/useKeyboardDock";
import type { Dock } from "@/components/useKeyboardDock";
import { formatAnswers } from "@/lib/projects/questions";
import type { Answer } from "@/lib/projects/questions";
import type { Question } from "@/lib/projects/types";

const KEYBOARD_GAP = 12; // px between the card and the phone keyboard.

/** What's picked so far: options, and their own answer (`ownOn` while it's chosen). */
type Draft = { picked: string[]; own: string; ownOn: boolean };

const EMPTY: Draft = { picked: [], own: "", ownOn: false };

const row = `flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 py-2.5 text-left transition-colors ${focusRing}`;
const rowOff = "cursor-pointer border-border hover:bg-foreground/5";
const rowOn = "border-foreground bg-foreground/5";
const textButton = `h-9 cursor-pointer rounded-full px-3 text-sm font-medium text-muted transition-colors hover:bg-foreground/5 hover:text-foreground ${focusRing}`;

function answered(draft: Draft) {
  return draft.picked.length > 0 || (draft.ownOn && draft.own.trim() !== "");
}

type QuestionsCardProps = {
  questions: Question[];
  onAnswer: (text: string) => void;
  onKeyboard?: (open: boolean) => void; // The phone keyboard opened for your own answer, or closed.
};

/**
 * The AI's questions, one at a time: pick one (or any), or type your own, then Next, or
 * Skip. The answers (skipped ones too) are sent as the next prompt.
 */
export function QuestionsCard({ questions, onAnswer, onKeyboard }: QuestionsCardProps) {
  const [step, setStep] = useState(0);
  const [moved, setMoved] = useState(false); // Animate questions in only once moving between them.
  const [drafts, setDrafts] = useState<Draft[]>(() => questions.map(() => EMPTY));
  const [keyboard, setKeyboard] = useState<Dock | null>(null);
  const card = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const enter = usePlayOnce("motion-safe:animate-enter");

  const question = questions[step];
  const draft = drafts[step];
  const last = step === questions.length - 1;

  // While the phone keyboard is open for your own answer, the prompt box steps aside and
  // the card scrolls up above the keyboard, buttons and all (but never the field out of sight).
  const typing = keyboard !== null;
  useEffect(() => {
    if (!typing || !onKeyboard) return;
    onKeyboard(true);
    return () => onKeyboard(false);
  }, [typing, onKeyboard]);

  useEffect(() => {
    if (!keyboard) return;
    const frame = requestAnimationFrame(() => {
      const field = card.current?.querySelector("input");
      if (!card.current || !field) return;
      const below = card.current.getBoundingClientRect().bottom - (window.innerHeight - keyboard.keyboardInset - KEYBOARD_GAP);
      const above = field.getBoundingClientRect().top - (keyboard.visibleTop + KEYBOARD_GAP);
      const by = Math.min(below, above);
      if (by > 0) window.scrollBy({ top: by });
    });
    return () => cancelAnimationFrame(frame);
  }, [keyboard]);

  function change(next: Draft) {
    setDrafts((all) => all.map((d, i) => (i === step ? next : d)));
  }

  function go(to: number) {
    setStep(to);
    setMoved(true);
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }

  function send(all: Draft[]) {
    const answers: Answer[] = all.map((d) => (answered(d) ? { picked: d.picked, own: d.ownOn ? d.own : "" } : null));
    onAnswer(formatAnswers(questions, answers));
  }

  function next(all = drafts) {
    if (last) send(all);
    else go(step + 1);
  }

  function skip() {
    const all = drafts.map((d, i) => (i === step ? EMPTY : d));
    setDrafts(all);
    next(all);
  }

  function pick(option: string) {
    if (question.multiple) {
      const picked = draft.picked.includes(option)
        ? draft.picked.filter((p) => p !== option)
        : question.options.filter((o) => o === option || draft.picked.includes(o)); // In their order.
      return change({ ...draft, picked });
    }
    change({ ...draft, picked: [option], ownOn: false });
  }

  function toggleOwn() {
    if (question.multiple) change({ ...draft, ownOn: !draft.ownOn });
    else change({ ...draft, picked: [], ownOn: true });
  }

  // 1, 2, 3… pick the options (and the last number, your own).
  function handleKey(event: KeyboardEvent) {
    if (event.target instanceof HTMLInputElement || event.metaKey || event.ctrlKey || event.altKey) return;
    const index = Number(event.key) - 1;
    if (!Number.isInteger(index) || index < 0 || index > question.options.length) return;
    event.preventDefault();
    if (index < question.options.length) pick(question.options[index]);
    else if (!draft.ownOn || question.multiple) toggleOwn();
  }

  return (
    <>
      <section
        ref={card}
        aria-label="Questions"
        onKeyDown={handleKey}
        onAnimationEnd={enter.onAnimationEnd}
        className={`mt-4 rounded-3xl border border-border bg-surface p-4 sm:p-5 ${enter.className}`}
      >
        <Step key={step} play={moved}>
          <div className="flex items-start justify-between gap-4">
            <h3 ref={heading} tabIndex={-1} className="font-semibold outline-none">
              {question.question}
            </h3>
            {questions.length > 1 && (
              <span className="mt-0.5 shrink-0 text-sm text-muted tabular-nums">
                {step + 1} of {questions.length}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-muted">{question.multiple ? "Pick any" : "Pick one"}</p>

          <div
            role={question.multiple ? "group" : "radiogroup"}
            aria-label={question.question}
            className="mt-4 flex flex-col gap-2"
          >
            {question.options.map((option) => {
              const on = draft.picked.includes(option);
              return (
                <button
                  key={option}
                  type="button"
                  role={question.multiple ? "checkbox" : "radio"}
                  aria-checked={on}
                  onClick={() => pick(option)}
                  className={`${row} ${on ? rowOn : rowOff}`}
                >
                  <Mark on={on} multiple={question.multiple} />
                  <span className="min-w-0 flex-1 wrap-anywhere">{option}</span>
                </button>
              );
            })}
            <OwnAnswer
              draft={draft}
              multiple={question.multiple}
              onToggle={toggleOwn}
              onChange={(own) => change({ ...draft, own })}
              onEnter={() => answered(draft) && next()}
              onKeyboard={setKeyboard}
            />
          </div>
        </Step>

        <div className="mt-5 flex items-center gap-1">
          {step > 0 && (
            <button
              type="button"
              onClick={() => go(step - 1)}
              className={`${textButton} -ml-2 flex items-center gap-1 pl-2`}
            >
              <ChevronLeft size={18} aria-hidden />
              Back
            </button>
          )}
          <span className="flex-1" />
          <button type="button" onClick={skip} className={textButton}>
            Skip
          </button>
          <button
            type="button"
            disabled={!answered(draft)}
            onClick={() => next()}
            className={`ml-1 h-9 cursor-pointer rounded-full bg-foreground px-4 text-sm font-medium text-background transition-colors enabled:hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-30 ${focusRing}`}
          >
            {last ? "Send" : "Next"}
          </button>
        </div>
      </section>
      {/* Room to scroll the card above the keyboard, where it covers the page (iOS). */}
      {keyboard && keyboard.keyboardInset > 0 && <div aria-hidden style={{ height: keyboard.keyboardInset }} />}
    </>
  );
}

/** One question's content, which slides in when you move to it. */
function Step({ play, children }: { play: boolean; children: ReactNode }) {
  const enter = usePlayOnce("motion-safe:animate-enter", play);
  return (
    <div onAnimationEnd={enter.onAnimationEnd} className={enter.className}>
      {children}
    </div>
  );
}

/** A circle for one answer, a square for any. */
function Mark({ on, multiple }: { on: boolean; multiple: boolean }) {
  return (
    <span
      aria-hidden
      className={`grid size-5 shrink-0 place-items-center border-[1.5px] transition-colors ${
        multiple ? "rounded-md" : "rounded-full"
      } ${on ? "border-foreground bg-foreground text-background" : "border-foreground/25"}`}
    >
      {on && <Check size={13} strokeWidth={3} />}
    </span>
  );
}

type OwnAnswerProps = {
  draft: Draft;
  multiple: boolean;
  onToggle: () => void;
  onChange: (own: string) => void;
  onEnter: () => void;
  onKeyboard: (dock: Dock | null) => void;
};

/** The last row: "Type your own…", which turns into a text field once chosen. */
function OwnAnswer({ draft, multiple, onToggle, onChange, onEnter, onKeyboard }: OwnAnswerProps) {
  if (!draft.ownOn) {
    return (
      <button
        type="button"
        role={multiple ? "checkbox" : "radio"}
        aria-checked={false}
        onClick={onToggle}
        className={`${row} ${rowOff} text-muted`}
      >
        <PenLine size={18} aria-hidden className="mx-px shrink-0" />
        <span className="min-w-0 flex-1 wrap-anywhere">{draft.own.trim() || "Type your own…"}</span>
      </button>
    );
  }
  return (
    <div className={`${row} ${rowOn} focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-foreground`}>
      {multiple ? (
        <button
          type="button"
          role="checkbox"
          aria-checked
          aria-label="Your own answer"
          onClick={onToggle}
          className="-m-1 cursor-pointer rounded-md p-1 outline-none"
        >
          <Mark on multiple />
        </button>
      ) : (
        <Mark on multiple={false} />
      )}
      <OwnInput value={draft.own} onChange={onChange} onEnter={onEnter} onKeyboard={onKeyboard} />
    </div>
  );
}

type OwnInputProps = Pick<OwnAnswerProps, "onChange" | "onEnter" | "onKeyboard"> & { value: string };

/** The field for your own answer. Says where the phone keyboard is while it's open for it. */
function OwnInput({ value, onChange, onEnter, onKeyboard }: OwnInputProps) {
  const field = useRef<HTMLInputElement>(null);
  const dock = useKeyboardDock(field, field);
  useEffect(() => onKeyboard(dock), [dock, onKeyboard]);
  useEffect(() => () => onKeyboard(null), [onKeyboard]);
  return (
    <input
      ref={field}
      autoFocus
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          onEnter();
        }
      }}
      aria-label="Your own answer"
      placeholder="Type your own…"
      maxLength={500}
      className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted"
    />
  );
}
