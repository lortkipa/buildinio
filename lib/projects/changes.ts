import "server-only";

// Who's watching a project's app from its share page (app/api/share/[id]), so the page
// follows it without a refresh: a new build, the app turning private or public, or its
// deletion.

type Listener = () => void;

// Kept on globalThis, so reloading this module in development doesn't lose them (like lib/ai/registry.ts).
const scope = globalThis as typeof globalThis & { buildinioAppWatchers?: Map<string, Set<Listener>> };
const watchers = (scope.buildinioAppWatchers ??= new Map<string, Set<Listener>>());

/** Calls `listener` whenever the project's app changes. Returns a function that stops it. */
export function watchApp(projectId: string, listener: Listener) {
  const set = watchers.get(projectId) ?? new Set<Listener>();
  set.add(listener);
  watchers.set(projectId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0 && watchers.get(projectId) === set) watchers.delete(projectId);
  };
}

/** The project's app was built, made private or public, or deleted. Each watcher checks what its viewer may see. */
export function announceChange(projectId: string) {
  watchers.get(projectId)?.forEach((listener) => listener());
}
