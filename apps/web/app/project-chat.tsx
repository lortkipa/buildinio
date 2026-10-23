"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { MessageActions } from "./message-actions";
import { projectColorStyle } from "./project-icon";
import { type Message, sendMessage, useProject } from "./projects";
import { PromptInput } from "./prompt-input";
import { useScrollFade } from "./scroll-fade";
import { Toast, useToast } from "./toast";

const THINKING_DOTS = ["bg-brand-magenta", "bg-brand-violet", "bg-brand-blue"];

/*
 * A project's chat: the user's messages on a tint of the project's color, the AI's as plain text,
 * and the prompt input at the bottom to keep going. Fills the screen; only the messages scroll,
 * up under the top bar with the project's name (AppShell), fading out at the edges into the
 * background rather than under bars of page color. A project that isn't there (a wrong link, just deleted, or new
 * before a reload, since projects are mocked in memory) sends the user home.
 */
export function ProjectChat({ id }: { id: string }) {
  const router = useRouter();
  const project = useProject(id);
  const { toast, showToast, closeToast } = useToast();
  const count = project?.messages.length ?? 0;
  const replying = project?.replying ?? false;
  // Messages already there when the page opened don't animate in, except a new project's prompt.
  const [shownCount] = useState(project?.name === null ? 0 : count);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrolled = useRef(false);
  useScrollFade(scrollRef);

  useEffect(() => {
    if (!project) router.replace("/");
  }, [project, router]);

  // Down to the latest message: at once when the page opens, smoothly as messages come in.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on new messages and replies
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    box.scrollTo({ top: box.scrollHeight, behavior: scrolled.current ? "smooth" : "instant" });
    scrolled.current = true;
  }, [count, replying]);

  if (!project) return null;

  return (
    <main style={projectColorStyle(project.color)} className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="prompt-scrollbar scroll-fade-edges min-h-0 flex-1 overflow-y-auto overscroll-contain [--fade-size:3rem] [--fade-top-ease:0.15] [--fade-top-size:4.5rem]"
      >
        {/* pt-16 clears the top bar, which floats over the chat (AppShell). */}
        <ol className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-16 pb-6">
          {project.messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              projectId={project.id}
              message={message}
              animate={index >= shownCount}
              onCopyFailed={() => showToast("Couldn’t copy the message. Try again.")}
            />
          ))}
          {replying && (
            <li className="animate-message-in motion-reduce:animate-none">
              <div role="status" className="flex h-7 items-center gap-1.5">
                {THINKING_DOTS.map((color, index) => (
                  <span
                    key={color}
                    style={{ animationDelay: `${index * 150}ms` }}
                    className={`size-2 animate-thinking rounded-full motion-reduce:animate-none ${color}`}
                  />
                ))}
                <span className="sr-only">Buildinio is replying…</span>
              </div>
            </li>
          )}
        </ol>
      </div>

      {/* Above the home indicator on phones. */}
      <div className="px-4 pt-2 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto max-w-3xl">
          <PromptInput
            onSend={(text) => sendMessage(project.id, text)}
            placeholder="Ask Buildinio for a change…"
            busy={replying}
          />
        </div>
      </div>

      <Toast toast={toast} onClose={closeToast} />
    </main>
  );
}

function ChatMessage({
  projectId,
  message,
  animate,
  onCopyFailed,
}: {
  projectId: string;
  message: Message;
  animate: boolean;
  onCopyFailed: () => void;
}) {
  const fromUser = message.role === "user";
  return (
    <li
      className={`group/message flex flex-col ${fromUser ? "items-end" : "items-start"} ${
        animate ? "animate-message-in motion-reduce:animate-none" : ""
      }`}
    >
      {fromUser ? (
        <p className="max-w-[85%] rounded-3xl px-4 py-2.5 text-base/7 whitespace-pre-wrap wrap-break-word project-tint">
          <span className="sr-only">You: </span>
          {message.text}
        </p>
      ) : (
        <p className="w-full text-base/7 whitespace-pre-wrap wrap-break-word">
          <span className="sr-only">Buildinio: </span>
          {message.text}
        </p>
      )}
      <MessageActions projectId={projectId} message={message} onCopyFailed={onCopyFailed} />
    </li>
  );
}
