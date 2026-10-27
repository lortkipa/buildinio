// The signed-in sidebar's size, shared by the page (reads the cookies) and the sidebar (writes them).

export const SIDEBAR_WIDTH_COOKIE = "sidebar_width";
export const SIDEBAR_COLLAPSED_COOKIE = "sidebar_collapsed";

// Widths in px.
export const COLLAPSED_WIDTH = 56; // Icons only.
export const DEFAULT_WIDTH = 260;
export const MIN_WIDTH = 180; // Narrowest it gets while open.
export const MAX_WIDTH = 400;
export const COLLAPSE_AT = 140; // Dragging narrower than this collapses it.

export type SidebarState = {
  width: number; // Width while open, kept while collapsed so it reopens the same.
  collapsed: boolean;
};

export function clampWidth(width: number) {
  return Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width)));
}

/** The saved sidebar state from its cookie values, or the defaults. */
export function parseSidebar(width: string | undefined, collapsed: string | undefined): SidebarState {
  const value = Number(width);
  return {
    width: Number.isFinite(value) && width ? clampWidth(value) : DEFAULT_WIDTH,
    collapsed: collapsed === "1",
  };
}
