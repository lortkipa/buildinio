import "server-only";
import { problem, runTurn } from "@/lib/ai/agent";
import { nameProject as pickName } from "@/lib/ai/naming";
import { runs, STOPPED } from "@/lib/ai/registry";
import type { Listener, Run } from "@/lib/ai/registry";
import { announceChange } from "@/lib/projects/changes";
import { newId } from "@/lib/projects/ids";
import {
  addMessage,
  clearQuestions,
  deleteMessage,
  getProject,
  nameProject,
  projectExists,
  updateProject,
} from "@/lib/projects/server";
import type { AssistantMessage, ProjectData, ProjectSettings, TurnEvent } from "@/lib/projects/types";
import { dropSnapshot, restoreSnapshot, takeSnapshot } from "@/lib/sandbox/snapshot";
import { ensureWorkspace } from "@/lib/sandbox/workspace";

/**
 * Has the AI answer the project's last prompt. The answer is saved when it's done,
 * whoever is still listening: leaving the page doesn't stop it, and coming back
 * joins in (see `listen`). Deleting the project does stop it, and so does Stop, which
 * also undoes everything the answer did (see `withdraw`).
 */
export function startRun(project: ProjectData, userId: string) {
  const run: Run = {
    projectId: project.id,
    userId,
    controller: new AbortController(),
    startedAt: Date.now(),
    steps: [],
    listeners: new Set(),
    finished: Promise.resolve(),
  };
  runs.set(project.id, run);
  run.finished = answer(run, project)
    .catch((error) => {
      const { signal } = run.controller;
      if (!signal.aborted || signal.reason === STOPPED) console.error(error);
    })
    .finally(async () => {
      if (runs.get(project.id) === run) {
        runs.delete(project.id);
        await dropSnapshot(project.id).catch(() => {});
      }
      run.listeners.forEach((listener) => listener(null));
    });
  return run;
}

/** Hears the answer in progress, starting with what happened so far. False if there's none. */
export function listen(projectId: string, listener: Listener) {
  const run = runs.get(projectId);
  if (!run) return null;
  listener({ type: "snapshot", elapsedMs: Date.now() - run.startedAt, steps: run.steps, changes: run.projectChanges });
  run.listeners.add(listener);
  return () => {
    run.listeners.delete(listener);
  };
}

async function answer(run: Run, project: ProjectData) {
  const { signal } = run.controller;
  const emit = (event: TurnEvent) => send(run, event);

  // What Stop puts back: the code as it is now, and the settings this answer changes.
  await ensureWorkspace(project.id);
  await takeSnapshot(project.id);
  const undo: Undo = { before: { name: project.name, icon: project.icon, color: project.color }, set: {} };

  // The first prompt names the project, alongside the answer.
  const prompt = project.messages.findLast((message) => message.role === "user")?.text ?? "";
  const naming =
    project.name === null
      ? pickName(prompt, signal).then((look) => {
          if (!nameProject(project.id, look.name, look.icon, look.color)) return;
          Object.assign(undo.set, look);
          emit({ type: "named", ...look });
        })
      : Promise.resolve();

  let result: Awaited<ReturnType<typeof runTurn>> | null = null;
  try {
    result = await runTurn({
      projectId: project.id,
      name: project.name,
      icon: project.icon,
      color: project.color,
      messages: project.messages,
      hasApp: project.appVersion > 0,
      signal,
      emit,
      changeProject: async (changes) => {
        // Finish initial naming first so it can't overwrite an explicit icon or color.
        await naming;
        signal.throwIfAborted();
        if (!getProject(run.userId, project.id)) return false;
        updateProject(project.id, changes);
        Object.assign(undo.set, changes);
        emit({ type: "project_updated", changes });
        return true;
      },
    });
  } catch (error) {
    if (signal.aborted && signal.reason !== STOPPED) throw error;
    if (!signal.aborted) {
      console.error("The AI's answer failed:", error);
      result = { text: problem(error), built: false };
    }
  }
  await naming.catch(() => {});
  if (signal.reason === STOPPED) return withdraw(run, project, undo);
  signal.throwIfAborted();
  if (!result || !projectExists(project.id)) return; // Deleted some other way while the AI worked.

  const message: AssistantMessage = {
    id: newId(),
    role: "assistant",
    text: result.text,
    seconds: Math.max(1, Math.floor((Date.now() - run.startedAt) / 1000)),
    feedback: null,
    ...(result.questions && { questions: result.questions }),
  };
  addMessage(project.id, message);
  const appVersion = project.appVersion + (result.built ? 1 : 0);
  if (result.built) {
    updateProject(project.id, { appVersion, ready: true });
    announceChange(project.id); // The app's share page shows it.
  }
  await dropSnapshot(project.id);
  runs.delete(project.id); // Ready for the next prompt as soon as this one is answered.
  emit({ type: "done", message, appVersion, ready: result.built });
}

/** The settings before the answer, and the ones it set: naming, or the AI's tools. */
type Undo = { before: ProjectSettings; set: Partial<ProjectSettings> };

/**
 * Stop was pressed: everything the answer did is undone, as if the prompt was never
 * sent. The code goes back to the snapshot (the built app too), the settings it changed
 * go back unless they've been changed by hand since, and the prompt is taken out of
 * the chat so the browser can put it back in the prompt box.
 */
async function withdraw(run: Run, project: ProjectData, { before, set }: Undo) {
  // The prompt, and the skipped questions sent just before it, if any.
  const answered = project.messages.findLastIndex((message) => message.role === "assistant");
  const prompts = project.messages.slice(answered + 1);
  const prompt = prompts.at(-1);
  if (!prompt || !projectExists(project.id)) return;
  await restoreSnapshot(project.id);

  const now = getProject(run.userId, project.id);
  if (!now) return;
  const settings: ProjectSettings = { name: now.name, icon: now.icon, color: now.color };
  for (const key of Object.keys(set) as (keyof ProjectSettings)[]) {
    if (now[key] === set[key]) Object.assign(settings, { [key]: before[key] });
  }
  updateProject(project.id, settings);
  for (const message of prompts) deleteMessage(project.id, message.id);
  // Questions the stopped prompt answered stay answered: the answers go back in the prompt box.
  const asked = project.messages[answered];
  if (asked?.role === "assistant" && asked.questions) clearQuestions(project.id, asked.id);
  await dropSnapshot(project.id);
  runs.delete(project.id); // Ready for the next prompt.
  send(run, { type: "withdrawn", messageIds: prompts.map((message) => message.id), text: prompt.text, settings });
}

/** Tells everyone listening, and keeps the steps for those who join later. */
function send(run: Run, event: TurnEvent) {
  if (event.type === "project_updated") {
    run.projectChanges = { ...run.projectChanges, ...event.changes };
  } else if (event.type === "step") {
    run.steps.push(event.step);
  } else if (event.type === "text") {
    run.steps = run.steps.map((step) =>
      step.id === event.id && step.kind === "text" ? { ...step, text: step.text + event.delta } : step,
    );
  } else if (event.type === "tool") {
    run.steps = run.steps.map((step) => (step.id === event.step.id ? event.step : step));
  }
  run.listeners.forEach((listener) => listener(event));
}
