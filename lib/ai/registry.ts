import "server-only";
import type { ProjectChanges, StepData, TurnEvent } from "@/lib/projects/types";

/** Hears what the AI does; null once the answer is over (done, or stopped). */
export type Listener = (event: TurnEvent | null) => void;

/**
 * An answer the AI is working on. It doesn't belong to a request: it keeps going
 * when the browser leaves, and anyone who comes back joins in (see runs.ts).
 */
export type Run = {
  projectId: string;
  userId: string;
  controller: AbortController;
  startedAt: number;
  steps: StepData[]; // So far, for those who join late.
  projectChanges?: ProjectChanges; // Settings changed during this answer, replayed on reconnect.
  listeners: Set<Listener>;
  finished: Promise<void>;
};

// Kept on globalThis, so reloading this module in development doesn't lose answers in progress.
const scope = globalThis as typeof globalThis & { buildinioRuns?: Map<string, Run> };
export const runs = (scope.buildinioRuns ??= new Map<string, Run>());

export function isRunning(projectId: string) {
  return runs.has(projectId);
}

/** Why an answer was aborted when its user pressed Stop: everything it did is undone. */
export const STOPPED = "stopped";

/** Stop pressed: the answer ends, undoes what it did and takes the prompt back (see runs.ts). */
export function stopAnswer(projectId: string, userId: string) {
  const run = runs.get(projectId);
  if (run?.userId === userId) run.controller.abort(STOPPED);
}

/** Stops the AI working on a project, if it is, and waits until it has. */
export async function stopRun(projectId: string) {
  const run = runs.get(projectId);
  if (!run) return;
  run.controller.abort();
  await run.finished;
}

export async function stopUserRuns(userId: string) {
  const own = [...runs.values()].filter((run) => run.userId === userId);
  await Promise.all(own.map((run) => stopRun(run.projectId)));
}
