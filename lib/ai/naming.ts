import "server-only";
import { smallAiConfig } from "@/lib/ai/client";
import { COLOR_NAMES, ICON_NAMES, MAX_PROJECT_NAME } from "@/lib/projects/options";
import type { ProjectColor, ProjectIcon } from "@/lib/projects/options";

// The first prompt names the project, picking an icon and a color too. It's a quick
// call of its own, made while the AI starts on the answer (with the small model, if set).

export type ProjectLook = { name: string; icon: ProjectIcon; color: ProjectColor };

const INSTRUCTIONS = `Someone is starting a new app with the message below. Name it and pick how it looks in their list of projects.
- name: 1 to 3 words in Title Case, in the language of the message, like "Salon Booking" or "Habit Tracker". No quotes, emoji or the word "App" unless it's needed.
- icon and color: ones that fit the app.`;

/** A name, icon and color for the app the prompt asks for. Falls back to words from the prompt. */
export async function nameProject(prompt: string, signal: AbortSignal): Promise<ProjectLook> {
  const ai = smallAiConfig();
  if (!ai) return lookFromPrompt(prompt);
  try {
    const response = await ai.client.responses.create(
      {
        model: ai.model,
        reasoning: ai.reasoning,
        instructions: INSTRUCTIONS,
        input: prompt.slice(0, 4000),
        store: false,
        text: {
          format: {
            type: "json_schema",
            name: "project",
            strict: true,
            schema: {
              type: "object",
              properties: {
                name: { type: "string" },
                icon: { type: "string", enum: ICON_NAMES },
                color: { type: "string", enum: COLOR_NAMES },
              },
              required: ["name", "icon", "color"],
              additionalProperties: false,
            },
          },
        },
      },
      { signal },
    );
    const { name, icon, color } = JSON.parse(response.output_text);
    const clean = typeof name === "string" ? name.trim().replace(/\s+/g, " ").slice(0, MAX_PROJECT_NAME) : "";
    if (!clean || !ICON_NAMES.includes(icon) || !COLOR_NAMES.includes(color)) throw new Error("Unexpected name");
    return { name: clean, icon, color };
  } catch (error) {
    if (signal.aborted) throw error;
    console.error("Naming the project failed:", error);
    return lookFromPrompt(prompt);
  }
}

const FILLER = new Set(
  "a an the app apps website site page for my our me us to that with of and in on i want need would like build make create please can you simple small little new".split(" "),
);

/** A couple of words from the prompt, like "Plant Watering" from "an app for plant watering". */
function lookFromPrompt(prompt: string): ProjectLook {
  const words = prompt
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word && !FILLER.has(word))
    .slice(0, 2);
  const name = words.length ? words.map((word) => word[0].toUpperCase() + word.slice(1)).join(" ") : "New App";
  let seed = 0;
  for (const char of prompt) seed = (seed * 31 + char.charCodeAt(0)) >>> 0;
  return { name, icon: ICON_NAMES[seed % ICON_NAMES.length], color: COLOR_NAMES[seed % COLOR_NAMES.length] };
}
