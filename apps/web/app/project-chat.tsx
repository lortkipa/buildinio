"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppReadyPill } from "./app-ready";
import { AttachmentTile } from "./attachment-tile";
import type { Attachment } from "./attachments";
import { BuildSteps } from "./build-steps";
import { ImageViewer } from "./image-viewer";
import { MessageActions } from "./message-actions";
import { projectColorStyle } from "./project-icon";
import { type Message, sendMessage, stopReply, useProject } from "./projects";
import { PromptInput } from "./prompt-input";
import { useScrollFade } from "./scroll-fade";
import { streamedText, WORD_MS } from "./stream";
import { Toast, useToast } from "./toast";

const THINKING_DOTS = ["bg-brand-magenta", "bg-brand-violet", "bg-brand-blue"];

// How close to the bottom counts as reading the latest, in pixels.
const PIN_SLACK = 48;
// Growing by more than this at once (a new message, not a word) scrolls smoothly.
const SMOOTH_GROWTH = 40;

/*
 * A project's chat: the user's messages on a tint of the project's color, the AI's as plain text,
 * and the prompt input at the bottom to keep going. Fills the screen; only the messages scroll,
 * up under the top bar with the project's name (AppShell), fading out at the edges into the
 * background rather than under bars of page color. While the reader is at the bottom, it follows the
 * AI's reply as it grows (text streaming in, a build's steps). A project that isn't there (a wrong
 * link, just deleted, or new before a reload, since projects are mocked in memory) sends the user
 * home.
 */
export function ProjectChat({ id }: { id: string }) {
  const router = useRouter();
  const project = useProject(id);
  const { toast, showToast, closeToast } = useToast();
  const count = project?.messages.length ?? 0;
  const replying = project?.replying ?? false;
  // Waiting for the AI's first words: its turn, with nothing from it yet.
  const thinking = replying && project?.messages.at(-1)?.role === "user";
  // Messages already there when the page opened don't animate in, except a new project's prompt.
  const [shownCount] = useState(project?.name === null ? 0 : count);
  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const scrolled = useRef(false);
  // The reader is at the bottom, so the chat follows what comes in.
  const pinned = useRef(true);
  // The user is scrolling (wheel, touch, keys, the scrollbar), not the chat following.
  const byUser = useRef(false);
  const [viewing, setViewing] = useState<Attachment | null>(null);
  useScrollFade(scrollRef);

  useEffect(() => {
    if (!project) router.replace("/");
  }, [project, router]);

  // Down to the latest message when the page opens, and when the user sends one.
  const lastFromUser = project?.messages.at(-1)?.role === "user";
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs on new messages
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || (scrolled.current && !lastFromUser)) return;
    pinned.current = true;
    byUser.current = false;
    box.scrollTo({ top: box.scrollHeight, behavior: scrolled.current ? "smooth" : "instant" });
    scrolled.current = true;
  }, [count]);

  // As the chat grows, it follows while pinned: smoothly for a new message, at once word by word.
  useEffect(() => {
    const box = scrollRef.current;
    const list = listRef.current;
    if (!box || !list) return;
    let height = list.offsetHeight;
    const observer = new ResizeObserver(() => {
      const grown = list.offsetHeight - height;
      height = list.offsetHeight;
      if (grown <= 0 || !pinned.current || !scrolled.current) return;
      byUser.current = false;
      box.scrollTo({
        top: box.scrollHeight,
        behavior: grown > SMOOTH_GROWTH ? "smooth" : "instant",
      });
    });
    observer.observe(list);
    // Only the user's own scrolling unpins it, not the chat's following.
    const userScrolls = () => {
      byUser.current = true;
    };
    const onScroll = () => {
      if (byUser.current)
        pinned.current = box.scrollHeight - box.scrollTop - box.clientHeight < PIN_SLACK;
    };
    const userEvents = ["wheel", "touchmove", "keydown", "pointerdown"] as const;
    for (const type of userEvents) box.addEventListener(type, userScrolls, { passive: true });
    box.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      observer.disconnect();
      for (const type of userEvents) box.removeEventListener(type, userScrolls);
      box.removeEventListener("scroll", onScroll);
    };
  }, []);

  if (!project) return null;

  return (
    <main style={projectColorStyle(project.color)} className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className="prompt-scrollbar scroll-fade-edges min-h-0 flex-1 overflow-y-auto overscroll-contain [--fade-size:3rem] [--fade-top-ease:0.15] [--fade-top-size:4.5rem]"
      >
        {/* pt-16 clears the top bar, which floats over the chat (AppShell). */}
        <ol ref={listRef} className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pt-16 pb-6">
          {project.messages.map((message, index) => (
            <ChatMessage
              key={message.id}
              projectId={project.id}
              message={message}
              animate={index >= shownCount}
              onView={setViewing}
              onCopyFailed={() => showToast("Couldn’t copy the message. Try again.")}
            />
          ))}
          {thinking && (
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
        <div className="relative mx-auto max-w-3xl">
          <AppReadyPill />
          <PromptInput
            onSend={(text, attachments) => sendMessage(project.id, text, attachments)}
            onStop={() => stopReply(project.id)}
            placeholder="Ask Buildinio for a change…"
            busy={replying}
          />
        </div>
      </div>

      <ImageViewer image={viewing} onClose={() => setViewing(null)} />
      <Toast toast={toast} onClose={closeToast} />
    </main>
  );
}

function ChatMessage({
  projectId,
  message,
  animate,
  onView,
  onCopyFailed,
}: {
  projectId: string;
  message: Message;
  animate: boolean;
  onView: (attachment: Attachment) => void;
  onCopyFailed: () => void;
}) {
  const fromUser = message.role === "user";
  const attachments = message.attachments ?? [];
  const streaming = message.streamStart !== undefined;
  if (message.build) {
    return (
      <li className={animate ? "animate-message-in motion-reduce:animate-none" : ""}>
        <BuildSteps build={message.build} />
      </li>
    );
  }
  return (
    <li
      className={`group/message flex flex-col ${fromUser ? "items-end" : "items-start"} ${
        animate ? "animate-message-in motion-reduce:animate-none" : ""
      }`}
    >
      {attachments.length > 0 && (
        <ul
          aria-label={message.text ? "Attached files" : "You sent files"}
          className="mb-2 flex max-w-[85%] flex-wrap justify-end gap-2"
        >
          {attachments.map((attachment) => (
            <li key={attachment.id}>
              <AttachmentTile attachment={attachment} onView={() => onView(attachment)} />
            </li>
          ))}
        </ul>
      )}
      {fromUser ? (
        message.text && (
          <p className="max-w-[85%] rounded-3xl px-4 py-2.5 text-base/7 whitespace-pre-wrap wrap-break-word project-tint">
            <span className="sr-only">You: </span>
            {message.text}
          </p>
        )
      ) : (
        <p className="w-full text-base/7 whitespace-pre-wrap wrap-break-word">
          <span className="sr-only">Buildinio: </span>
          {message.streamStart !== undefined ? (
            <StreamedText text={message.text} start={message.streamStart} />
          ) : (
            message.text
          )}
        </p>
      )}
      {!streaming && !message.intro && (
        <MessageActions projectId={projectId} message={message} onCopyFailed={onCopyFailed} />
      )}
    </li>
  );
}

// The AI's text as far as it has streamed in (stream.ts), with a caret at the end.
function StreamedText({ text, start }: { text: string; start: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), WORD_MS);
    return () => clearInterval(timer);
  }, []);

  return (
    <>
      {streamedText(text, now - start)}
      <span
        aria-hidden
        className="ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 animate-caret-blink bg-(--project) motion-reduce:animate-none"
      />
    </>
  );
}
