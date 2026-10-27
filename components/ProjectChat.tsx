"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AssistantMessage, UserMessage } from "@/components/ChatMessage";
import { ChatTurn } from "@/components/ChatTurn";
import { PromptBox } from "@/components/PromptBox";
import { focusRing } from "@/components/styles";
import { useKeyboardDock } from "@/components/useKeyboardDock";
import { sendMessage, useProject } from "@/lib/projects/store";
import type { Project } from "@/lib/projects/types";

const FOLLOW_SLACK = 96; // px from the bottom that still counts as reading the latest.

/** A project's chat: the messages, the answer in progress, and the prompt box at the bottom. */
export function ProjectChat({ id }: { id: string }) {
  const { loaded, project } = useProject(id);
  if (!loaded) return <main className="flex-1" />;
  if (!project) return <NotFound />;
  return <Chat project={project} />;
}

function Chat({ project }: { project: Project }) {
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dock = useKeyboardDock(textareaRef, inputRef);
  const following = useRef(true); // Keep scrolling down as the answer grows.
  const [atTop, setAtTop] = useState(true);
  const [atBottom, setAtBottom] = useState(true);

  // The tab shows the project's name. After every render: navigating to this page
  // again puts back the page's own title ("Project | buildinio").
  useEffect(() => {
    document.title = `${project.name ?? "New project"} | buildinio`;
  });

  // The page itself scrolls. Text fades out under the header and above the prompt box
  // while there's more that way, and the chat follows the answer while you're at the bottom.
  useEffect(() => {
    const page = document.documentElement;
    const update = () => {
      const below = page.scrollHeight - window.scrollY - window.innerHeight;
      following.current = below < FOLLOW_SLACK;
      setAtTop(window.scrollY <= 1);
      setAtBottom(below <= 1);
    };
    const toBottom = () => window.scrollTo({ top: page.scrollHeight });
    const grew = () => {
      if (following.current) toBottom();
      update();
    };

    // Open at the latest message.
    const frame = requestAnimationFrame(() => {
      toBottom();
      update();
    });
    const observer = new ResizeObserver(grew);
    if (listRef.current) observer.observe(listRef.current);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [project.id]);

  function handleSend(text: string) {
    following.current = true;
    sendMessage(project.id, text);
  }

  return (
    <main className="flex flex-1 flex-col px-4 sm:px-6">
      {/* Under the header: what scrolls up fades away instead of being cut off. */}
      <div
        aria-hidden
        className={`pointer-events-none sticky top-14 z-10 -mx-4 -mb-16 h-16 bg-linear-to-b from-background to-transparent transition-opacity duration-300 sm:-mx-6 ${
          atTop ? "opacity-0" : ""
        }`}
      />

      <div ref={listRef} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 pt-6 pb-10">
        {project.messages.map((message) =>
          message.role === "user" ? (
            <UserMessage key={message.id} message={message} color={project.color} />
          ) : (
            <AssistantMessage key={message.id} projectId={project.id} message={message} />
          ),
        )}
        {project.turn && <ChatTurn turn={project.turn} />}
      </div>

      <div
        ref={inputRef}
        style={dock ? { height: dock.keptHeight } : undefined}
        className="sticky bottom-0 z-10 -mx-4 bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:-mx-6 sm:px-6"
      >
        {/* Above the prompt box, the same for what's further down. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 bottom-full h-16 bg-linear-to-t from-background to-transparent transition-opacity duration-300 ${
            atBottom ? "opacity-0" : ""
          }`}
        />
        <PromptBox
          textareaRef={textareaRef}
          dock={dock}
          onSubmit={handleSend}
          variant="chat"
          busy={project.turn !== null}
          signedIn
          className="mx-auto"
        />
      </div>
    </main>
  );
}

function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 pb-28 text-center">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">This project doesn&rsquo;t exist</h1>
      <p className="mt-2 text-muted">It may have been deleted.</p>
      <Link
        href="/"
        className={`mt-6 flex h-11 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 ${focusRing}`}
      >
        Start a new one
      </Link>
    </main>
  );
}
