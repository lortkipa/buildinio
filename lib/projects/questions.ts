import type { Question } from "@/lib/projects/types";

// The AI's questions (its ask_user tool): checking what it asked for, how it sees them
// in the chat later, and the answers, which go back to it as the next prompt.

export const MAX_QUESTIONS = 20;
export const MAX_OPTIONS = 8;
const MAX_QUESTION = 300; // Characters.
const MAX_OPTION = 120;

// Options the browser always adds itself.
const OWN = /^(other|something else|type your own|write your own|none of (these|the above))\b/i;

/** What someone picked for a question: options, and what they typed. Null if they skipped it. */
export type Answer = { picked: string[]; own: string } | null;

const SKIPPED = "Skipped: you decide";

/** The AI's questions, tidied up, or what's wrong with them (for the AI). */
export function parseQuestions(raw: unknown): Question[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return "Ask at least one question.";
  if (raw.length > MAX_QUESTIONS) return `Ask at most ${MAX_QUESTIONS} questions at once.`;
  const questions: Question[] = [];
  for (const item of raw) {
    const question = typeof item?.question === "string" ? tidy(item.question) : "";
    if (!question || question.length > MAX_QUESTION) return `Each question must be 1 to ${MAX_QUESTION} characters.`;
    const options: string[] = [];
    for (const option of Array.isArray(item.options) ? item.options : []) {
      const text = typeof option === "string" ? tidy(option) : "";
      if (!text || OWN.test(text) || options.some((o) => o.toLowerCase() === text.toLowerCase())) continue;
      if (text.length > MAX_OPTION) return `Keep each option under ${MAX_OPTION} characters.`;
      options.push(text);
    }
    if (options.length < 2 || options.length > MAX_OPTIONS) {
      return `"${question}" needs 2 to ${MAX_OPTIONS} different options (not counting "Other": everyone can type their own).`;
    }
    questions.push({ question, multiple: item.multiple === true, options });
  }
  return questions;
}

/** The questions as the AI sees them in the chat, after what it said. */
export function questionsForAI(questions: Question[]) {
  const list = questions.map(
    ({ question, multiple, options }, i) => `${i + 1}. ${question} (${multiple ? "pick any" : "pick one"}: ${options.join(" / ")})`,
  );
  return `[You asked with ask_user. They can pick, type their own answer, or skip.]\n${list.join("\n")}`;
}

/** The answers, as the prompt that's sent: each question with what was picked under it. */
export function formatAnswers(questions: Question[], answers: Answer[]) {
  return questions
    .map(({ question }, i) => {
      const answer = answers[i];
      const own = answer?.own.trim();
      const picked = answer ? [...answer.picked, ...(own ? [tidy(own)] : [])] : [];
      return `${question}\n${(picked.length ? picked : [SKIPPED]).map((text) => `• ${text}`).join("\n")}`;
    })
    .join("\n\n");
}

function tidy(text: string) {
  return text.trim().replace(/\s+/g, " ");
}
