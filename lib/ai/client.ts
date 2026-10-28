import "server-only";
import OpenAI from "openai";
import type { ReasoningEffort } from "openai/resources/shared";

// The AI is an OpenAI model, set in .env.local: OPENAI_API_KEY, OPENAI_MODEL and,
// optionally, OPENAI_REASONING_EFFORT (passed on as it is, like "medium"). Quick side
// jobs, like naming a project, can use a cheaper OPENAI_SMALL_MODEL.
// The SDK also reads OPENAI_BASE_URL, which the tests point at a fake.

let client: OpenAI | null = null;

/** The client and settings, or null when the AI isn't set up. */
export function aiConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) return null;
  client ??= new OpenAI({ apiKey });
  return { client, model, reasoning: reasoning(process.env.OPENAI_REASONING_EFFORT) };
}

/** For quick side jobs: OPENAI_SMALL_MODEL (with OPENAI_SMALL_REASONING_EFFORT) when set, or the main model. */
export function smallAiConfig() {
  const ai = aiConfig();
  const model = process.env.OPENAI_SMALL_MODEL?.trim();
  if (!ai || !model) return ai;
  return { ...ai, model, reasoning: reasoning(process.env.OPENAI_SMALL_REASONING_EFFORT) };
}

function reasoning(effort: string | undefined) {
  const value = effort?.trim();
  return value ? { effort: value as ReasoningEffort } : undefined;
}

export const SETUP_MESSAGE =
  "The AI isn’t set up yet: add OPENAI_API_KEY and OPENAI_MODEL to .env.local, then restart the server.";
