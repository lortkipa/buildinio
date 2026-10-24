// Text buttons: Cancel, the main action, an action that can't be undone, and any other (outlined).
// In their own module, not dialog.tsx (a client module), so server components can use them too.
const BUTTON =
  "h-10 rounded-full px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-violet disabled:cursor-not-allowed disabled:opacity-40";
export const CANCEL_BUTTON = `${BUTTON} text-zinc-700 hover:bg-zinc-950/5 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white`;
export const PRIMARY_BUTTON = `${BUTTON} bg-zinc-950 text-white shadow-sm hover:bg-zinc-800 disabled:hover:bg-zinc-950 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200 dark:disabled:hover:bg-white`;
export const DANGER_BUTTON = `${BUTTON} bg-red-600 text-white shadow-sm hover:bg-red-500 disabled:hover:bg-red-600`;
export const SECONDARY_BUTTON = `${BUTTON} border border-zinc-950/10 bg-white text-zinc-950 shadow-sm hover:bg-zinc-50 dark:border-white/10 dark:bg-white/5 dark:text-zinc-50 dark:hover:bg-white/10`;
