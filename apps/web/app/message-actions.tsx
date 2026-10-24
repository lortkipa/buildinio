"use client";

import { useEffect, useState } from "react";
import { CheckIcon, CopyIcon, ThumbsDownIcon, ThumbsUpIcon } from "./icons";
import { type Message, setReaction } from "./projects";

const ACTION =
  "relative grid size-8 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white";

// How long Copy shows its check.
const COPIED_MS = 1500;

/*
 * Under a chat message. The AI's: Like, Dislike and Copy, always shown. Like and Dislike exclude
 * each other: picking one takes the other back, and pressing the picked one again clears it. The user's: Copy, always shown on
 * touch screens; with a mouse or trackpad, while the message is hovered or Copy has focus.
 */
export function MessageActions({
  projectId,
  message,
  onCopyFailed,
}: {
  projectId: string;
  message: Message;
  onCopyFailed: () => void;
}) {
  // Nothing to copy when the user sent only files.
  if (message.role === "user" && !message.text) return null;
  return (
    <div
      className={`mt-1 flex items-center gap-0.5 ${
        message.role === "ai"
          ? "-ml-2"
          : "-mr-1 transition-opacity duration-200 pointer-fine:opacity-0 pointer-fine:group-hover/message:opacity-100 pointer-fine:focus-within:opacity-100"
      }`}
    >
      {message.role === "ai" && (
        <>
          <LikeButton projectId={projectId} message={message} />
          <DislikeButton projectId={projectId} message={message} />
        </>
      )}
      <CopyButton text={message.text} onFailed={onCopyFailed} />
    </div>
  );
}

const BURST_COLORS = [
  "bg-brand-amber",
  "bg-brand-coral",
  "bg-brand-magenta",
  "bg-brand-violet",
  "bg-brand-blue",
];

// Eight dots flying out of the thumb, in the brand colors.
function Burst() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 motion-reduce:hidden">
      {Array.from({ length: 8 }, (_, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: a fixed set of dots
          key={index}
          style={{ "--angle": `${index * 45}deg` } as React.CSSProperties}
          className={`absolute top-1/2 left-1/2 -mt-0.75 -ml-0.75 size-1.5 animate-burst rounded-full ${BURST_COLORS[index % BURST_COLORS.length]}`}
        />
      ))}
    </span>
  );
}

// Likes the message, popping the thumb and bursting confetti. Pressed again, takes the like back.
function LikeButton({ projectId, message }: { projectId: string; message: Message }) {
  const liked = message.reaction === "like";
  // Counts likes from this button, so each one replays the animation (none for a like from before).
  const [plays, setPlays] = useState(0);

  return (
    <button
      type="button"
      aria-label="Like"
      aria-pressed={liked}
      data-tooltip="Like"
      onClick={() => {
        setReaction(projectId, message.id, liked ? undefined : "like");
        if (!liked) setPlays((count) => count + 1);
      }}
      className={ACTION}
    >
      <span
        key={liked ? `pop-${plays}` : "off"}
        className={liked && plays > 0 ? "animate-like-pop motion-reduce:animate-none" : undefined}
      >
        <ThumbsUpIcon
          className={`size-4 transition-colors ${liked ? "fill-current text-brand-magenta" : ""}`}
        />
      </span>
      {liked && plays > 0 && <Burst key={`burst-${plays}`} />}
    </button>
  );
}

// Dislikes the message: the thumb fills, drops and wobbles. Pressed again, takes it back.
function DislikeButton({ projectId, message }: { projectId: string; message: Message }) {
  const disliked = message.reaction === "dislike";
  const [plays, setPlays] = useState(0);

  return (
    <button
      type="button"
      aria-label="Dislike"
      aria-pressed={disliked}
      data-tooltip="Dislike"
      onClick={() => {
        setReaction(projectId, message.id, disliked ? undefined : "dislike");
        if (!disliked) setPlays((count) => count + 1);
      }}
      className={ACTION}
    >
      <span
        key={disliked ? `drop-${plays}` : "off"}
        className={
          disliked && plays > 0 ? "animate-dislike-drop motion-reduce:animate-none" : undefined
        }
      >
        <ThumbsDownIcon
          className={`size-4 transition-colors ${
            disliked ? "fill-current text-zinc-950 dark:text-white" : ""
          }`}
        />
      </span>
    </button>
  );
}

// Copies the text: the icon spins into a check and "Copied" floats up, then both go back.
function CopyButton({ text, onFailed }: { text: string; onFailed: () => void }) {
  // Counts copies, so each one replays the animation. 0 while showing the copy icon.
  const [copied, setCopied] = useState(0);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(0), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    if (await copyText(text)) setCopied((count) => count + 1);
    else onFailed();
  }

  return (
    <button type="button" aria-label="Copy" data-tooltip="Copy" onClick={copy} className={ACTION}>
      <CopyIcon
        className={`absolute inset-0 m-auto size-4 transition duration-300 ease-spring motion-reduce:transition-none ${
          copied ? "scale-50 -rotate-90 opacity-0" : ""
        }`}
      />
      <CheckIcon
        className={`absolute inset-0 m-auto size-4 text-emerald-600 transition duration-300 ease-spring motion-reduce:transition-none dark:text-emerald-400 ${
          copied ? "" : "scale-50 rotate-90 opacity-0"
        }`}
      />
      {copied > 0 && (
        <span
          key={copied}
          aria-hidden
          className="pointer-events-none absolute bottom-full left-1/2 mb-1 animate-copied rounded-md bg-zinc-950 px-1.5 py-0.5 text-xs font-medium whitespace-nowrap text-white shadow-md motion-reduce:animate-none dark:bg-white dark:text-zinc-950"
        >
          Copied
        </span>
      )}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied" : ""}
      </span>
    </button>
  );
}

/*
 * Copies text to the clipboard and says whether it worked. The Clipboard API exists only on secure
 * origins; on plain http (the dev server opened from a phone on the local network) a hidden, selected
 * textarea is copied instead.
 */
async function copyText(text: string) {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Denied, e.g. the document lost focus. The fallback may still work.
    }
  }
  const focused = document.activeElement as HTMLElement | null;
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = "fixed";
  textarea.style.inset = "0";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  // iOS selects nothing with select() alone.
  textarea.setSelectionRange(0, text.length);
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    focused?.focus();
  }
}
