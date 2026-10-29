"use client";

import type { CSSProperties } from "react";
import { MessageActions } from "@/components/MessageActions";
import { MessageText } from "@/components/MessageText";
import { QuestionsCard } from "@/components/QuestionsCard";
import { UserText } from "@/components/UserText";
import { usePlayOnce } from "@/components/usePlayOnce";
import { PROJECT_COLORS } from "@/lib/projects/options";
import type { ProjectColor } from "@/lib/projects/options";
import { isNew, setFeedback } from "@/lib/projects/store";
import type { Message } from "@/lib/projects/types";

/** What you typed: on the right, on a tint of the project's color, with its lists and links. */
export function UserMessage({ message, color }: { message: Message; color: ProjectColor }) {
  const enter = usePlayOnce("motion-safe:animate-enter", isNew(message.id));
  return (
    <div className={`flex justify-end ${enter.className}`} onAnimationEnd={enter.onAnimationEnd}>
      <div
        style={{ "--project": PROJECT_COLORS[color] } as CSSProperties}
        className="max-w-[85%] rounded-3xl bg-[color-mix(in_srgb,var(--project)_14%,transparent)] px-4 py-2.5 leading-relaxed transition-colors duration-500 wrap-anywhere dark:bg-[color-mix(in_srgb,var(--project)_24%,transparent)]"
      >
        <UserText text={message.text} />
      </div>
    </div>
  );
}

type AssistantMessageProps = {
  projectId: string;
  message: Message;
  onAnswer?: (text: string) => void; // Its questions can be answered: it's the latest, and nothing's being answered.
};

/**
 * A finished answer: no background, with like, dislike and copy under it. The questions
 * it ends with show until the next prompt, which answers them (or not).
 */
export function AssistantMessage({ projectId, message, onAnswer }: AssistantMessageProps) {
  if (message.role !== "assistant") return null;
  return (
    <div>
      <MessageText text={message.text} />
      {message.questions && onAnswer && <QuestionsCard questions={message.questions} onAnswer={onAnswer} />}
      <MessageActions
        text={message.text}
        seconds={message.seconds}
        feedback={message.feedback}
        onFeedback={(feedback) => setFeedback(projectId, message.id, feedback)}
      />
    </div>
  );
}
