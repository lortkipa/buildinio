import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import OpenAI from "openai";
import type {
  ResponseFunctionToolCall,
  ResponseFunctionWebSearch,
  ResponseInputItem,
  ResponseUsage,
} from "openai/resources/responses/responses";
import { withAttachments } from "@/lib/ai/attachments";
import { aiConfig, SETUP_MESSAGE } from "@/lib/ai/client";
import { INSTRUCTIONS, projectState } from "@/lib/ai/instructions";
import { callTool, TOOLS } from "@/lib/ai/tools";
import { newId } from "@/lib/projects/ids";
import { parseQuestions, questionsForAI } from "@/lib/projects/questions";
import type { Message, ProjectChanges, ProjectData, Question, StepData, ToolStep, TurnEvent } from "@/lib/projects/types";
import { buildApp } from "@/lib/sandbox/build";
import { fingerprint, listFiles } from "@/lib/sandbox/files";
import { SandboxError } from "@/lib/sandbox/run";
import { ensureWorkspace, projectDir } from "@/lib/sandbox/workspace";

// One answer from the AI: it talks, uses tools (files, commands, web search) for as
// long as it needs, and once it's done, the app is built if anything changed.

const MAX_CALLS = 60; // Requests to the model in one answer.
const MAX_FIXES = 2; // Times a failed build goes back to the AI to fix.
const MAX_HISTORY = 50; // Earlier messages it sees, at most.
const HISTORY_STEP = 20; // Over that, the oldest go this many at a time (see `historyStart`).
const BUILT = path.join("dist", ".buildinio-source"); // The source files' fingerprint at the last good build.
const UPDATED = "Your app is updated. Take a look at the preview.";
const ASKING = "A few quick questions first:";

type TurnInput = {
  projectId: string;
  name: ProjectData["name"];
  icon: ProjectData["icon"];
  color: ProjectData["color"];
  messages: Message[]; // The chat so far, ending with the prompt to answer.
  files: Map<string, string>; // Where each attached file is in the project, by id (lib/sandbox/attachments.ts).
  hasApp: boolean; // There's a build from before.
  signal: AbortSignal;
  emit: (event: TurnEvent) => void;
  changeProject: (changes: ProjectChanges) => Promise<boolean>;
};

/** The answer, whether the app was built anew, and the questions it ends with, if any. */
type TurnResult = { text: string; built: boolean; questions?: Question[] };

/** Answers the last prompt. */
export async function runTurn({
  projectId,
  name,
  icon,
  color,
  messages,
  files,
  hasApp,
  signal,
  emit,
  changeProject,
}: TurnInput): Promise<TurnResult> {
  const ai = aiConfig();
  if (!ai) {
    console.warn(`\n  ⚠  ${SETUP_MESSAGE}\n`);
    return { text: SETUP_MESSAGE, built: false };
  }

  const dir = projectDir(projectId);
  await ensureWorkspace(projectId);
  const startedAs = await fingerprint(dir);

  const emitStep = (step: StepData) => emit({ type: "step", step });
  const finishStep = (step: ToolStep) => emit({ type: "tool", step });
  const turn = { built: false, looks: 0 }; // Built during this answer (to look at it, say), and looks taken.
  const build = async () => {
    const result = await buildIfChanged(projectId, dir, signal, emitStep, finishStep);
    if (result?.ok) turn.built = true;
    return result;
  };
  const context = { projectId, dir, signal, emitStep, finishStep, build, turn, changeProject };

  // The project as it is now goes just before the prompt, so what comes before it (the
  // instructions and the chat) stays the same from answer to answer, and cached.
  // Questions it asked go with what it said, so it knows what the answers are to, and
  // files attached to a prompt go with it.
  const chat = messages.slice(historyStart(messages.length));
  const prompt = withAttachments(chat, files);
  const history: ResponseInputItem[] = chat.map((message) =>
    message.role === "user"
      ? { role: "user", content: prompt(message) }
      : {
          role: "assistant",
          content: message.questions ? `${message.text}\n\n${questionsForAI(message.questions)}` : message.text,
        },
  );
  const state = projectState({ name, icon, color, files: await listFiles(dir), attachments: [...files.values()] });
  let input: ResponseInputItem[] = [...history.slice(0, -1), { role: "developer", content: state }, ...history.slice(-1)];
  let previous: string | undefined;
  let text = "";
  let fixes = 0;
  const usage: Usage = { requests: 0, input: 0, cached: 0, output: 0, reasoning: 0 };
  try {
    for (let call = 0; call < MAX_CALLS; call++) {
      const response = await respond(ai, { input, previous, cacheKey: projectId, signal, emit });
      addUsage(usage, response.usage);
      previous = response.id;
      text = response.text; // The answer is what it says last, after using its tools.

      if (response.calls.length) {
        input = [];
        let questions: Question[] | null = null;
        for (const functionCall of response.calls) {
          let output;
          if (functionCall.name === "ask_user") {
            const asked = askedQuestions(functionCall.arguments);
            if (typeof asked === "string") output = `Error: ${asked}`;
            else [questions, output] = [asked, "Asked."];
          } else {
            output = await callTool(functionCall, context);
          }
          input.push({ type: "function_call_output", call_id: functionCall.call_id, output });
        }
        if (!questions) continue;

        // It asked: the answer ends here, and the next prompt answers the questions. Anything
        // it changed on the way is built; a failed build waits for the answers to be fixed.
        if ((await fingerprint(dir)) !== startedAs) await build();
        return { text: text || ASKING, built: turn.built, questions };
      }

      // It's done. Build the app if its files changed since the last build, or for the first
      // time (unless nothing changed at all: a question about a new project).
      const neverBuilt = (await readFile(path.join(dir, BUILT), "utf8").catch(() => null)) === null;
      const result = neverBuilt && (await fingerprint(dir)) === startedAs ? null : await build();
      if (!result) return { text: text || (turn.built ? UPDATED : "Done."), built: turn.built };
      if (result.ok) return { text: text || UPDATED, built: true };

      if (fixes++ >= MAX_FIXES) {
        const note =
          hasApp || turn.built
            ? "I couldn’t get this version to build, so the preview still shows the last one that worked."
            : "I couldn’t get the app to build yet, so there’s nothing to preview.";
        return { text: `${text}\n\n${note} Tell me to try again, or describe what you see.`.trim(), built: turn.built };
      }
      input = [{ role: "developer", content: `The app didn't build. Fix it.\n\n${result.output}` }];
    }

    return {
      text: `${text}\n\nThat took more steps than I can take at once. Tell me to keep going.`.trim(),
      built: turn.built,
    };
  } finally {
    logUsage(projectId, usage);
  }
}

type Respond = {
  input: ResponseInputItem[];
  previous?: string;
  cacheKey: string; // Requests with the same key share a prompt cache.
  signal: AbortSignal;
  emit: (event: TurnEvent) => void;
};

/**
 * One request to the model, streamed: what it says becomes text steps as it comes in,
 * and web searches show as they happen. Returns the function calls for us to run.
 */
async function respond(ai: NonNullable<ReturnType<typeof aiConfig>>, { input, previous, cacheKey, signal, emit }: Respond) {
  const stream = await ai.client.responses.create(
    {
      model: ai.model,
      reasoning: ai.reasoning,
      instructions: INSTRUCTIONS,
      input,
      previous_response_id: previous,
      prompt_cache_key: cacheKey,
      tools: TOOLS,
      stream: true,
    },
    { signal },
  );

  let id = "";
  let usage: ResponseUsage | undefined;
  let text = ""; // Of the last message.
  const calls: ResponseFunctionToolCall[] = [];
  const steps = new Map<string, ToolStep | string>(); // By item: a search's step, or a text step's id.

  for await (const event of stream) {
    switch (event.type) {
      case "response.created":
        id = event.response.id;
        break;
      case "response.completed":
        id = event.response.id;
        usage = event.response.usage;
        break;
      case "response.output_text.delta": {
        let stepId = steps.get(event.item_id);
        if (typeof stepId !== "string") {
          stepId = newId();
          steps.set(event.item_id, stepId);
          emit({ type: "step", step: { id: stepId, kind: "text", text: "" } });
        }
        emit({ type: "text", id: stepId, delta: event.delta });
        break;
      }
      case "response.output_item.added":
        if (event.item.type === "web_search_call") {
          const step = searchStep(event.item);
          steps.set(event.item.id, step);
          emit({ type: "step", step });
        }
        break;
      case "response.output_item.done": {
        const { item } = event;
        if (item.type === "function_call") {
          calls.push(item);
        } else if (item.type === "message") {
          text = item.content.map((part) => (part.type === "output_text" ? part.text : "")).join("");
        } else if (item.type === "web_search_call") {
          const step = steps.get(item.id);
          if (typeof step === "object") emit({ type: "tool", step: { ...searchStep(item), id: step.id, done: true } });
        }
        break;
      }
      case "response.failed":
        throw new Error(event.response.error?.message ?? "The response failed.");
      case "error":
        throw new Error(event.message);
    }
  }
  return { id, text, calls, usage };
}

/**
 * Builds the app unless it's built as its files are now: null when there was nothing to
 * build, otherwise whether it worked and the output that says why not.
 */
async function buildIfChanged(
  projectId: string,
  dir: string,
  signal: AbortSignal,
  emitStep: (step: StepData) => void,
  finishStep: (step: ToolStep) => void,
) {
  const lastBuilt = await readFile(path.join(dir, BUILT), "utf8").catch(() => null);
  if ((await fingerprint(dir)) === lastBuilt) return null;

  const step: ToolStep = { id: newId(), kind: "tool", tool: "run", label: "Building your app", doneLabel: "Built your app", done: false };
  emitStep(step);
  const build = await buildApp(projectId, signal);
  if (build.ok) {
    await mkdir(path.join(dir, "dist"), { recursive: true });
    await writeFile(path.join(dir, BUILT), await fingerprint(dir)); // After installing, which can change the lock file.
    finishStep({ ...step, done: true });
  } else {
    finishStep({ ...step, done: true, failed: true, doneLabel: "The build failed" });
  }
  return build;
}

/** The questions in ask_user's arguments, or what's wrong with them. */
function askedQuestions(args: string) {
  try {
    return parseQuestions(JSON.parse(args)?.questions);
  } catch {
    return "the arguments weren't valid JSON.";
  }
}

/**
 * Where an answer starts in the chat: everything while it's short, then it drops the
 * oldest in steps, so the start stays put for a while and the chat stays cached.
 */
function historyStart(length: number) {
  return length > MAX_HISTORY ? Math.ceil((length - MAX_HISTORY) / HISTORY_STEP) * HISTORY_STEP : 0;
}

type Usage = { requests: number; input: number; cached: number; output: number; reasoning: number };

function addUsage(total: Usage, usage: ResponseUsage | undefined) {
  total.requests++;
  if (!usage) return;
  total.input += usage.input_tokens;
  total.cached += usage.input_tokens_details?.cached_tokens ?? 0;
  total.output += usage.output_tokens;
  total.reasoning += usage.output_tokens_details?.reasoning_tokens ?? 0;
}

/** What an answer cost, in the server's log: most of the input should be cached. */
function logUsage(projectId: string, usage: Usage) {
  if (!usage.requests) return;
  const count = (value: number) => value.toLocaleString("en-US");
  console.log(
    `AI answer for ${projectId.slice(0, 8)}: ${usage.requests} requests, ${count(usage.input)} input tokens ` +
      `(${count(usage.cached)} cached), ${count(usage.output)} output (${count(usage.reasoning)} reasoning)`,
  );
}

/** "Searching the web: <query>", or reading a page it found. */
function searchStep(item: ResponseFunctionWebSearch): ToolStep {
  const step = { id: newId(), kind: "tool", tool: "search", done: false } as const;
  const { action } = item;
  if (action?.type === "open_page" || action?.type === "find_in_page") {
    return { ...step, label: "Reading a page", doneLabel: "Read a page", detail: hostname(action.url) };
  }
  const query = action?.type === "search" ? (action.queries?.[0] ?? action.query) : undefined;
  return { ...step, label: "Searching the web", doneLabel: "Searched the web", detail: query };
}

function hostname(url: string | null | undefined) {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : undefined;
  } catch {
    return undefined;
  }
}

/** What went wrong, for the chat. */
export function problem(error: unknown) {
  if (error instanceof SandboxError) return `I couldn’t finish: ${error.message}`;
  if (error instanceof OpenAI.APIError) {
    const model = process.env.OPENAI_MODEL;
    if (error.status === 401) return "I couldn’t finish: OpenAI didn’t accept the API key. Check OPENAI_API_KEY in .env.local.";
    if (error.status === 404) return `I couldn’t finish: OpenAI doesn’t know the model “${model}”. Check OPENAI_MODEL in .env.local.`;
    if (error.status === 429) return "I couldn’t finish: OpenAI says we’re over the rate limit or out of credit. Try again in a bit.";
    if (error.status === 400) return `I couldn’t finish: OpenAI turned the request down (${error.message}).`;
  }
  return "Something went wrong and I couldn’t finish. Try again.";
}
