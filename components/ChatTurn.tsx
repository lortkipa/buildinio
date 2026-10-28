"use client";

import { BookOpen, Check, Eye, FilePen, FilePlus, FileText, FileX, Globe, LoaderCircle, SquareTerminal, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MessageText } from "@/components/ChatMessage";
import { shown, swap } from "@/components/styles";
import { usePlayOnce } from "@/components/usePlayOnce";
import { formatSeconds, useNow, useStreamed } from "@/components/useStreamed";
import { CHAR_MS, CLEAR_MS } from "@/lib/projects/store";
import type { Step, Tool, Turn } from "@/lib/projects/types";

type TextStep = Extract<Step, { kind: "text" }>;
type ToolStep = Extract<Step, { kind: "tool" }>;

const TOOL_ICONS: Record<Tool, LucideIcon> = {
  search: Globe,
  read: FileText,
  create: FilePlus,
  edit: FilePen,
  delete: FileX,
  run: SquareTerminal,
  skill: BookOpen,
  look: Eye,
};

/**
 * The answer being worked on: "Thinking", then what the AI says and the tools it
 * uses, which fold away before its answer. Counts the seconds.
 */
export function ChatTurn({ turn }: { turn: Turn }) {
  return (
    <div aria-busy className="flex flex-col gap-4">
      {turn.phase === "thinking" && <Thinking />}

      {turn.steps.length > 0 && (
        <div
          style={{ transitionDuration: `${CLEAR_MS}ms` }}
          className={`grid transition-[grid-template-rows,opacity] ease-out motion-reduce:transition-none ${
            turn.phase === "clearing" ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]"
          }`}
        >
          <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
            {groupSteps(turn.steps).map((group) =>
              Array.isArray(group) ? (
                <ToolGroup key={group[0].id} steps={group} />
              ) : (
                <StreamedText key={group.id} text={group.text} startedAt={group.startedAt} />
              ),
            )}
          </div>
        </div>
      )}

      {turn.answer && <StreamedText text={turn.answer.text} startedAt={turn.answer.startedAt} />}

      <Elapsed startedAt={turn.startedAt} />
    </div>
  );
}

/** Tools used one after another share a box. */
function groupSteps(steps: Step[]) {
  const groups: (TextStep | ToolStep[])[] = [];
  for (const step of steps) {
    const last = groups.at(-1);
    if (step.kind === "text") groups.push(step);
    else if (Array.isArray(last)) last.push(step);
    else groups.push([step]);
  }
  return groups;
}

function Thinking() {
  const enter = usePlayOnce("motion-safe:animate-enter");
  return (
    <div className={enter.className} onAnimationEnd={enter.onAnimationEnd}>
      <p className="text-shimmer w-fit font-medium motion-safe:animate-shimmer">Thinking</p>
    </div>
  );
}

function StreamedText({ text, startedAt }: { text: string; startedAt: number }) {
  return <MessageText text={useStreamed(text, startedAt, CHAR_MS)} />;
}

function ToolGroup({ steps }: { steps: ToolStep[] }) {
  const enter = usePlayOnce("motion-safe:animate-enter");
  return (
    <ul
      onAnimationEnd={enter.onAnimationEnd}
      className={`rounded-2xl border border-border px-3.5 py-1 ${enter.className}`}
    >
      {steps.map((step) => (
        <ToolRow key={step.id} step={step} />
      ))}
    </ul>
  );
}

/** One tool: what it's doing (shimmering) with a spinner, then what it did with a check (or an X). */
function ToolRow({ step }: { step: ToolStep }) {
  const enter = usePlayOnce("motion-safe:animate-enter");
  const Icon = TOOL_ICONS[step.tool];
  return (
    <li
      onAnimationEnd={enter.onAnimationEnd}
      className={`flex h-9 items-center gap-2.5 text-sm ${enter.className}`}
    >
      <Icon size={16} aria-hidden className="shrink-0 text-muted" />
      {/* Fills the row, so only text that runs out of room fades. */}
      <span className="fade-end min-w-0 flex-1">
        {step.done ? (
          <span className="text-foreground/85">{step.doneLabel}</span>
        ) : (
          <span className="text-shimmer motion-safe:animate-shimmer">{step.label}</span>
        )}
        {step.detail && <span className="ml-2 text-muted">{step.detail}</span>}
      </span>
      {(step.added !== undefined || step.removed !== undefined) && (
        <span className="flex shrink-0 gap-1 text-xs font-medium tabular-nums">
          {/* A deleted file only lost lines. */}
          {step.added || !step.removed ? (
            <span className="text-emerald-600 dark:text-emerald-400">+{step.added ?? 0}</span>
          ) : null}
          {step.removed ? <span className="text-error">&minus;{step.removed}</span> : null}
        </span>
      )}
      <span className="grid shrink-0 place-items-center">
        <LoaderCircle
          size={16}
          aria-hidden
          className={`${swap} text-muted motion-safe:animate-spin ${step.done ? "scale-50 opacity-0" : shown}`}
        />
        <Check
          size={16}
          strokeWidth={2.5}
          aria-label={step.done && !step.failed ? "Done" : undefined}
          className={`${swap} text-emerald-600 dark:text-emerald-400 ${
            step.done && !step.failed ? shown : "scale-50 -rotate-45 opacity-0"
          }`}
        />
        <X
          size={16}
          strokeWidth={2.5}
          aria-label={step.failed ? "Failed" : undefined}
          className={`${swap} text-error ${step.failed ? shown : "scale-50 opacity-0"}`}
        />
      </span>
    </li>
  );
}

/** Seconds since the answer started, where like, dislike and copy go once it's done. */
function Elapsed({ startedAt }: { startedAt: number }) {
  const now = useNow(true, 250);
  return (
    <div className="-mt-2 flex h-8 items-center gap-2 text-xs text-muted tabular-nums">
      <LoaderCircle size={14} aria-hidden className="motion-safe:animate-spin" />
      {formatSeconds(Math.max(0, Math.floor((now - startedAt) / 1000)))}
    </div>
  );
}
