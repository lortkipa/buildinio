"use client";

import type { CSSProperties, ReactNode } from "react";
import { MessageActions } from "@/components/MessageActions";
import { usePlayOnce } from "@/components/usePlayOnce";
import { PROJECT_COLORS } from "@/lib/projects/options";
import type { ProjectColor } from "@/lib/projects/options";
import { isNew, setFeedback } from "@/lib/projects/store";
import type { Message } from "@/lib/projects/types";

/** What you typed: on the right, on a tint of the project's color. */
export function UserMessage({ message, color }: { message: Message; color: ProjectColor }) {
  const enter = usePlayOnce("motion-safe:animate-enter", isNew(message.id));
  return (
    <div className={`flex justify-end ${enter.className}`} onAnimationEnd={enter.onAnimationEnd}>
      <p
        style={{ "--project": PROJECT_COLORS[color] } as CSSProperties}
        className="max-w-[85%] rounded-3xl bg-[color-mix(in_srgb,var(--project)_14%,transparent)] px-4 py-2.5 leading-relaxed whitespace-pre-wrap transition-colors duration-500 wrap-anywhere dark:bg-[color-mix(in_srgb,var(--project)_24%,transparent)]"
      >
        {message.text}
      </p>
    </div>
  );
}

/** A finished answer: no background, with like, dislike and copy under it. */
export function AssistantMessage({ projectId, message }: { projectId: string; message: Message }) {
  if (message.role !== "assistant") return null;
  return (
    <div>
      <MessageText text={message.text} />
      <MessageActions
        text={message.text}
        seconds={message.seconds}
        feedback={message.feedback}
        onFeedback={(feedback) => setFeedback(projectId, message.id, feedback)}
      />
    </div>
  );
}

/**
 * The AI's text: paragraphs split by blank lines, "- " lists and **bold**. Copes
 * with text that's halfway streamed in, like a list item that's just a "-" so far.
 */
export function MessageText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).filter((block) => block.trim());
  return (
    <div className="flex flex-col gap-3 leading-relaxed wrap-anywhere">
      {blocks.map((block, index) => {
        const lines = block.split("\n").filter(Boolean);
        if (lines.every((line) => line.startsWith("-"))) {
          return (
            <ul key={index} className="flex list-disc flex-col gap-1 pl-5 marker:text-muted">
              {lines.map((line, i) => (
                <li key={i}>{withBold(line.replace(/^-\s?/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={index} className="whitespace-pre-wrap">
            {withBold(block)}
          </p>
        );
      })}
    </div>
  );
}

/** Text between ** pairs in bold. An unclosed one (still streaming) is bold to the end. */
function withBold(text: string): ReactNode[] {
  return text.split("**").map((part, index) =>
    index % 2 ? (
      <strong key={index} className="font-semibold">
        {part}
      </strong>
    ) : (
      part
    ),
  );
}
