import { useState } from "react";
import type { AnimationEvent } from "react";

/**
 * An animation class for something that just showed up, dropped once it has played.
 * Hidden pages stay in the document (cacheComponents) and CSS animations restart
 * when they're shown again, so without this everything would animate in again.
 */
export function usePlayOnce(animation: string, play = true) {
  const [playing, setPlaying] = useState(play);
  return {
    className: playing ? animation : "",
    onAnimationEnd: (event: AnimationEvent) => {
      if (event.target === event.currentTarget) setPlaying(false);
    },
  };
}
