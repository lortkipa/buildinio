"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { PromptBox } from "@/components/PromptBox";
import { DOCK_TEXT_GAP, useKeyboardDock } from "@/components/useKeyboardDock";

type HeroProps = {
  title: ReactNode;
  subtitle?: ReactNode; // Without one the title is a bit smaller, like a greeting.
  signedIn?: boolean;
};

/** The headline and the prompt box, centered on the page. */
export function Hero({ title, subtitle, signedIn = false }: HeroProps) {
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
                top: dock.visibleTop + DOCK_TEXT_GAP,
              }
            : undefined
        }
        className="flex flex-col items-center"
      >
        <h1
          className={`max-w-3xl leading-tight font-semibold tracking-[-0.02em] text-balance motion-safe:animate-rise ${
            dock ? "text-3xl" : subtitle ? "text-4xl sm:text-5xl lg:text-[3.5rem]" : "text-3xl sm:text-4xl"
          }`}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={`max-w-xl text-base text-balance text-muted motion-safe:animate-rise motion-safe:[animation-delay:80ms] sm:text-lg ${
              dock ? "mt-2" : "mt-4"
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>
      <PromptBox
        textareaRef={textareaRef}
        dock={dock}
        signedIn={signedIn}
        className={`motion-safe:animate-rise motion-safe:[animation-delay:160ms] ${
          subtitle ? "mt-10" : "mt-8"
        }`}
      />
    </div>
  );
}
