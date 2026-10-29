import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import * as actions from "@/lib/projects/actions";
import { newId } from "@/lib/projects/ids";
import type { ProjectColor, ProjectIcon } from "@/lib/projects/options";
import type {
  AssistantMessage,
  Feedback,
  Message,
  Project,
  ProjectData,
  Step,
  Turn,
  TurnEvent,
  Visibility,
} from "@/lib/projects/types";

// The signed-in user's projects, as the server keeps them (lib/projects/server.ts),
// with the AI's answers in progress. A store outside React, because hidden pages
// stay alive (cacheComponents): the shared sidebar and every chat see the same
// projects, and an answer keeps going while you're on another page.
//
// The AI runs on the server (app/api/projects/[id]/turn), which streams what it does.
// It's played back here at a readable pace: text shows one more letter every
// CHAR_MS from when it started, the next step waits for it, and the steps fold away
// before the answer.

export const CHAR_MS = 14; // Per letter of an answer.
export const NAME_CHAR_MS = 45; // Per letter of the project's name.
export const CLEAR_MS = 450; // The steps fading away before the answer.
const RETRIES = 3; // Times to reconnect to an answer before giving up.

type State = {
  loaded: boolean; // False on the server and until the user's projects are in.
  userId: string | null;
  projects: Project[]; // Newest first.
};

const NOT_LOADED: State = { loaded: false, userId: null, projects: [] };
let state = NOT_LOADED;
const listeners = new Set<() => void>();
const follows = new Map<string, AbortController>(); // Answers being listened to, by project.
const born = new Map<string, number>(); // When projects and prompts were made in this tab.
const hurry = new Map<string, () => void>(); // Ends the wait for text to stream in, by project.
const NEW_MS = 5000;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(next: State) {
  state = next;
  listeners.forEach((listener) => listener());
}

/** All projects, newest first. `loaded` is false until they're in. */
export function useProjects() {
  return useSyncExternalStore(subscribe, () => state, () => NOT_LOADED);
}

export function useProject(id: string) {
  const { loaded, projects } = useProjects();
  return { loaded, project: projects.find((project) => project.id === id) ?? null };
}

/** Whether a project or prompt was just made here, so it animates in (and ones from before don't). */
export function isNew(id: string) {
  const at = born.get(id);
  return at !== undefined && Date.now() - at < NEW_MS;
}

/**
 * Takes in the user's projects, as the shared layout read them. Does nothing if
 * they're already in. Joins the answers the AI is working on.
 */
export function loadProjects(userId: string, saved: ProjectData[]) {
  if (state.loaded && state.userId === userId) return;
  stopAll();
  // Being answered, or cut off before an answer (the server answers again).
  const waiting = saved.filter((project) => project.running || project.messages.at(-1)?.role === "user");
  setState({
    loaded: true,
    userId,
    projects: saved.map((project) => ({ ...project, turn: waiting.includes(project) ? newTurn() : null })),
  });
  for (const project of waiting) follow(project.id);
}

/** Forgets the user's projects here, after their account is deleted. */
export function forgetProjects(userId: string) {
  if (state.userId !== userId) return;
  stopAll();
  setState(NOT_LOADED);
}

/** Starts a project from the first prompt and has the AI answer it. Returns its id. */
export function createProject(prompt: string) {
  const id = newId();
  const message: Message = { id: newId(), role: "user", text: prompt };
  const project: Project = {
    id,
    name: null,
    icon: "sparkles",
    color: "slate",
    createdAt: Date.now(),
    messages: [message],
    turn: newTurn(),
    ready: false,
    appVersion: 0,
    visibility: "private",
  };
  born.set(id, Date.now());
  born.set(message.id, Date.now());
  setState({ ...state, projects: [project, ...state.projects] });
  follow(id, message);
  return id;
}

/**
 * A follow-up prompt. Ignored while the AI is still answering the last one. `skipped`
 * goes just before it: the AI's questions, all skipped, when a prompt was typed instead.
 */
export function sendMessage(projectId: string, text: string, skipped?: string) {
  const project = find(projectId);
  if (!project || project.turn) return;
  const message: Message = { id: newId(), role: "user", text };
  const before: Message | undefined = skipped ? { id: newId(), role: "user", text: skipped } : undefined;
  const sent = before ? [before, message] : [message];
  for (const m of sent) born.set(m.id, Date.now());
  update(projectId, (p) => ({ ...p, messages: [...p.messages, ...sent], turn: newTurn(), stopping: false }));
  follow(projectId, message, before);
}

export function editProject(id: string, changes: { name: string; icon: ProjectIcon; color: ProjectColor }) {
  update(id, (project) => ({ ...project, ...changes, namedAt: undefined }));
  save(actions.editProject(id, changes));
}

/**
 * Stops the AI's answer. The server undoes everything it did and takes the prompt
 * back out of the chat (a `withdrawn` event), and the prompt goes back in the box.
 */
export function stopAnswer(id: string) {
  const project = find(id);
  if (!project?.turn || project.stopping) return;
  update(id, (p) => ({ ...p, stopping: true }));
  hurry.get(id)?.(); // Don't wait for the text to finish streaming in first.
  save(actions.stopAnswer(id));
}

/** The prompt taken back by Stop, once the prompt box has it. */
export function takeReturned(id: string) {
  if (find(id)?.returned !== undefined) update(id, (project) => ({ ...project, returned: undefined }));
}

/** Deletes the project, its chat and its code. The AI stops if it's working on it. */
export function deleteProject(id: string) {
  follows.get(id)?.abort();
  setState({ ...state, projects: state.projects.filter((project) => project.id !== id) });
  save(actions.deleteProject(id));
}

/** Who can open the app's share link: only its owner, or anyone with the link. */
export function setVisibility(id: string, visibility: Visibility) {
  update(id, (project) => ({ ...project, visibility }));
  save(actions.setVisibility(id, visibility));
}

/** The preview of a just-built app was shown, or its "ready" card dismissed. */
export function markPreviewSeen(id: string) {
  if (!find(id)?.ready) return;
  update(id, (project) => ({ ...project, ready: false }));
  save(actions.markPreviewSeen(id));
}

export function setFeedback(projectId: string, messageId: string, feedback: Feedback | null) {
  update(projectId, (project) => ({
    ...project,
    messages: project.messages.map((message) =>
      message.id === messageId && message.role === "assistant" ? { ...message, feedback } : message,
    ),
  }));
  save(actions.setFeedback(projectId, messageId, feedback));
}

/** Changes show right away; if the server didn't get one, say so. */
function save(request: Promise<unknown>) {
  request.catch(() => toast.error("That change wasn’t saved. Check your connection and try again."));
}

function find(id: string) {
  return state.projects.find((project) => project.id === id);
}

function update(id: string, change: (project: Project) => Project) {
  setState({
    ...state,
    projects: state.projects.map((project) => (project.id === id ? change(project) : project)),
  });
}

function updateTurn(id: string, change: (turn: Turn) => Turn) {
  update(id, (project) => ({ ...project, turn: change(project.turn ?? newTurn()) }));
}

function newTurn(): Turn {
  return { phase: "thinking", startedAt: Date.now(), steps: [], answer: null };
}

function stopAll() {
  follows.forEach((follow) => follow.abort());
  follows.clear();
}

/**
 * Listens to the AI answering a project, from the server: sends `message` first if
 * there is one (with `skipped` before it). Reconnects if the connection drops, since
 * the answer goes on there.
 */
async function follow(projectId: string, message?: Message, skipped?: Message) {
  follows.get(projectId)?.abort();
  const controller = new AbortController();
  follows.set(projectId, controller);
  const { signal } = controller;
  const body = JSON.stringify(
    message
      ? {
          text: message.text,
          messageId: message.id,
          ...(skipped && { skipped: { text: skipped.text, messageId: skipped.id } }),
        }
      : {},
  );

  try {
    for (let attempt = 0; ; attempt++) {
      const result = await listen(projectId, body, signal);
      if (result === "done") return;
      if (result !== "dropped") {
        // Turned down: take the prompt back, so it can be sent again.
        update(projectId, (project) => ({
          ...project,
          messages: project.messages.filter((m) => m.id !== message?.id && m.id !== skipped?.id),
          turn: null,
        }));
        if (typeof result === "string") toast.error(result);
        return;
      }
      if (attempt === RETRIES) break;
      await wait(1000 * 2 ** attempt, signal);
    }
    update(projectId, (project) => ({ ...project, turn: null }));
    toast.error("Lost the connection to the AI. Reload the page to see its answer.");
  } catch (error) {
    if (!signal.aborted) console.error(error);
  } finally {
    if (follows.get(projectId) === controller) follows.delete(projectId);
  }
}

/**
 * One connection to the answer: "done", "dropped" (try again), or why it was turned
 * down (null if the project is gone).
 */
async function listen(projectId: string, body: string, signal: AbortSignal): Promise<string | null> {
  const response = await fetch(`/api/projects/${projectId}/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal,
  }).catch((error) => {
    if (signal.aborted) throw error;
    return null;
  });
  if (!response || response.status >= 500) return "dropped";
  if (!response.ok || !response.body) return response.status === 404 ? null : await response.text();

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return "dropped";
      buffer += value;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as TurnEvent;
        await play(projectId, event, signal);
        if (event.type === "done" || event.type === "withdrawn") return "done";
      }
    }
  } catch (error) {
    if (signal.aborted) throw error;
    return "dropped";
  } finally {
    reader.cancel().catch(() => {});
  }
}

/** Shows one thing the AI did. A new step waits until the text before it has streamed in. */
async function play(projectId: string, event: TurnEvent, signal: AbortSignal) {
  switch (event.type) {
    case "snapshot": {
      // Joining late: what happened so far shows at once.
      if (event.changes) update(projectId, (project) => ({ ...project, ...event.changes, namedAt: undefined }));
      const now = Date.now();
      const steps = event.steps.map((step): Step =>
        step.kind === "text" ? { ...step, startedAt: now - step.text.length * CHAR_MS } : step,
      );
      updateTurn(projectId, (turn) => ({
        ...turn,
        phase: steps.length ? "working" : "thinking",
        startedAt: now - event.elapsedMs,
        steps,
      }));
      return;
    }
    case "named":
      update(projectId, (project) =>
        project.name === null
          ? { ...project, name: event.name, icon: event.icon, color: event.color, namedAt: Date.now() }
          : project,
      );
      return;
    case "project_updated":
      update(projectId, (project) => ({ ...project, ...event.changes, namedAt: undefined }));
      return;
    case "step": {
      await untilShown(projectId, signal);
      const step: Step = event.step.kind === "text" ? { ...event.step, startedAt: Date.now() } : event.step;
      updateTurn(projectId, (turn) => ({ ...turn, phase: "working", steps: [...turn.steps, step] }));
      return;
    }
    case "text":
      updateTurn(projectId, (turn) => ({
        ...turn,
        steps: turn.steps.map((step) =>
          step.id === event.id && step.kind === "text" ? { ...step, text: step.text + event.delta } : step,
        ),
      }));
      return;
    case "tool":
      updateTurn(projectId, (turn) => ({
        ...turn,
        steps: turn.steps.map((step) => (step.id === event.step.id ? event.step : step)),
      }));
      return;
    case "done":
      await untilShown(projectId, signal);
      await finish(projectId, event, signal);
      return;
    case "withdrawn":
      // Stopped: as if the prompt was never sent. If it was stopped here, it goes back in the box.
      update(projectId, (project) => ({
        ...project,
        ...event.settings,
        namedAt: undefined,
        messages: withoutQuestions(project.messages.filter((message) => !event.messageIds.includes(message.id))),
        turn: null,
        stopping: false,
        returned: project.stopping ? event.text : project.returned,
      }));
  }
}

/** The chat after Stop: questions its prompt answered stay answered (like runs.ts's `withdraw`). */
function withoutQuestions(messages: Message[]) {
  const last = messages.at(-1);
  if (last?.role !== "assistant" || !last.questions) return messages;
  return [...messages.slice(0, -1), { ...last, questions: undefined }];
}

/**
 * Ends the answer like the AI wrote it: what it said last stays as the answer while
 * the rest folds away (if it used tools), and the message is saved once it has all
 * streamed in. A build makes the app ready to preview.
 */
async function finish(
  projectId: string,
  { message, appVersion, ready }: { message: AssistantMessage; appVersion: number; ready: boolean },
  signal: AbortSignal,
) {
  const turn = find(projectId)?.turn;
  if (turn && !find(projectId)?.messages.some((m) => m.id === message.id)) {
    const last = turn.steps.findLast((step) => step.kind === "text");
    const kept = last?.kind === "text" && last.text.trim() === message.text.trim() ? last : null;
    if (turn.steps.some((step) => step.kind === "tool")) {
      const answer = kept && { text: message.text, startedAt: kept.startedAt };
      updateTurn(projectId, (t) => ({ ...t, phase: "clearing", steps: t.steps.filter((s) => s !== kept), answer }));
      await wait(CLEAR_MS, signal);
    }
    const answer = { text: message.text, startedAt: kept?.startedAt ?? Date.now() };
    updateTurn(projectId, (t) => ({ ...t, phase: "answering", steps: [], answer }));
    await wait(answer.startedAt + message.text.length * CHAR_MS - Date.now(), signal);
  }
  // The seconds counted here ran on while the text streamed in: don't go back on them.
  const seconds = turn ? Math.max(message.seconds, Math.floor((Date.now() - turn.startedAt) / 1000)) : message.seconds;
  update(projectId, (project) => ({
    ...project,
    messages: project.messages.some((m) => m.id === message.id)
      ? project.messages
      : [...project.messages, { ...message, seconds }],
    turn: null,
    stopping: false, // Too late: the answer was already done.
    ready: ready || project.ready,
    appVersion,
  }));
}

/** Waits until the last bit of text has streamed in, or Stop is pressed. */
async function untilShown(projectId: string, signal: AbortSignal) {
  const project = find(projectId);
  const step = project?.turn?.steps.findLast((s) => s.kind === "text");
  if (project?.stopping || step?.kind !== "text") return;
  const skip = new AbortController();
  hurry.set(projectId, () => skip.abort());
  try {
    await wait(step.startedAt + step.text.length * CHAR_MS - Date.now(), AbortSignal.any([signal, skip.signal]));
  } catch (error) {
    if (signal.aborted || !skip.signal.aborted) throw error;
  } finally {
    hurry.delete(projectId);
  }
}

function wait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    if (ms <= 0) return resolve();
    const onAbort = () => {
      window.clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = window.setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
