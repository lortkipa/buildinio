import "server-only";
import { problem, runTurn } from "@/lib/ai/agent";
import { nameProject as pickName } from "@/lib/ai/naming";
import { runs } from "@/lib/ai/registry";
import type { Listener, Run } from "@/lib/ai/registry";
import { announceChange } from "@/lib/projects/changes";
import { newId } from "@/lib/projects/ids";
import { addMessage, getProject, nameProject, projectExists, updateProject } from "@/lib/projects/server";
import type { AssistantMessage, ProjectData, TurnEvent } from "@/lib/projects/types";

/**
 * Has the AI answer the project's last prompt. The answer is saved when it's done,
 * whoever is still listening: leaving the page doesn't stop it, and coming back
 * joins in (see `listen`). Deleting the project does stop it.
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
      if (!run.controller.signal.aborted) console.error(error);
    })
    .finally(() => {
      if (runs.get(project.id) === run) runs.delete(project.id);
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

  // The first prompt names the project, alongside the answer.
  const prompt = project.messages.findLast((message) => message.role === "user")?.text ?? "";
  const naming =
    project.name === null
      ? pickName(prompt, signal).then((look) => {
          if (nameProject(project.id, look.name, look.icon, look.color)) emit({ type: "named", ...look });
        })
      : Promise.resolve();

  let result: { text: string; built: boolean };
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
        emit({ type: "project_updated", changes });
        return true;
      },
    });
  } catch (error) {
    if (signal.aborted) throw error;
    console.error("The AI's answer failed:", error);
    result = { text: problem(error), built: false };
  }
  await naming.catch(() => {});
  signal.throwIfAborted();
  if (!projectExists(project.id)) return; // Deleted some other way while the AI worked.

  const message: AssistantMessage = {
    id: newId(),
    role: "assistant",
    text: result.text,
    seconds: Math.max(1, Math.floor((Date.now() - run.startedAt) / 1000)),
    feedback: null,
  };
  addMessage(project.id, message);
  const appVersion = project.appVersion + (result.built ? 1 : 0);
  if (result.built) {
    updateProject(project.id, { appVersion, ready: true });
    announceChange(project.id); // The app's share page shows it.
  }
  runs.delete(project.id); // Ready for the next prompt as soon as this one is answered.
  emit({ type: "done", message, appVersion, ready: result.built });
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
