export const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

// Two icons stacked in one grid cell that swap places: the hidden one shrinks,
// turns and fades out. Add `shown` to the visible one.
export const swap = "col-start-1 row-start-1 transition duration-200 ease-out motion-reduce:transition-none";
export const shown = "scale-100 rotate-0 opacity-100";

// Round icon buttons in the chat header, on a surface so they stand out from what scrolls under them.
export const circleButton = `grid size-10 cursor-pointer place-items-center rounded-full bg-surface text-muted transition-colors hover:bg-foreground/5 hover:text-foreground ${focusRing}`;

// A tab or project in the sidebar.
export const navItem = `flex h-10 w-full cursor-pointer items-center gap-3 overflow-hidden rounded-xl px-2.5 text-left text-sm font-medium text-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground aria-[current=page]:bg-foreground/5 aria-[current=page]:text-foreground ${focusRing}`;

// Pop-up menus, like the account menu, and their items.
export const menuPanel =
  "rounded-2xl border border-border bg-surface p-1.5 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_32px_-12px_rgb(0_0_0/0.18)] motion-safe:animate-pop";
export const menuItem = `flex h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition-colors hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-60 ${focusRing}`;

// Modal dialogs (`<dialog>` opened with showModal; add a max width) and their buttons.
export const dialogPanel =
  "m-auto w-[calc(100%-2rem)] rounded-3xl border border-border bg-surface p-6 text-left text-foreground shadow-[0_24px_64px_-16px_rgb(0_0_0/0.35)] backdrop:bg-black/40 open:motion-safe:animate-pop";
export const dialogButton = `flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:flex-1 ${focusRing}`;

// The ⋯ button on a project row (a `group/row`), and how it shows only on hover or focus
// with a mouse (it's always there on touch screens).
export const rowOptions = `grid size-8 cursor-pointer place-items-center rounded-lg text-muted transition hover:bg-foreground/5 hover:text-foreground aria-expanded:bg-foreground/5 aria-expanded:text-foreground ${focusRing}`;
export const rowOptionsOnHover =
  "pointer-fine:opacity-0 pointer-fine:group-focus-within/row:opacity-100 pointer-fine:group-hover/row:opacity-100 pointer-fine:aria-expanded:opacity-100";
