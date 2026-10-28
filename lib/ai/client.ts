import "server-only";
import OpenAI from "openai";
import type { ReasoningEffort } from "openai/resources/shared";

// The AI is an OpenAI model, set in .env.local: OPENAI_API_KEY, OPENAI_MODEL and,
// optionally, OPENAI_REASONING_EFFORT (passed on as it is, like "medium").
// The SDK also reads OPENAI_BASE_URL, which the tests point at a fake.

let client: OpenAI | null = null;

/** The client and settings, or null when the AI isn't set up. */
export function aiConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;
  if (!apiKey || !model) return null;
  client ??= new OpenAI({ apiKey });
  const effort = process.env.OPENAI_REASONING_EFFORT?.trim();
  return { client, model, reasoning: effort ? { effort: effort as ReasoningEffort } : undefined };
}

export const SETUP_MESSAGE =
  "The AI isn’t set up yet: add OPENAI_API_KEY and OPENAI_MODEL to .env.local, then restart the server.";
