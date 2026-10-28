"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { AssistantMessage, UserMessage } from "@/components/ChatMessage";
import { ChatTurn } from "@/components/ChatTurn";
import { PromptBox } from "@/components/PromptBox";
import { focusRing } from "@/components/styles";
import { useKeyboardDock } from "@/components/useKeyboardDock";
import { usePlayOnce } from "@/components/usePlayOnce";
import { setMobilePreview } from "@/components/usePreviewState";
import { markPreviewSeen, sendMessage, useProject } from "@/lib/projects/store";
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

  // The tab shows the project's name. Next.js puts the page's own title ("Project - Buildinio")
  // back whenever it mounts its <title>, which can happen after this (navigating here again,
  // metadata streaming in), so put the name back every time the head changes.
  const title = `${project.name ?? "New project"} - Buildinio`;
  useEffect(() => {
    const apply = () => {
      if (document.title !== title) document.title = title;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [title]);

  // The page itself scrolls. Text fades under the header and above the prompt box
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
      {/* A gentle fade behind the header, like the one above the prompt box.
          Pulled up over the header's spot, taking no space. */}
      <div
        aria-hidden
        className={`pointer-events-none sticky top-0 z-10 -mx-4 -mt-14 -mb-2 h-16 bg-linear-to-b from-background to-transparent transition-opacity duration-300 sm:-mx-6 ${
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
          className={`pointer-events-none absolute inset-x-0 bottom-full h-8 bg-linear-to-t from-background to-transparent transition-opacity duration-300 ${
            atBottom ? "opacity-0" : ""
          }`}
        />
        {/* Hidden while docked above the keyboard: the box has moved. */}
        {project.ready && !dock && <ReadyCard projectId={project.id} />}
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

/**
 * On phones the preview doesn't open by itself when the app is built (it would cover
 * the chat): a small pill above the prompt box says it's ready.
 */
function ReadyCard({ projectId }: { projectId: string }) {
  const enter = usePlayOnce("motion-safe:animate-enter");
  return (
    // Centered over the chat, leaving what's beside it clickable.
    <div className="pointer-events-none absolute inset-x-4 bottom-full mb-2 flex justify-center md:hidden">
      <div
        onAnimationEnd={enter.onAnimationEnd}
        className={`pointer-events-auto flex items-center gap-1 rounded-full border border-border bg-surface py-1 pr-1 pl-4 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.18)] ${enter.className}`}
      >
        <p className="mr-2 text-sm font-medium">Your app is ready</p>
        <button
          type="button"
          aria-label="View your app"
          onClick={() => setMobilePreview(true)}
          className={`h-8 cursor-pointer rounded-full bg-foreground px-3.5 text-sm font-medium text-background transition-colors hover:bg-foreground/85 ${focusRing}`}
        >
          View
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => markPreviewSeen(projectId)}
          className={`grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-foreground/5 hover:text-foreground ${focusRing}`}
        >
          <X size={16} />
        </button>
      </div>
    </div>
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
