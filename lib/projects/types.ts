import type { ProjectColor, ProjectIcon } from "@/lib/projects/options";

export type Feedback = "like" | "dislike";

export type Message =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; text: string; seconds: number; feedback: Feedback | null };

export type Tool = "search" | "read" | "create" | "edit" | "run";

/** A line of what the AI is doing while it builds: something it says, or a tool it uses. */
export type Step =
  | { id: string; kind: "text"; text: string; startedAt: number }
  | {
      id: string;
      kind: "tool";
      tool: Tool;
      label: string; // While it runs, like "Searching the web".
      doneLabel: string; // Once it's done, like "Searched the web".
      detail?: string; // Like the search query or "All passed".
      added?: number; // Lines added and removed, for files.
      removed?: number;
      done: boolean;
    };

/** The answer being worked on. Lives in memory only; a finished one becomes a message. */
export type Turn = {
  kind: "build" | "reply"; // The first prompt builds the app; later ones just get an answer.
  phase: "thinking" | "naming" | "working" | "clearing" | "answering";
  startedAt: number;
  steps: Step[];
  answer: { text: string; startedAt: number } | null;
};

export type Project = {
  id: string;
  name: string | null; // Null until the AI names it.
  namedAt?: number; // When the AI named it, so the name types itself out.
  icon: ProjectIcon;
  color: ProjectColor;
  createdAt: number;
  messages: Message[];
  turn: Turn | null;
};
