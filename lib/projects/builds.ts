import "server-only";

// Who's waiting for a project's next build: its share page (app/api/share/[id]), so the app
// there updates without a refresh, like the preview does.

type Listener = (appVersion: number) => void;

// Kept on globalThis, so reloading this module in development doesn't lose them (like lib/ai/registry.ts).
const scope = globalThis as typeof globalThis & { buildinioBuilds?: Map<string, Set<Listener>> };
const watchers = (scope.buildinioBuilds ??= new Map<string, Set<Listener>>());

/** Calls `listener` with each new app version of the project. Returns a function that stops it. */
export function watchBuilds(projectId: string, listener: Listener) {
  const set = watchers.get(projectId) ?? new Set<Listener>();
  set.add(listener);
  watchers.set(projectId, set);
  return () => {
    set.delete(listener);
    if (set.size === 0 && watchers.get(projectId) === set) watchers.delete(projectId);
  };
}

/** A new version of the project's app was built. */
export function announceBuild(projectId: string, appVersion: number) {
  watchers.get(projectId)?.forEach((listener) => listener(appVersion));
}
