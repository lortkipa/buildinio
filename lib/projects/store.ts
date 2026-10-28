import { useSyncExternalStore } from "react";
import { buildPlan, buildSummary, guessIdea, replyFor } from "@/lib/projects/mock";
import type { ProjectColor, ProjectIcon } from "@/lib/projects/options";
import type { Feedback, Message, Project, Step, Turn } from "@/lib/projects/types";

// The signed-in user's projects, kept in this browser's localStorage (one key per
// account). A store outside React, because hidden pages stay alive
// (cacheComponents): the shared sidebar and every chat see the same projects,
// and an answer keeps going while you're on another page.
//
// The AI is fake (see mock.ts). Text streams by the clock: a step only records when
// it started, and the UI shows one more letter every CHAR_MS from then on.

export const CHAR_MS = 14; // Per letter of an answer.
export const NAME_CHAR_MS = 45; // Per letter of the project's name.
const THINK_MS = 1600;
const NAME_MS = 1400; // The name's skeleton.
const REPLY_THINK_MS = 1100;
export const CLEAR_MS = 450; // The build's steps fading away before the summary.
const AFTER_TEXT_MS = 450;
const AFTER_TOOL_MS = 250;

type State = {
  loaded: boolean; // False on the server and until the browser's copy is read.
  userId: string | null;
  projects: Project[]; // Newest first.
};

const NOT_LOADED: State = { loaded: false, userId: null, projects: [] };
let state = NOT_LOADED;
const listeners = new Set<() => void>();
const runs = new Map<string, AbortController>(); // Answers being worked on, by project.
const born = new Map<string, number>(); // When projects and prompts were made in this tab.
const NEW_MS = 5000;

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setState(next: State) {
  state = next;
  save();
  listeners.forEach((listener) => listener());
}

function storageKey(userId: string) {
  return `buildinio:projects:${userId}`;
}

// Answers in progress aren't saved: one cut off by a reload starts over (see loadProjects).
function save() {
  if (!state.userId) return;
  try {
    const projects = state.projects.map((project) => ({ ...project, turn: null }));
    localStorage.setItem(storageKey(state.userId), JSON.stringify(projects));
  } catch {
    // Full or blocked storage: keep going in memory.
  }
}

function read(userId: string): Project[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storageKey(userId)) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((project) => typeof project?.id === "string" && Array.isArray(project.messages));
  } catch {
    return [];
  }
}

/** All projects, newest first. `loaded` is false until the browser's copy is read. */
export function useProjects() {
  return useSyncExternalStore(subscribe, () => state, () => NOT_LOADED);
}

export function useProject(id: string) {
  const { loaded, projects } = useProjects();
  return { loaded, project: projects.find((project) => project.id === id) ?? null };
}

/** Whether a project or prompt was just made here, so it animates in (and ones read from storage don't). */
export function isNew(id: string) {
  const at = born.get(id);
  return at !== undefined && Date.now() - at < NEW_MS;
}

/** Reads the user's projects from this browser. Called by AppShell; does nothing if they're already in. */
export function loadProjects(userId: string) {
  if (state.loaded && state.userId === userId) return;
  stopAll();
  setState({ loaded: true, userId, projects: read(userId) });
  // Answers that were cut off by leaving the page start again.
  for (const project of state.projects) {
    if (project.messages.at(-1)?.role !== "user") continue;
    if (project.messages.length === 1) build(project.id, project.messages[0].text);
    else reply(project.id);
  }
}

/** Drops the user's projects from this browser, after their account is deleted. */
export function forgetProjects(userId: string) {
  try {
    localStorage.removeItem(storageKey(userId));
  } catch {}
  if (state.userId === userId) {
    stopAll();
    state = NOT_LOADED;
    listeners.forEach((listener) => listener());
  }
}

/** Starts a project from the first prompt and has the AI build it. Returns its id. */
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
    turn: null,
  };
  born.set(id, Date.now());
  born.set(message.id, Date.now());
  setState({ ...state, projects: [project, ...state.projects] });
  build(id, prompt);
  return id;
}

/** A follow-up prompt. Ignored while the AI is still answering the last one. */
export function sendMessage(projectId: string, text: string) {
  const project = find(projectId);
  if (!project || project.turn) return;
  const message: Message = { id: newId(), role: "user", text };
  born.set(message.id, Date.now());
  update(projectId, (p) => ({ ...p, messages: [...p.messages, message] }));
  reply(projectId);
}

export function editProject(id: string, changes: { name: string; icon: ProjectIcon; color: ProjectColor }) {
  update(id, (project) => ({ ...project, ...changes, namedAt: undefined }));
}

export function deleteProject(id: string) {
  runs.get(id)?.abort();
  setState({ ...state, projects: state.projects.filter((project) => project.id !== id) });
}

/** The preview of a just-built app was shown, or its "ready" card dismissed. */
export function markPreviewSeen(id: string) {
  if (!find(id)?.ready) return;
  update(id, (project) => ({ ...project, ready: undefined }));
}

export function setFeedback(projectId: string, messageId: string, feedback: Feedback | null) {
  update(projectId, (project) => ({
    ...project,
    messages: project.messages.map((message) =>
      message.id === messageId && message.role === "assistant" ? { ...message, feedback } : message,
    ),
  }));
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
  update(id, (project) => (project.turn ? { ...project, turn: change(project.turn) } : project));
}

/** Random enough for ids in one browser. Not crypto.randomUUID: that's missing over plain http (a phone on the LAN). */
function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("").slice(0, 12);
}

function stopAll() {
  runs.forEach((run) => run.abort());
  runs.clear();
}

/** Runs one fake answer for a project, replacing any it was already running. */
function run(projectId: string, script: (wait: (ms: number) => Promise<void>) => Promise<void>) {
  runs.get(projectId)?.abort();
  const controller = new AbortController();
  runs.set(projectId, controller);
  const { signal } = controller;

  const wait = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      if (signal.aborted) return reject(signal.reason);
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

  script(wait)
    .catch((error) => {
      if (!signal.aborted) console.error(error);
    })
    .finally(() => {
      if (runs.get(projectId) === controller) runs.delete(projectId);
    });
}

/**
 * Ends the answer: everything it showed is replaced by `text`, with how long it took.
 * After a build, the app is ready to preview.
 */
function finish(projectId: string, text: string) {
  update(projectId, (project) => {
    if (!project.turn) return project;
    const seconds = Math.max(1, Math.floor((Date.now() - project.turn.startedAt) / 1000));
    const message: Message = { id: newId(), role: "assistant", text, seconds, feedback: null };
    const ready = project.turn.kind === "build" || project.ready;
    return { ...project, messages: [...project.messages, message], turn: null, ready };
  });
}

function startTurn(projectId: string, kind: Turn["kind"]) {
  const turn: Turn = { kind, phase: "thinking", startedAt: Date.now(), steps: [], answer: null };
  update(projectId, (project) => ({ ...project, turn }));
}

function answer(projectId: string, text: string) {
  updateTurn(projectId, (turn) => ({
    ...turn,
    phase: "answering",
    steps: [],
    answer: { text, startedAt: Date.now() },
  }));
}

/** The first prompt: think, name the project, build it step by step, then sum up. */
function build(projectId: string, prompt: string) {
  run(projectId, async (wait) => {
    startTurn(projectId, "build");
    await wait(THINK_MS);

    const idea = guessIdea(prompt);
    if (find(projectId)?.name === null) {
      updateTurn(projectId, (turn) => ({ ...turn, phase: "naming" }));
      await wait(NAME_MS);
      // Unless it was renamed in the meantime.
      update(projectId, (project) =>
        project.name === null
          ? { ...project, name: idea.name, icon: idea.icon, color: idea.color, namedAt: Date.now() }
          : project,
      );
      await wait(idea.name.length * NAME_CHAR_MS + 300);
    }

    updateTurn(projectId, (turn) => ({ ...turn, phase: "working" }));
    for (const plan of buildPlan(idea)) {
      const id = newId();
      if (plan.kind === "text") {
        const step: Step = { id, kind: "text", text: plan.text, startedAt: Date.now() };
        updateTurn(projectId, (turn) => ({ ...turn, steps: [...turn.steps, step] }));
        await wait(plan.text.length * CHAR_MS + AFTER_TEXT_MS);
      } else {
        const { ms, ...tool } = plan;
        const step: Step = { ...tool, id, done: false };
        updateTurn(projectId, (turn) => ({ ...turn, steps: [...turn.steps, step] }));
        await wait(ms);
        updateTurn(projectId, (turn) => ({
          ...turn,
          steps: turn.steps.map((s) => (s.id === id ? { ...s, done: true } : s)),
        }));
        await wait(AFTER_TOOL_MS);
      }
    }

    updateTurn(projectId, (turn) => ({ ...turn, phase: "clearing" }));
    await wait(CLEAR_MS);

    const summary = buildSummary(idea);
    answer(projectId, summary);
    await wait(summary.length * CHAR_MS);
    finish(projectId, summary);
  });
}

/** A follow-up: think a moment, then answer. No tools. */
function reply(projectId: string) {
  run(projectId, async (wait) => {
    startTurn(projectId, "reply");
    await wait(REPLY_THINK_MS);
    const answered = find(projectId)?.messages.filter((message) => message.role === "assistant").length ?? 0;
    const text = replyFor(answered);
    answer(projectId, text);
    await wait(text.length * CHAR_MS);
    finish(projectId, text);
  });
}
