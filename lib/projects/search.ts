import type { Message, Project } from "@/lib/projects/types";

// Searching the user's projects (SearchDialog), in the browser: the store already has
// every project with its chat. A project matches when its name has every word searched
// for, or one of its messages does.

const BEFORE = 20; // Letters kept before the first match in a snippet, so it shows on a phone too.
const LENGTH = 160; // Letters in a snippet; what doesn't fit fades out.

/** A project found, newest first; ones found by name come before ones found in their chat. */
export type SearchResult = {
  project: Project;
  snippet: string | null; // Where the chat matched, when the name didn't.
};

/** The words in a query, in lowercase. */
export function searchWords(query: string) {
  return [...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))];
}

/** Finds any of the words, ignoring case. Longest first, so "app" doesn't cut "apple" short. */
export function wordPattern(words: string[]) {
  const escaped = [...words].sort((a, b) => b.length - a.length).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`(${escaped.join("|")})`, "giu");
}

/** Every project with no words; otherwise the ones that match. */
export function searchProjects(projects: Project[], words: string[]): SearchResult[] {
  if (words.length === 0) return projects.map((project) => ({ project, snippet: null }));
  const byName: SearchResult[] = [];
  const byChat: SearchResult[] = [];
  for (const project of projects) {
    if (project.name && hasAll(project.name, words)) {
      byName.push({ project, snippet: null });
      continue;
    }
    const message = project.messages.findLast((m) => hasAll(plainText(m), words));
    if (message) byChat.push({ project, snippet: snippet(plainText(message), words) });
  }
  return [...byName, ...byChat];
}

function hasAll(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.every((word) => lower.includes(word));
}

/** A bit of the text from just before the first match. */
function snippet(text: string, words: string[]) {
  const first = wordPattern(words).exec(text)?.index ?? 0;
  if (first <= BEFORE) return text.slice(0, LENGTH);
  // From the start of a word.
  const space = text.indexOf(" ", first - BEFORE);
  const start = space !== -1 && space < first ? space + 1 : first - BEFORE;
  return `…${text.slice(start, start + LENGTH)}`;
}

const plain = new WeakMap<Message, string>(); // Messages don't change: each is worked out once.

/** A message as one line of text. Answers lose their Markdown. */
function plainText(message: Message) {
  let text = plain.get(message);
  if (text === undefined) {
    text = (message.role === "assistant" ? stripMarkdown(message.text) : message.text).replace(/\s+/g, " ").trim();
    plain.set(message, text);
  }
  return text;
}

function stripMarkdown(text: string) {
  return text
    .replace(/^[ \t]*(```|~~~).*$/gm, "") // Code fences.
    .replace(/^[ \t|:-]*-[ \t|:-]*$/gm, "") // Rules, and the line under a table's header.
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1") // Links and images: their text.
    .replace(/^[ \t]*(#{1,6}|>+|[-*+]([ \t]+\[[ xX]\])?)[ \t]+/gm, "") // Headings, quotes, bullets and task boxes.
    .replace(/\*\*|__|~~|[*`]/g, "")
    .replace(/\|/g, " "); // Table cells.
}
