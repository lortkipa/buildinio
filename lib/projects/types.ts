import type { ProjectColor, ProjectIcon } from "@/lib/projects/options";

export type Feedback = "like" | "dislike";

/** Who can open the app's share link (/share/<id>): only its owner, or anyone with the link. */
export type Visibility = "private" | "public";

export type AssistantMessage = { id: string; role: "assistant"; text: string; seconds: number; feedback: Feedback | null };

export type Message = { id: string; role: "user"; text: string } | AssistantMessage;

export type Tool = "search" | "read" | "create" | "edit" | "delete" | "run" | "skill" | "look" | "project";

export type ProjectChanges = Partial<{ name: string; icon: ProjectIcon; color: ProjectColor }>;

type TextStep = { id: string; kind: "text"; text: string; startedAt: number };

export type ToolStep = {
  id: string;
  kind: "tool";
  tool: Tool;
  label: string; // While it runs, like "Searching the web".
  doneLabel: string; // Once it's done, like "Searched the web".
  detail?: string; // Like the search query or "Failed".
  added?: number; // Lines added and removed, for files.
  removed?: number;
  done: boolean;
  failed?: boolean; // Done, but it didn't work (the AI is told why).
};

/** A line of what the AI is doing while it works: something it says, or a tool it uses. */
export type Step = TextStep | ToolStep;

/** A step as the server sends it. The browser times text itself (see `startedAt`). */
export type StepData = Omit<TextStep, "startedAt"> | ToolStep;

/** The answer being worked on. Lives in memory only; a finished one becomes a message. */
export type Turn = {
  phase: "thinking" | "working" | "clearing" | "answering";
  startedAt: number;
  steps: Step[];
  answer: { text: string; startedAt: number } | null;
};

/** A project as the server keeps it. */
export type ProjectData = {
  id: string;
  name: string | null; // Null until the AI names it.
  icon: ProjectIcon;
  color: ProjectColor;
  createdAt: number;
  messages: Message[];
  ready: boolean; // The AI just built the app and its preview hasn't been seen yet.
  appVersion: number; // Goes up with every build of the app; 0 until there is one.
  visibility: Visibility;
  running: boolean; // The AI is working on an answer.
};

export type Project = Omit<ProjectData, "running"> & {
  namedAt?: number; // When the AI named it, so the name types itself out.
  turn: Turn | null;
};

/** What the server streams while the AI answers, one JSON object per line. */
export type TurnEvent =
  | { type: "snapshot"; elapsedMs: number; steps: StepData[]; changes?: ProjectChanges } // Joining an answer that's under way.
  | { type: "named"; name: string; icon: ProjectIcon; color: ProjectColor }
  | { type: "project_updated"; changes: ProjectChanges }
  | { type: "step"; step: StepData }
  | { type: "text"; id: string; delta: string } // More of a text step.
  | { type: "tool"; step: ToolStep } // A tool finished.
  | { type: "done"; message: AssistantMessage; appVersion: number; ready: boolean };
