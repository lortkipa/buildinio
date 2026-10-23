"use client";

import { useEffect } from "react";

// How far one arrow key press moves a resize handle.
export const KEY_STEP = 16;

/*
 * A handle straddling the border of a resizable panel: the sidebar's right edge, or the preview's
 * left edge. A line shows on hover, on keyboard focus and while dragging. The panel owns the drag
 * (the pointer handlers) and the arrow keys; while dragging, the resize cursor stays and nothing
 * gets selected, wherever the pointer goes.
 */
export function ResizeHandle({
  label,
  controls,
  min,
  max,
  now,
  dragging,
  onPointerDown,
  onPointerMove,
  onDragEnd,
  onKeyDown,
  className,
}: {
  label: string;
  controls: string;
  min: number;
  max: number;
  now: number;
  dragging: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
  // Where it sits, e.g. "-right-1.5".
  className: string;
}) {
  useEffect(() => {
    if (!dragging) return;
    const { style } = document.body;
    style.cursor = "col-resize";
    style.userSelect = "none";
    style.webkitUserSelect = "none";
    return () => {
      style.cursor = "";
      style.userSelect = "";
      style.webkitUserSelect = "";
    };
  }, [dragging]);

  return (
    // biome-ignore lint/a11y/useSemanticElements: an <hr> can't hold the line inside
    <div
      role="separator"
      tabIndex={0}
      aria-label={label}
      aria-orientation="vertical"
      aria-controls={controls}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={now}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onDragEnd}
      onLostPointerCapture={onDragEnd}
      onKeyDown={onKeyDown}
      className={`group/handle absolute inset-y-0 z-20 w-3 cursor-col-resize touch-none outline-none ${className}`}
    >
      <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-brand-violet opacity-0 transition-opacity group-hover/handle:opacity-60 group-focus-visible/handle:opacity-100 group-data-dragging/handle:opacity-100" />
    </div>
  );
}
