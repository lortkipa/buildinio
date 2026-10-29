import { useEffect, useState } from "react";
import { useReducedMotion } from "@/components/AppearanceProvider";

/**
 * The part of `text` that has streamed in: one more letter every `charMs` since
 * `startedAt`. Based on the clock, so it's in the right place after you leave the
 * page and come back. Without `startedAt` it's all there at once.
 */
export function useStreamed(text: string, startedAt: number | undefined, charMs: number) {
  const reducedMotion = useReducedMotion();
  const end = startedAt === undefined || reducedMotion ? 0 : startedAt + text.length * charMs;
  const now = useFrameTime(end);
  if (startedAt === undefined || now >= end) return text;
  return text.slice(0, Math.max(0, Math.floor((now - startedAt) / charMs)));
}

/** The time, re-rendering every frame until `until` has passed. */
function useFrameTime(until: number) {
  const [now, setNow] = useState(() => Date.now());
  const running = now < until;

  useEffect(() => {
    if (!running) return;
    let frame = requestAnimationFrame(function tick() {
      const time = Date.now();
      setNow(time);
      if (time < until) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [running, until]);

  return now;
}

/** The time, re-rendering every `everyMs` while `active`. */
export function useNow(active: boolean, everyMs: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!active) return;
    let timer = window.setTimeout(function tick() {
      setNow(Date.now());
      timer = window.setTimeout(tick, everyMs);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [active, everyMs]);

  return now;
}

/** "12s", or "1m 05s" from a minute up. */
export function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, "0")}s`;
}
