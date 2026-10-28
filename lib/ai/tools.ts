import "server-only";
import { stat } from "node:fs/promises";
import path from "node:path";
import type { FunctionTool, ResponseFunctionToolCall, Tool } from "openai/resources/responses/responses";
import { newId } from "@/lib/projects/ids";
import type { StepData, ToolStep } from "@/lib/projects/types";
import { deletePath, editText, FileError, listFiles, readText, writeText } from "@/lib/sandbox/files";
import { runCommand } from "@/lib/sandbox/run";

// The tools the AI can use. Each shows as a line in the chat while it runs
// ("Editing src/App.tsx") and after ("Edited src/App.tsx +12 −3").

const COMMAND_MS = 5 * 60_000;

/** Strict function tools: every property required, nothing else allowed. */
function tool(name: string, description: string, properties: Record<string, { type: "string"; description: string }>): FunctionTool {
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
  { type: "web_search" },
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
    "Runs a shell command in the project's folder, like `npm install lucide-react` or `npm run build`, and returns its exit code and output. Times out after 5 minutes.",
    { command: { type: "string", description: "The command." } },
  ),
];

type Context = {
  projectId: string;
  dir: string;
  signal: AbortSignal;
  emitStep: (step: StepData) => void;
  finishStep: (step: ToolStep) => void;
};

/** Runs a function call, showing it in the chat. Returns what the AI gets back. */
export async function callTool(call: ResponseFunctionToolCall, context: Context): Promise<string> {
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
    default:
      return null;
  }
}

async function run(
  name: string,
  args: Record<string, string>,
  file: string,
  { projectId, dir, signal }: Context,
): Promise<{ output: string } & Partial<ToolStep>> {
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
