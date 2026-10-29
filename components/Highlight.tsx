import { wordPattern } from "@/lib/projects/search";

/** Text with the words searched for marked. */
export function Highlight({ text, words }: { text: string; words: string[] }) {
  if (words.length === 0) return text;
  // Split on a capturing pattern: every other part is a match.
  return text.split(wordPattern(words)).map((part, index) =>
    index % 2 ? (
      <mark key={index} className="rounded-[0.25em] bg-foreground/10 text-foreground">
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
