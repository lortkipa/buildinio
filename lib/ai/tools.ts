import "server-only";
import { stat } from "node:fs/promises";
import path from "node:path";
import type {
  FunctionTool,
  ResponseFunctionCallOutputItemList,
  ResponseFunctionToolCall,
  Tool,
} from "openai/resources/responses/responses";
import { readSkill, SKILLS } from "@/lib/ai/skills";
import { newId } from "@/lib/projects/ids";
import type { StepData, ToolStep } from "@/lib/projects/types";
import { deletePath, editText, FileError, listFiles, readText, writeText } from "@/lib/sandbox/files";
import { lookAtApp } from "@/lib/sandbox/look";
import { runCommand } from "@/lib/sandbox/run";

// The tools the AI can use. Each shows as a line in the chat while it runs
// ("Editing src/App.tsx") and after ("Edited src/App.tsx +12 −3").

const COMMAND_MS = 5 * 60_000;
const SKILL_COMMAND_MS = 2 * 60_000; // A skill's own command, like shadcn's `info`.
const MAX_LOOKS = 2; // Screenshots in one answer.

type Property = { type: "string"; description: string; enum?: string[] };

/** Strict function tools: every property required, nothing else allowed. */
function tool(name: string, description: string, properties: Record<string, Property>): FunctionTool {
  return {
    type: "function",
    name,
    description,
    strict: true,
    parameters: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
  };
}

const PATH = { type: "string", description: "Relative to the project, like src/App.tsx." } as const;

export const TOOLS: Tool[] = [
  { type: "web_search", search_context_size: "low" }, // Less of each page to pay for: it searches for facts.
  tool("list_files", "Lists the project's files with their sizes (node_modules and dist left out).", {}),
  tool("read_file", "Reads a file.", { path: PATH }),
  tool("write_file", "Creates a file, or replaces all of it. Folders are made as needed.", {
    path: PATH,
    content: { type: "string", description: "The whole file." },
  }),
  tool("edit_file", "Replaces one piece of a file. old_text must appear in the file exactly once.", {
    path: PATH,
    old_text: { type: "string", description: "The exact text to replace, with enough lines around it to be unique." },
    new_text: { type: "string", description: "What goes in its place." },
  }),
  tool("delete_file", "Deletes a file or a folder.", { path: PATH }),
  tool(
    "run_command",
    "Runs a shell command in the project's folder, like `npm install react-router`, and returns its exit code and output. Times out after 5 minutes.",
    { command: { type: "string", description: "The command." } },
  ),
  tool(
    "look_at_app",
    "Builds the app if it changed, then shows you screenshots of it on a phone (390 px wide) and a desktop (1280 px), up to two screens tall, with any errors in its console and any images or files that didn't load.",
    { page: { type: "string", description: "Which page: empty for the start page, or a hash route like #/settings." } },
  ),
  ...(SKILLS.length
    ? [
        tool(
          "load_skill",
          "Reads one of the skills in your instructions: its SKILL.md, or another of its files. Where a skill links to one of its files online, this reads the copy that comes with it.",
          {
            name: { type: "string", description: "The skill.", enum: SKILLS.map((skill) => skill.name) },
            file: { type: "string", description: "Another of its files, like command.md. Empty for SKILL.md." },
          },
        ),
      ]
    : []),
];

type Context = {
  projectId: string;
  dir: string;
  signal: AbortSignal;
  emitStep: (step: StepData) => void;
  finishStep: (step: ToolStep) => void;
  build: () => Promise<{ ok: boolean; output: string } | null>; // Builds the app if it changed (agent.ts).
  turn: { looks: number }; // This answer so far.
};

type Output = string | ResponseFunctionCallOutputItemList; // Text, or text and pictures.

/** Runs a function call, showing it in the chat. Returns what the AI gets back. */
export async function callTool(call: ResponseFunctionToolCall, context: Context): Promise<Output> {
  let args: Record<string, string>;
  try {
    args = JSON.parse(call.arguments);
  } catch {
    return "Error: the arguments weren't valid JSON.";
  }
  const file = typeof args.path === "string" ? args.path.trim() : "";
  const step = await stepFor(call.name, args, file, context.dir);
  if (!step) return `Error: there's no tool called ${call.name}.`;
  context.emitStep(step);

  try {
    const { output, ...changes } = await run(call.name, args, file, context);
    context.finishStep({ ...step, ...changes, done: true });
    return output;
  } catch (error) {
    if (!(error instanceof FileError)) throw error;
    context.finishStep({ ...step, done: true, failed: true });
    return `Error: ${error.message}`;
  }
}

/** Builds the app if it changed, then the screenshots, for the AI to look at. */
async function look(projectId: string, page: string, signal: AbortSignal, build: Context["build"], turn: Context["turn"]) {
  if (turn.looks >= MAX_LOOKS) throw new FileError(`You've looked ${MAX_LOOKS} times in this answer: that's all for now.`);
  turn.looks++;
  const built = await build();
  if (built && !built.ok) {
    return { output: `The app didn't build, so there's nothing to look at yet. Fix it first:\n\n${built.output}`, failed: true };
  }
  const shots = await lookAtApp(projectId, page, signal);
  if (!shots.ok) return { output: shots.reason, failed: true };

  const list = (items: string[]) => (items.length ? items.map((item) => `\n- ${item}`).join("") : " none");
  const output: ResponseFunctionCallOutputItemList = [
    {
      type: "input_text",
      text: `Your app (${page || "start page"}) on a phone, then on a desktop.\nErrors in its console:${list(shots.errors)}\nImages and files that didn't load:${list(shots.broken)}`,
    },
    { type: "input_image", image_url: `data:image/png;base64,${shots.phone}`, detail: "high" },
    { type: "input_image", image_url: `data:image/png;base64,${shots.desktop}`, detail: "high" },
  ];
  return { output };
}

/** The line in the chat for a tool, before it runs. */
async function stepFor(name: string, args: Record<string, string>, file: string, dir: string): Promise<ToolStep | null> {
  const id = newId();
  const base = { id, kind: "tool", done: false } as const;
  switch (name) {
    case "list_files":
      return { ...base, tool: "read", label: "Looking at the files", doneLabel: "Looked at the files" };
    case "read_file":
      return { ...base, tool: "read", label: `Reading ${file}`, doneLabel: `Read ${file}` };
    case "write_file": {
      const exists = await stat(path.join(dir, file)).then(() => true, () => false);
      return exists
        ? { ...base, tool: "edit", label: `Editing ${file}`, doneLabel: `Edited ${file}` }
        : { ...base, tool: "create", label: `Creating ${file}`, doneLabel: `Created ${file}` };
    }
    case "edit_file":
      return { ...base, tool: "edit", label: `Editing ${file}`, doneLabel: `Edited ${file}` };
    case "delete_file":
      return { ...base, tool: "delete", label: `Deleting ${file}`, doneLabel: `Deleted ${file}` };
    case "run_command": {
      const command = String(args.command ?? "").trim();
      return { ...base, tool: "run", label: `Running ${command}`, doneLabel: `Ran ${command}` };
    }
    case "load_skill": {
      const topic = String(args.name ?? "").replace(/[-_]+/g, " ").trim() || "a skill"; // "frontend design"
      return { ...base, tool: "skill", label: `Reading up on ${topic}`, doneLabel: `Read up on ${topic}` };
    }
    case "look_at_app":
      return { ...base, tool: "look", label: "Looking at your app", doneLabel: "Looked at your app" };
    default:
      return null;
  }
}

async function run(
  name: string,
  args: Record<string, string>,
  file: string,
  { projectId, dir, signal, build, turn }: Context,
): Promise<{ output: Output } & Partial<ToolStep>> {
  switch (name) {
    case "list_files": {
      const files = await listFiles(dir);
      return { output: files.map((info) => `${info.path} (${info.size} bytes)`).join("\n") || "(no files)" };
    }
    case "read_file":
      return { output: await readText(dir, file) };
    case "write_file": {
      const { added, removed } = await writeText(dir, file, String(args.content ?? ""));
      return { output: "Done.", added, removed };
    }
    case "edit_file": {
      const { added, removed } = await editText(dir, file, String(args.old_text ?? ""), String(args.new_text ?? ""));
      return { output: "Done.", added, removed };
    }
    case "delete_file": {
      const { removed } = await deletePath(dir, file);
      return { output: "Done.", added: 0, removed };
    }
    case "load_skill": {
      const output = await readSkill(String(args.name ?? ""), String(args.file ?? ""), async (command) => {
        const result = await runCommand(projectId, command, { signal, timeoutMs: SKILL_COMMAND_MS });
        return result.exitCode === 0 ? result.output.trim() : `(\`${command}\` didn't work: ${result.output.trim()})`;
      });
      return { output };
    }
    case "look_at_app":
      return look(projectId, String(args.page ?? "").trim(), signal, build, turn);
    default: {
      const command = String(args.command ?? "").trim();
      if (!command) throw new FileError("The command is empty.");
      const result = await runCommand(projectId, command, { signal, timeoutMs: COMMAND_MS });
      const failed = result.exitCode !== 0;
      return {
        output: `${result.timedOut ? "Stopped: it took more than 5 minutes.\n" : ""}Exit code ${result.exitCode}\n${result.output}`,
        failed: failed || undefined,
        detail: result.timedOut ? "Took too long" : failed ? "Failed" : undefined,
      };
    }
  }
}
