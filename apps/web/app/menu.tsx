"use client";

/*
 * Pieces shared by the popover menus: the account menu (user-menu.tsx) and a project's menu
 * (project-menu.tsx).
 */

// A menu's box, e.g. a submenu inside a menu.
export const MENU_BOX =
  "rounded-2xl border border-zinc-950/10 bg-white/90 p-1.5 text-sm text-zinc-950 shadow-xl shadow-zinc-950/10 backdrop-blur-xl dark:border-white/10 dark:bg-zinc-900/90 dark:text-zinc-50 dark:shadow-black/40";

// A menu: a popover, drawn above everything at a fixed position, growing in as it opens.
export const MENU_SURFACE = `${MENU_BOX} inset-auto m-0 transition-[opacity,scale] duration-150 ease-out starting:open:scale-95 starting:open:opacity-0 motion-reduce:transition-none`;

// Between a menu and what opened it.
export const MENU_GAP = 8;

// The closest a menu comes to the edges of the screen.
const EDGE = 8;

/*
 * Places a menu of the given width next to rect: below it with their left edges lined up, or above
 * it when there's less room below, and moved left as far as needed to stay on screen. rect can be
 * a point, e.g. where the user right-clicked. Call it before the menu opens.
 */
export function placeMenu(
  menu: HTMLElement,
  rect: { top: number; bottom: number; left: number },
  width: number,
  gap = MENU_GAP,
) {
  // The viewport without scrollbars, which fixed positions are measured in.
  const { clientWidth, clientHeight } = document.documentElement;
  const { style } = menu;
  const left = Math.max(EDGE, Math.min(rect.left, clientWidth - width - EDGE));
  style.left = `${left}px`;
  if (clientHeight - rect.bottom >= rect.top) {
    style.top = `${rect.bottom + gap}px`;
    style.bottom = "auto";
    style.transformOrigin = "top left";
  } else {
    style.top = "auto";
    style.bottom = `${clientHeight - rect.top + gap}px`;
    style.transformOrigin = "bottom left";
  }
  return left;
}

/*
 * Arrow keys, Home and End move between the menu's own items (not those of a submenu inside it).
 * Tab leaves the menu: close it, which puts focus back on the trigger, and Tab goes on from there.
 */
export function handleMenuKeyDown(event: React.KeyboardEvent<HTMLElement>, close: () => void) {
  const menu = event.currentTarget;
  if ((event.target as HTMLElement).closest('[role="menu"]') !== menu) return;
  const items = [...menu.querySelectorAll<HTMLElement>('[role="menuitem"]')].filter(
    (item) => item.closest('[role="menu"]') === menu,
  );
  const index = items.indexOf(document.activeElement as HTMLElement);
  let next: number;
  if (event.key === "ArrowDown") next = (index + 1) % items.length;
  else if (event.key === "ArrowUp") next = index <= 0 ? items.length - 1 : index - 1;
  else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = items.length - 1;
  else {
    if (event.key === "Tab") close();
    return;
  }
  event.preventDefault();
  items[next]?.focus();
}

const ITEM =
  "flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left outline-none transition-colors aria-disabled:cursor-default";
const ITEM_TONE = {
  normal:
    "text-zinc-700 hover:bg-zinc-950/5 hover:text-zinc-950 focus-visible:bg-zinc-950/5 focus-visible:text-zinc-950 aria-expanded:bg-zinc-950/5 aria-expanded:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:bg-white/10 dark:focus-visible:text-white dark:aria-expanded:bg-white/10 dark:aria-expanded:text-white",
  danger:
    "text-red-600 hover:bg-red-600/10 focus-visible:bg-red-600/10 dark:text-red-400 dark:hover:bg-red-400/10 dark:focus-visible:bg-red-400/10",
};

// An item: its icon, its name, and optionally something at the end, e.g. a submenu's arrow.
export function MenuItem({
  icon,
  trailing,
  danger = false,
  busy = false,
  children,
  ...props
}: {
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  danger?: boolean;
  busy?: boolean;
  children: React.ReactNode;
} & Omit<React.ComponentProps<"button">, "className" | "type" | "role">) {
  return (
    <button
      type="button"
      role="menuitem"
      aria-disabled={busy}
      className={`${ITEM} ${ITEM_TONE[danger ? "danger" : "normal"]}`}
      {...props}
    >
      {icon}
      <span className="flex-1">{children}</span>
      {trailing}
    </button>
  );
}
