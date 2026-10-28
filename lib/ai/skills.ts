import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import type { Dirent } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { FileError } from "@/lib/sandbox/files";

// Skills: well-known guides the AI reads when a request needs one (see skills/README.md).
// Its instructions list each one's name and description, and load_skill reads the rest,
// so a skill only costs tokens in the answers that use it. Read once, at start.

// The ignore comment stops the bundler from tracing the whole project because of this path.
const ROOT = path.join(/* turbopackIgnore: true */ process.cwd(), "skills");
const TEXT = /\.(md|txt|json|ya?ml|[cm]?js|jsx|tsx?|css|html)$/i; // Files the AI can read; not pictures.
// A command whose output goes in its place when SKILL.md is read, like shadcn's
// !`npx shadcn@latest info --json` (the same syntax as Claude Code's skills).
const COMMAND = /(?<=^|\s)!`([^`\n]+)`/gm;

/** Runs a skill's command in the project and returns what it printed. */
type Run = (command: string) => Promise<string>;

type Skill = {
  name: string;
  description: string;
  dir: string;
  body: string; // SKILL.md without its frontmatter.
  files: string[]; // The skill's other text files, like "command.md". Licenses left out.
};

export const SKILLS: Skill[] = readSkills();

/** The skills, a line each, for the AI's instructions. */
export function skillList() {
  return SKILLS.map((skill) => `- ${skill.name}: ${skill.description}`).join("\n");
}

/** A skill's SKILL.md (its commands run), followed by its other files' names, or one of those files. */
export async function readSkill(name: string, file: string, run: Run) {
  const skill = SKILLS.find((candidate) => candidate.name === name);
  if (!skill) throw new FileError(`There's no skill called ${name}.`);
  const wanted = file.trim().replace(/^(\.\/)+/, "");
  if (!wanted || wanted === "SKILL.md") {
    const body = await withCommands(skill.body, run);
    return skill.files.length ? `${body}\n\n---\nThis skill's other files: ${skill.files.join(", ")}` : body;
  }
  if (!skill.files.includes(wanted)) {
    throw new FileError(`${skill.name} has no file called ${wanted}. Its files: ${skill.files.join(", ") || "just SKILL.md"}.`);
  }
  return readFile(path.join(skill.dir, ...wanted.split("/")), "utf8");
}

async function withCommands(text: string, run: Run) {
  let result = "";
  let last = 0;
  for (const match of text.matchAll(COMMAND)) {
    result += text.slice(last, match.index) + (await run(match[1]));
    last = match.index + match[0].length;
  }
  return result + text.slice(last);
}

function readSkills(): Skill[] {
  const skills: Skill[] = [];
  let entries: Dirent[];
  try {
    entries = readdirSync(ROOT, { withFileTypes: true, encoding: "utf8" });
  } catch {
    return skills; // No skills folder: the AI works without.
  }
  for (const folder of entries.filter((entry) => entry.isDirectory())) {
    const dir = path.join(ROOT, folder.name);
    let text: string;
    try {
      text = readFileSync(path.join(dir, "SKILL.md"), "utf8");
    } catch {
      continue;
    }
    const { meta, body } = frontmatter(text);
    if (!meta.name || !meta.description) continue;
    const files = readdirSync(dir, { recursive: true, withFileTypes: true, encoding: "utf8" })
      .filter((entry) => entry.isFile())
      .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
      .filter((file) => file !== "SKILL.md" && TEXT.test(file) && !/^licen[cs]e/i.test(path.basename(file)))
      .sort();
    skills.push({ name: meta.name, description: meta.description, dir, body: body.trim(), files });
  }
  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * The `key: value` lines between the --- lines at the top. Enough YAML for skills:
 * indented lines carry on the value before them (nested keys end up there too).
 */
function frontmatter(text: string) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/.exec(text);
  if (!match) return { meta: {} as Record<string, string>, body: text };
  const meta: Record<string, string> = {};
  let key = "";
  for (const line of match[1].split(/\r?\n/)) {
    const pair = /^([\w-]+):\s*(.*)$/.exec(line);
    if (pair) {
      key = pair[1];
      meta[key] = /^[>|][+-]?$/.test(pair[2]) ? "" : pair[2]; // A block (> or |) starts on the next line.
    } else if (key && /^\s/.test(line)) {
      meta[key] = `${meta[key]} ${line.trim()}`.trim();
    }
  }
  for (const [name, value] of Object.entries(meta)) meta[name] = value.replace(/^(["'])(.*)\1$/, "$2");
  return { meta, body: text.slice(match[0].length) };
}
