import { useSyncExternalStore } from "react";
import { type Attachment, revokeAttachments } from "./attachments";
import { buildIntro, buildPlan, rebuildIntro } from "./mock-build";
import { FOLLOW_UP_REPLIES, firstReply, SEED_PROJECTS } from "./mock-projects";
import { newId } from "./new-id";
import { COLOR_NAMES, ICON_NAMES, type ProjectColor, type ProjectIconName } from "./project-icon";
import { streamDuration, streamedText } from "./stream";

/*
 * The user's projects, mocked in the browser's memory until generating apps is built. Every page
 * load starts again from the demo projects in mock-projects.ts. Timers stand in for the AI: a new
 * project gets its name a moment later, then the AI says what it will build, goes through the steps
 * of building it (mock-build.ts) and, once the app exists, streams in what it made. Later messages
 * get a canned reply. Stop (stopReply) ends the AI's turn wherever it is.
 *
 * The state lives in this module. The server renders only the seeds (the actions below run in event
 * handlers, never there), so pages hydrate without a mismatch.
 */

export type Reaction = "like" | "dislike";

// Something the AI did while building: a web search, a file it created or edited, or a command.
export type BuildAction = {
  id: string;
  kind: "search" | "create" | "edit" | "command";
  // The search, the file's path or the command.
  target: string;
  // The lines a file got.
  lines?: number;
  status: "running" | "done" | "stopped";
};

export type BuildStep = {
  id: string;
  title: string;
  status: "pending" | "running" | "done" | "stopped";
  // What the AI did in this step so far.
  actions: BuildAction[];
};

export type Build = {
  steps: BuildStep[];
  status: "running" | "stopped";
  // When it started (Date.now()).
  startedAt: number;
  // How long it ran before it was stopped, in milliseconds.
  duration?: number;
};

export type Message = {
  id: string;
  role: "user" | "ai";
  // Empty when the user sent only files, and for a build.
  text: string;
  attachments?: Attachment[];
  // How the user rated an AI message.
  reaction?: Reaction;
  // The AI is building the app, or was until the user stopped it: shown as its steps instead of
  // text. A finished build's message is removed, leaving what the AI says about the app.
  build?: Build;
  // When the text started streaming in (Date.now()), until all of it shows (stream.ts).
  streamStart?: number;
  // What the AI says before building: no actions under it, and removed with the steps once the
  // build is done.
  intro?: boolean;
};

export type Project = {
  id: string;
  // Null while the AI is naming the project.
  name: string | null;
  icon: ProjectIconName;
  color: ProjectColor;
  messages: Message[];
  // It's the AI's turn: from the user's message until the AI's reply is all there.
  replying: boolean;
  // The app exists: a build finished.
  built: boolean;
};

// How long the mock AI takes, in milliseconds.
const NAME_DELAY = 2000;
// A new project's whole first build, from the prompt until the AI's summary is all there. Long, to
// try the steps and stopping them; real builds take as long as they take.
const BUILD_MS = 60_000;
// Before the AI says what it will build, before its steps show, and between the build and the summary.
const INTRO_DELAY = 2500;
const STEPS_DELAY = 600;
const SUMMARY_DELAY = 300;
// Between a step starting and its first action, and between actions, relative to the actions'
// weights (mock-build.ts).
const STEP_PAUSE = 1;
const ACTION_PAUSE = 0.5;
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

// What the AI is doing for each project: the timer of its next beat (run). Stopping the AI or
// deleting the project clears it.
const runs = new Map<string, ReturnType<typeof setTimeout>>();

// One thing the AI does. It returns how long until the next one, in milliseconds.
type Beat = () => number | undefined;

// Plays the beats one after another, the first after delay.
function run(id: string, delay: number, beats: Beat[]) {
  cancelRun(id);
  const play = (index: number, wait: number) => {
    const beat = beats[index];
    if (!beat) {
      runs.delete(id);
      return;
    }
    runs.set(
      id,
      setTimeout(() => play(index + 1, beat() ?? 0), wait),
    );
  };
  play(0, delay);
}

function cancelRun(id: string) {
  clearTimeout(runs.get(id));
  runs.delete(id);
}

const projectName = (id: string, fallback: string) =>
  projects.find((project) => project.id === id)?.name ?? fallback;

// Adds an AI message that streams in, and returns how long that takes.
function addStreamed(id: string, text: string, intro?: true) {
  updateProject(id, (project) => ({
    ...project,
    messages: [
      ...project.messages,
      { id: newId(), role: "ai", text, streamStart: Date.now(), intro },
    ],
  }));
  return streamDuration(text);
}

// The messages streaming in show whole, and with done, the AI's turn ends.
function endStream(id: string, done = false) {
  updateProject(id, (project) => ({
    ...project,
    replying: done ? false : project.replying,
    messages: project.messages.map((message) =>
      message.streamStart === undefined ? message : { ...message, streamStart: undefined },
    ),
  }));
}

// Changes the build in progress, if there is one.
function updateBuild(id: string, change: (build: Build) => Build) {
  updateProject(id, (project) => ({
    ...project,
    messages: project.messages.map((message) =>
      message.build?.status === "running" ? { ...message, build: change(message.build) } : message,
    ),
  }));
}

function updateStep(id: string, index: number, change: (step: BuildStep) => BuildStep) {
  updateBuild(id, (build) => ({
    ...build,
    steps: build.steps.map((step, other) => (other === index ? change(step) : step)),
  }));
}

/*
 * The AI builds the app: it says so (intro), goes through the steps, then removes both and says
 * what it made. Everything after the intro is spread so that the summary ends BUILD_MS after the start.
 * name: what the project will be called, while the AI is still naming it.
 */
function startBuild(id: string, intro: (name: string) => string, name: string) {
  const plan = buildPlan(name);
  const introText = intro(name);
  const summaryText = firstReply(name);
  const totalWeight = plan.reduce(
    (sum, step) =>
      sum +
      STEP_PAUSE +
      step.actions.reduce((total, action) => total + action.weight + ACTION_PAUSE, 0),
    0,
  );
  const fixed =
    INTRO_DELAY +
    streamDuration(introText) +
    STEPS_DELAY +
    SUMMARY_DELAY +
    streamDuration(summaryText);
  const unit = Math.max(0, BUILD_MS - fixed) / totalWeight;

  const beats: Beat[] = [
    () => addStreamed(id, intro(projectName(id, name)), true),
    () => {
      endStream(id);
      return STEPS_DELAY;
    },
    () => {
      const build: Build = {
        status: "running",
        startedAt: Date.now(),
        steps: plan.map((step) => ({
          id: newId(),
          title: step.title,
          status: "pending",
          actions: [],
        })),
      };
      updateProject(id, (project) => ({
        ...project,
        messages: [...project.messages, { id: newId(), role: "ai", text: "", build }],
      }));
      return 0;
    },
  ];
  plan.forEach((step, index) => {
    beats.push(() => {
      updateStep(id, index, (current) => ({ ...current, status: "running" }));
      return unit * STEP_PAUSE;
    });
    for (const { weight, ...action } of step.actions) {
      beats.push(() => {
        updateStep(id, index, (current) => ({
          ...current,
          actions: [...current.actions, { ...action, id: newId(), status: "running" }],
        }));
        return unit * weight;
      });
      beats.push(() => {
        updateStep(id, index, (current) => ({
          ...current,
          actions: current.actions.map((other) =>
            other.status === "running" ? { ...other, status: "done" } : other,
          ),
        }));
        return unit * ACTION_PAUSE;
      });
    }
    beats.push(() => {
      updateStep(id, index, (current) => ({ ...current, status: "done" }));
      return 0;
    });
  });
  beats.push(
    () => {
      updateProject(id, (project) => ({
        ...project,
        built: true,
        // The intros and steps, also those of a build the user stopped before, leaving the summary.
        messages: project.messages.filter((message) => !message.build && !message.intro),
      }));
      return SUMMARY_DELAY;
    },
    () => addStreamed(id, firstReply(projectName(id, name))),
    () => {
      endStream(id, true);
      return 0;
    },
  );
  run(id, INTRO_DELAY, beats);
}

// Starts a project from the prompt and returns its id. The AI names it and builds it (startBuild).
export function createProject(prompt: string, attachments: Attachment[] = []) {
  const id = newId();
  setProjects([
    {
      id,
      name: null,
      icon: pick(ICON_NAMES),
      color: pick(COLOR_NAMES),
      messages: [{ id: newId(), role: "user", text: prompt, attachments }],
      replying: true,
      built: false,
    },
    ...projects,
  ]);
  const name = nameFromPrompt(prompt);
  // Unless the user named it first. Stopping the AI doesn't stop this.
  setTimeout(
    () => updateProject(id, (project) => (project.name ? project : { ...project, name })),
    NAME_DELAY,
  );
  startBuild(id, buildIntro, name);
  return id;
}

// Without an app yet (the user stopped its build), the AI builds it again. Otherwise, a canned reply.
export function sendMessage(id: string, text: string, attachments: Attachment[] = []) {
  const project = projects.find((other) => other.id === id);
  if (!project) return;
  updateProject(id, (current) => ({
    ...current,
    replying: true,
    messages: [...current.messages, { id: newId(), role: "user", text, attachments }],
  }));
  if (!project.built) {
    startBuild(id, rebuildIntro, project.name ?? "Untitled project");
    return;
  }
  const reply = FOLLOW_UP_REPLIES[followUps++ % FOLLOW_UP_REPLIES.length] ?? "";
  run(id, REPLY_DELAY, [
    () => addStreamed(id, reply),
    () => {
      endStream(id, true);
      return 0;
    },
  ]);
}

/*
 * Ends the AI's turn where it is: text streaming in keeps the words shown so far, and a build stays
 * as far as it got, its step and action in progress marked as stopped.
 */
export function stopReply(id: string) {
  cancelRun(id);
  const now = Date.now();
  updateProject(id, (project) => ({
    ...project,
    replying: false,
    messages: project.messages.flatMap((message): Message[] => {
      if (message.streamStart !== undefined) {
        const text = streamedText(message.text, now - message.streamStart);
        return text ? [{ ...message, text, streamStart: undefined }] : [];
      }
      if (message.build?.status === "running") {
        const build = message.build;
        return [
          {
            ...message,
            build: {
              ...build,
              status: "stopped",
              duration: now - build.startedAt,
              steps: build.steps.map((step) =>
                step.status === "running"
                  ? {
                      ...step,
                      status: "stopped",
                      actions: step.actions.map((action) =>
                        action.status === "running" ? { ...action, status: "stopped" } : action,
                      ),
                    }
                  : step,
              ),
            },
          },
        ];
      }
      return [message];
    }),
  }));
}

export function renameProject(id: string, name: string) {
  updateProject(id, (project) => ({ ...project, name }));
}

export function restyleProject(id: string, icon: ProjectIconName, color: ProjectColor) {
  updateProject(id, (project) => ({ ...project, icon, color }));
}

export function deleteProject(id: string) {
  cancelRun(id);
  const project = projects.find((project) => project.id === id);
  for (const message of project?.messages ?? []) revokeAttachments(message.attachments ?? []);
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
