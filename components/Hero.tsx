"use client";

import { useRef } from "react";
import { PromptBox } from "@/components/PromptBox";
import { useKeyboardDock } from "@/components/useKeyboardDock";

const TEXT_GAP = 12; // Space between the top of the visible area and the headline while docked.

export function Hero() {
  const heroRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dock = useKeyboardDock(textareaRef, heroRef);

  return (
    <div
      ref={heroRef}
      style={dock ? { height: dock.keptHeight } : undefined}
      className="flex w-full flex-col items-center"
    >
      {/* While the phone keyboard is open, keep the text at the top of what's
          visible. The prompt box sits on top of it if it grows that far. */}
      <div
        style={
          dock
            ? {
                position: "fixed",
                left: dock.boxLeft,
                width: dock.boxWidth,
                top: dock.visibleTop + TEXT_GAP,
              }
            : undefined
        }
        className="flex flex-col items-center"
      >
        <h1
          className={`max-w-3xl leading-tight font-semibold tracking-[-0.02em] text-balance motion-safe:animate-rise ${
            dock ? "text-3xl" : "text-4xl sm:text-5xl lg:text-[3.5rem]"
          }`}
        >
          Build an app by describing it
        </h1>
        <p
          className={`max-w-xl text-base text-balance text-muted motion-safe:animate-rise motion-safe:[animation-delay:80ms] sm:text-lg ${
            dock ? "mt-2" : "mt-4"
          }`}
        >
          Type what you need, like you&rsquo;d tell a friend.
        </p>
      </div>
      <PromptBox
        textareaRef={textareaRef}
        dock={dock}
        className="mt-10 motion-safe:animate-rise motion-safe:[animation-delay:160ms]"
      />
    </div>
  );
}
