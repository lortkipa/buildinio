"use client";

import type { CSSProperties } from "react";
import { MessageActions } from "@/components/MessageActions";
import { MessageText } from "@/components/MessageText";
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
