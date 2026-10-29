// The shimmer's length (animate-shimmer in globals.css), and how far behind the one
// before it each bone's sweep runs, so the light moves down the page in a wave.
const SHIMMER_MS = 2000;
const WAVE_MS = 70;

/** A grey block standing in for part of an app being built; `at` is its place in the wave. */
export function Bone({ at, className }: { at: number; className: string }) {
  return (
    <span
      style={{ animationDelay: `${at * WAVE_MS - SHIMMER_MS}ms` }}
      className={`skeleton block motion-safe:animate-shimmer ${className}`}
    />
  );
}
