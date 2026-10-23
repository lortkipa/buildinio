import { useSyncExternalStore } from "react";
import { FOLLOW_UP_REPLIES, firstReply, SEED_PROJECTS } from "./mock-projects";
import { COLOR_NAMES, ICON_NAMES, type ProjectColor, type ProjectIconName } from "./project-icon";

/*
 * The user's projects, mocked in the browser's memory until generating apps is built. Every page
 * load starts again from the demo projects in mock-projects.ts. Timers stand in for the AI: a new
 * project gets its name, and each message its reply, a moment later.
 *
 * The state lives in this module. The server renders only the seeds (the actions below run in event
 * handlers, never there), so pages hydrate without a mismatch.
 */

export type Reaction = "like" | "dislike";

export type Message = {
  id: string;
  role: "user" | "ai";
  text: string;
  // How the user rated an AI message.
  reaction?: Reaction;
};

export type Project = {
  id: string;
  // Null while the AI is naming the project.
  name: string | null;
  icon: ProjectIconName;
  color: ProjectColor;
  messages: Message[];
  // The AI is writing a reply.
  replying: boolean;
};

// How long the mock AI takes, in milliseconds.
const NAME_DELAY = 2000;
const FIRST_REPLY_DELAY = 3500;
const REPLY_DELAY = 2000;

let projects = SEED_PROJECTS;
let followUps = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setProjects(next: Project[]) {
  projects = next;
  for (const listener of listeners) listener();
}

// Does nothing for a deleted project, e.g. when a timer fires after the user deleted it.
function updateProject(id: string, change: (project: Project) => Project) {
  if (!projects.some((project) => project.id === id)) return;
  setProjects(projects.map((project) => (project.id === id ? change(project) : project)));
}

// All projects, newest first.
export function useProjects() {
  return useSyncExternalStore(
    subscribe,
    () => projects,
    () => SEED_PROJECTS,
  );
}

// The project, or undefined when there's none with this id.
export function useProject(id: string | undefined) {
  return useProjects().find((project) => project.id === id);
}

/*
 * A short random id. Not crypto.randomUUID: browsers have it only on secure origins, and the dev
 * server is also opened over plain http from phones on the local network.
 */
function newId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(10)), (byte) =>
    (byte % 36).toString(36),
  ).join("");
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)] as T;
}

const LEADING_REQUEST =
  /^(please\s+)?(build|make|create|design|i want|i need|i’d like|give me)\b\s*(me\s+)?/i;
const LEADING_ARTICLE = /^(a|an|the|my)\s+/i;
// A name ends before the first of these, e.g. "A habit tracker with daily streaks" → "Habit Tracker".
const NAME_ENDS_AT = new Set([
  "with",
  "for",
  "that",
  "which",
  "where",
  "who",
  "to",
  "so",
  "and",
  "using",
  "in",
  "on",
  "of",
  "from",
  "by",
  "like",
]);
const MAX_NAME_WORDS = 4;

// What the mock AI names a project: the start of its prompt, in title case.
export function nameFromPrompt(prompt: string) {
  const words = prompt
    .trim()
    .replace(/'/g, "’")
    .replace(LEADING_REQUEST, "")
    .replace(LEADING_ARTICLE, "")
    .split(/\s+/);
  const name: string[] = [];
  for (const word of words) {
    const clean = word.replace(/[^\p{L}\p{N}’-]/gu, "");
    if (name.length === MAX_NAME_WORDS || NAME_ENDS_AT.has(clean.toLowerCase())) break;
    if (clean) name.push(clean.charAt(0).toUpperCase() + clean.slice(1));
    // A sentence ends here.
    if (/[.,;:!?]$/.test(word)) break;
  }
  return name.join(" ") || "Untitled project";
}

function addReply(id: string, text: (project: Project) => string) {
  updateProject(id, (project) => ({
    ...project,
    replying: false,
    messages: [...project.messages, { id: newId(), role: "ai", text: text(project) }],
  }));
}

// Starts a project from the prompt and returns its id. The AI names it and replies shortly after.
export function createProject(prompt: string) {
  const id = newId();
  setProjects([
    {
      id,
      name: null,
      icon: pick(ICON_NAMES),
      color: pick(COLOR_NAMES),
      messages: [{ id: newId(), role: "user", text: prompt }],
      replying: true,
    },
    ...projects,
  ]);
  const name = nameFromPrompt(prompt);
  // Unless the user named it first.
  setTimeout(
    () => updateProject(id, (project) => (project.name ? project : { ...project, name })),
    NAME_DELAY,
  );
  setTimeout(() => addReply(id, (project) => firstReply(project.name ?? name)), FIRST_REPLY_DELAY);
  return id;
}

export function sendMessage(id: string, text: string) {
  updateProject(id, (project) => ({
    ...project,
    replying: true,
    messages: [...project.messages, { id: newId(), role: "user", text }],
  }));
  const reply = FOLLOW_UP_REPLIES[followUps++ % FOLLOW_UP_REPLIES.length] ?? "";
  setTimeout(() => addReply(id, () => reply), REPLY_DELAY);
}

export function renameProject(id: string, name: string) {
  updateProject(id, (project) => ({ ...project, name }));
}

export function restyleProject(id: string, icon: ProjectIconName, color: ProjectColor) {
  updateProject(id, (project) => ({ ...project, icon, color }));
}

export function deleteProject(id: string) {
  setProjects(projects.filter((project) => project.id !== id));
}

// Rates an AI message, or clears the rating with undefined.
export function setReaction(projectId: string, messageId: string, reaction: Reaction | undefined) {
  updateProject(projectId, (project) => ({
    ...project,
    messages: project.messages.map((message) =>
      message.id === messageId ? { ...message, reaction } : message,
    ),
  }));
}
