/*
 * The desktop sidebar's width and whether it is collapsed. Kept in a cookie, so the server renders
 * the sidebar as the user left it and nothing jumps once the page loads. Imported by the server
 * (reading) and the browser (writing), so nothing here may use either one's APIs.
 */

export const SIDEBAR_COOKIE = "sidebar";

// In pixels. The width can be dragged between MIN_WIDTH and MAX_WIDTH.
export const DEFAULT_WIDTH = 260;
export const MIN_WIDTH = 200;
export const MAX_WIDTH = 400;
// Dragged narrower than this, the sidebar collapses to the rail; dragged wider again, it expands.
export const COLLAPSE_BELOW = 140;
// The collapsed sidebar: icons only. 40px buttons with 8px on each side.
export const RAIL_WIDTH = 56;

// width is the expanded width, also remembered while collapsed.
export type SidebarState = { width: number; collapsed: boolean };

export const clampWidth = (width: number) =>
  Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(width)));

// The cookie's value: the width, then ":collapsed" when collapsed, e.g. "260:collapsed".
export function parseSidebarState(value: string | undefined): SidebarState {
  const [width = "", flag] = (value ?? "").split(":");
  const number = Number.parseInt(width, 10);
  return {
    width: Number.isNaN(number) ? DEFAULT_WIDTH : clampWidth(number),
    collapsed: flag === "collapsed",
  };
}

export function serializeSidebarState({ width, collapsed }: SidebarState) {
  return collapsed ? `${width}:collapsed` : `${width}`;
}
