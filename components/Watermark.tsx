"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X } from "lucide-react";
import mark from "@/brand/mark.svg";
import markDark from "@/brand/mark-dark.svg";
import { focusRing } from "@/components/styles";

/**
 * "Build with Buildinio" over the bottom right of an app opened from its share link,
 * leading here. Its X hides it until the page is opened again.
 */
export function Watermark() {
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;

  return (
    <aside
      aria-label="Buildinio"
      className="fixed right-[max(0.75rem,env(safe-area-inset-right))] bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 flex items-center gap-0.5 rounded-full border border-border bg-surface p-1 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.18)] motion-safe:animate-enter"
    >
      <Link
        href="/"
        target="_blank"
        rel="noopener"
        className={`flex h-8 items-center gap-2 rounded-full pr-2.5 pl-2 text-sm font-medium transition-colors hover:bg-foreground/5 ${focusRing}`}
      >
        <Image src={mark} alt="" className="size-4 dark:hidden" />
        <Image src={markDark} alt="" className="hidden size-4 dark:block" />
        Build with Buildinio
      </Link>
      <button
        type="button"
        aria-label="Hide"
        onClick={() => setHidden(true)}
        className={`grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-muted transition-colors hover:bg-foreground/5 hover:text-foreground ${focusRing}`}
      >
        <X size={14} />
      </button>
    </aside>
  );
}
