/*
 * The AI's messages stream in word by word, as a real model's replies will. The store keeps the whole
 * text and when it started (projects.ts), and what shows is worked out from the time since, so the
 * store isn't updated for every word and a chat opened mid-stream picks up where the text is.
 */

// How long each word takes to show, in milliseconds.
export const WORD_MS = 35;

// The words with the spaces after them, e.g. "Hi there" → ["Hi ", "there"].
function words(text: string) {
  return text.match(/\S+\s*/g) ?? [];
}

// How long the whole text takes to stream in, in milliseconds.
export function streamDuration(text: string) {
  return words(text).length * WORD_MS;
}

// What shows of the text after streaming for elapsed milliseconds.
export function streamedText(text: string, elapsed: number) {
  const shown = words(text).slice(0, Math.max(0, Math.ceil(elapsed / WORD_MS)));
  return shown.join("").trimEnd();
}
