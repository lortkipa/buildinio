import type { Message, Project } from "./projects";

/*
 * Searching the user's projects by name and by what was said in their chats. Runs in the browser
 * over the mocked projects (projects.ts) for now; once projects live in the API, it searches there.
 */

// Where the match is in a text: its start and end, as string indexes.
export type Range = [start: number, end: number];

export type SearchResult = {
  project: Project;
  // When only a message matches: the first one, cut to start shortly before the match.
  snippet?: { role: Message["role"]; text: string; match: Range };
};

// How much of a message shows before the match, in characters, give or take a word.
const SNIPPET_LEAD = 20;

/*
 * The text in lower case and without accents, so "cafe" finds "Café". A character can fold to more or
 * fewer characters, so for each folded one this keeps where its character is in the original text.
 */
function fold(text: string) {
  let folded = "";
  const starts: number[] = [];
  const ends: number[] = [];
  let index = 0;
  for (const char of text) {
    const part = char.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
    for (let i = 0; i < part.length; i++) {
      starts.push(index);
      ends.push(index + char.length);
    }
    folded += part;
    index += char.length;
  }
  return { folded, starts, ends };
}

// Where the folded query first shows up in the text, in the text's own indexes.
function find(text: string, query: string): Range | undefined {
  const { folded, starts, ends } = fold(text);
  const at = folded.indexOf(query);
  if (at === -1) return undefined;
  return [starts[at] ?? 0, ends[at + query.length - 1] ?? text.length];
}

// The message on one line, starting at a word shortly before the match, with an ellipsis if cut.
function snippet(message: Message, query: string): SearchResult["snippet"] {
  const text = message.text.replace(/\s+/g, " ").trim();
  const match = find(text, query);
  if (!match) return undefined;
  let start = 0;
  if (match[0] > SNIPPET_LEAD) {
    const space = text.indexOf(" ", match[0] - SNIPPET_LEAD);
    start = space !== -1 && space < match[0] ? space + 1 : match[0];
  }
  const cut = start > 0 ? "…" : "";
  const shift = cut.length - start;
  return {
    role: message.role,
    text: cut + text.slice(start),
    match: [match[0] + shift, match[1] + shift],
  };
}

/*
 * The projects matching the query, newest first: those whose name matches, then those where only a
 * message does. Without a query, all of them.
 */
export function searchProjects(projects: Project[], query: string): SearchResult[] {
  const folded = fold(query.trim().replace(/\s+/g, " ")).folded;
  if (!folded) return projects.map((project) => ({ project }));

  const byName: SearchResult[] = [];
  const byMessage: SearchResult[] = [];
  for (const project of projects) {
    if (project.name && find(project.name, folded)) {
      byName.push({ project });
      continue;
    }
    for (const message of project.messages) {
      const found = snippet(message, folded);
      if (found) {
        byMessage.push({ project, snippet: found });
        break;
      }
    }
  }
  return [...byName, ...byMessage];
}
