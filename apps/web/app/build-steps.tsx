"use client";

import { useEffect, useState } from "react";
import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  FilePlusIcon,
  LoaderIcon,
  PencilIcon,
  SearchIcon,
  SquareIcon,
  SquareTerminalIcon,
} from "./icons";
import type { Build, BuildAction, BuildStep } from "./projects";

const ACTION_ICONS = {
  search: SearchIcon,
  create: FilePlusIcon,
  edit: PencilIcon,
  command: SquareTerminalIcon,
} as const satisfies Record<BuildAction["kind"], typeof SearchIcon>;

// A time as m:ss, e.g. 0:24.
function clock(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

const fileName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

// What an action row says: what it's doing while running, and what it did after.
function actionLabel({ kind, target, status }: BuildAction) {
  const running = status === "running";
  switch (kind) {
    case "search":
      return running ? `Searching “${target}”…` : `Searched “${target}”`;
    case "create":
      return running ? `Creating ${fileName(target)}…` : target;
    case "edit":
      return running ? `Editing ${fileName(target)}…` : target;
    case "command":
      return running ? `Running ${target}…` : target;
  }
}

/*
 * A build in the chat, as the AI goes through it (projects.ts): its steps, each with a check once
 * done, a spinner while running and a ring until then. The running step shows how long the build has
 * been going, and its searches, files and commands under a guide line; other steps show theirs when
 * clicked. A stopped build stays as far as it got, its step in progress marked with a square and the
 * time it stopped after. No box or heading: it reads as part of the AI's reply, and is gone once the
 * build is done.
 */
export function BuildSteps({ build }: { build: Build }) {
  const running = build.status === "running";
  const [now, setNow] = useState(() => Date.now());
  // Steps the user opened or closed. The others are open only while running.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});
  // An action animates in as it starts, unless it was already there when this mounted (e.g. coming
  // back to the chat). Opening a step doesn't replay it.
  const [shown] = useState(
    () => new Set(build.steps.flatMap((step) => step.actions.map((action) => action.id))),
  );

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const current = build.steps.find((step) => step.status === "running");
  const time = running
    ? clock(now - build.startedAt)
    : `Stopped after ${clock(build.duration ?? 0)}`;

  return (
    <div className="w-full">
      <ol aria-label="Build progress">
        {build.steps.map((step) => {
          const open = toggled[step.id] ?? step.status === "running";
          return (
            <Step
              key={step.id}
              step={step}
              open={open}
              time={step.status === "running" || step.status === "stopped" ? time : undefined}
              shown={shown}
              onToggle={() => setToggled((all) => ({ ...all, [step.id]: !open }))}
            />
          );
        })}
      </ol>
      <p aria-live="polite" className="sr-only">
        {running ? (current?.title ?? "") : "Build stopped"}
      </p>
    </div>
  );
}

function Step({
  step,
  open,
  time,
  shown,
  onToggle,
}: {
  step: BuildStep;
  open: boolean;
  // The build's time, on the running or stopped step.
  time: string | undefined;
  shown: Set<string>;
  onToggle: () => void;
}) {
  const pending = step.status === "pending";
  const hasActions = step.actions.length > 0;
  const Chevron = open ? ChevronDownIcon : ChevronRightIcon;

  const row = (
    <>
      <StepIcon status={step.status} />
      <span className="min-w-0 flex-1 truncate">{step.title}</span>
      {time && (
        <span className="shrink-0 text-sm text-zinc-500 tabular-nums dark:text-zinc-400">
          {time}
        </span>
      )}
      {hasActions && (
        <Chevron className="size-4 shrink-0 text-zinc-400 transition-colors group-hover/step:text-zinc-700 dark:text-zinc-500 dark:group-hover/step:text-zinc-200" />
      )}
    </>
  );

  return (
    <li>
      {hasActions ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={onToggle}
          className="group/step flex w-full items-center gap-2.5 rounded-lg text-left text-base/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet"
        >
          {row}
        </button>
      ) : (
        <div
          className={`flex items-center gap-2.5 text-base/8 ${
            pending ? "text-zinc-400 dark:text-zinc-500" : ""
          }`}
        >
          {row}
        </div>
      )}
      {open && hasActions && (
        <ul className="mb-1 ml-2 border-l border-zinc-950/10 pl-4 dark:border-white/10">
          {step.actions.map((action) => (
            <Action
              key={action.id}
              action={action}
              animate={action.status === "running" && !shown.has(action.id)}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function StepIcon({ status }: { status: BuildStep["status"] }) {
  switch (status) {
    case "done":
      return <CheckIcon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />;
    case "running":
      return <LoaderIcon className="size-4 shrink-0 project-glyph" />;
    case "stopped":
      return (
        <span className="grid size-4 shrink-0 place-items-center">
          <SquareIcon className="size-3 fill-current text-zinc-400 dark:text-zinc-500" />
        </span>
      );
    case "pending":
      return (
        <span className="grid size-4 shrink-0 place-items-center">
          <span className="size-3.5 rounded-full border-[1.5px] border-current" />
        </span>
      );
  }
}

function Action({ action, animate }: { action: BuildAction; animate: boolean }) {
  const running = action.status === "running";
  const Icon = running ? LoaderIcon : ACTION_ICONS[action.kind];
  return (
    <li
      className={`flex items-center gap-2 font-mono text-sm/7 ${
        running ? "" : "text-zinc-500 dark:text-zinc-400"
      } ${animate ? "animate-item-in motion-reduce:animate-none" : ""}`}
    >
      <Icon className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{actionLabel(action)}</span>
      {action.status === "done" && action.lines !== undefined && (
        <span className="shrink-0 pl-3 text-emerald-600 tabular-nums dark:text-emerald-400">
          +{action.lines}
        </span>
      )}
    </li>
  );
}
