"use client";

import { useEffect, useState } from "react";
import { Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { focusRing, shown, swap } from "@/components/styles";
import { formatSeconds } from "@/components/useStreamed";
import type { Feedback } from "@/lib/projects/types";

const COPIED_MS = 1500;

const actionButton = `relative grid size-8 cursor-pointer place-items-center rounded-lg text-muted transition-colors hover:bg-foreground/5 hover:text-foreground ${focusRing}`;

type MessageActionsProps = {
  text: string;
  seconds: number; // How long the answer took.
  feedback: Feedback | null;
  onFeedback: (feedback: Feedback | null) => void;
};

/** Under every answer: like, dislike and copy, then how long it took. */
export function MessageActions({ text, seconds, feedback, onFeedback }: MessageActionsProps) {
  const [copied, setCopied] = useState(false);

  // Back to the copy icon after a moment.
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  // Pressing the one that's on turns it off; pressing the other switches.
  function press(value: Feedback) {
    onFeedback(feedback === value ? null : value);
  }

  async function handleCopy() {
    if (await copyText(text.replaceAll("**", ""))) setCopied(true);
    else toast.error("Couldn’t copy. Try selecting the text instead.");
  }

  return (
    <div className="mt-2 -ml-1.5 flex h-8 items-center gap-0.5">
      <FeedbackButton kind="like" on={feedback === "like"} onPress={() => press("like")} />
      <FeedbackButton kind="dislike" on={feedback === "dislike"} onPress={() => press("dislike")} />
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy"}
        title={copied ? "Copied" : "Copy"}
        onClick={handleCopy}
        className={actionButton}
      >
        <Copy size={16} className={`${swap} ${copied ? "scale-50 -rotate-45 opacity-0" : shown}`} />
        <Check
          size={16}
          strokeWidth={2.5}
          className={`${swap} text-foreground ${copied ? shown : "scale-50 rotate-45 opacity-0"}`}
        />
      </button>
      <span className="ml-1.5 text-xs text-muted tabular-nums">{formatSeconds(seconds)}</span>
    </div>
  );
}

const FEEDBACK = {
  like: { Icon: ThumbsUp, label: "Good answer", animation: "motion-safe:animate-like" },
  dislike: { Icon: ThumbsDown, label: "Bad answer", animation: "motion-safe:animate-dislike" },
};

/** Like or dislike. Turning it on fills the thumb, which jumps (or drops) with a ring around it. */
function FeedbackButton({ kind, on, onPress }: { kind: Feedback; on: boolean; onPress: () => void }) {
  const { Icon, label, animation } = FEEDBACK[kind];
  const [pops, setPops] = useState(0); // A new key for each press that turns it on replays the animation.
  const [playing, setPlaying] = useState(false); // Dropped after, so it doesn't replay when the page shows again.

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={on}
      onClick={() => {
        if (!on) {
          setPops((count) => count + 1);
          setPlaying(true);
        }
        onPress();
      }}
      className={`${actionButton} aria-pressed:text-foreground`}
    >
      {on && playing && (
        <span
          key={`ring-${pops}`}
          aria-hidden
          className="absolute inset-1 rounded-full border-2 border-current opacity-0 motion-safe:animate-burst"
        />
      )}
      <Icon
        key={`icon-${pops}`}
        size={16}
        onAnimationEnd={() => setPlaying(false)}
        className={`transition-[fill] duration-200 ${on ? "fill-current" : "fill-transparent"} ${
          on && playing ? animation : ""
        }`}
      />
    </button>
  );
}

/** Copies to the clipboard, falling back to the old way over plain http (a phone on the LAN). */
async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }
}
