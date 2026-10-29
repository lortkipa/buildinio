import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import * as actions from "@/lib/account/actions";
import type { AvatarResult } from "@/lib/account/actions";
import type { Theme } from "@/lib/account/options";
import type { CurrentUser } from "@/lib/auth/session";

// The signed-in user and their settings, as the server keeps them (lib/account/server.ts).
// A store outside React, like the projects' (lib/projects/store.ts): the sidebar, the
// prompt boxes, the toasts and the settings all see a change at once, hidden pages too.

let account: CurrentUser | null = null; // Null on the server and until the shared layout hands it in.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function set(next: CurrentUser | null) {
  account = next;
  listeners.forEach((listener) => listener());
}

function change(changes: Partial<CurrentUser>) {
  if (account) set({ ...account, ...changes });
}

/** Takes in the user as the shared layout read them. Does nothing if they're already in. */
export function loadAccount(user: CurrentUser) {
  if (account?.id !== user.id) set(user);
}

/** After logging out or deleting the account. */
export function forgetAccount() {
  set(null);
}

/** The user as this tab has them; `user` (from the server) until the store has them. */
export function useAccount(user: CurrentUser) {
  const stored = useSyncExternalStore(subscribe, () => account, () => null);
  return stored?.id === user.id ? stored : user;
}

/** The theme to show: the system's when nobody is signed in. */
export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, () => account?.theme ?? "system", () => "system");
}

/** Whether the prompt box checks spelling: on unless the signed-in user turned it off. */
export function useAutocorrect() {
  return useSyncExternalStore(subscribe, () => account?.autocorrect ?? true, () => true);
}

export function renameAccount(name: string) {
  change({ name });
  save(actions.renameAccount(name));
}

export function setTheme(theme: Theme) {
  change({ theme });
  save(actions.setTheme(theme));
}

export function setAutocorrect(autocorrect: boolean) {
  change({ autocorrect });
  save(actions.setAutocorrect(autocorrect));
}

/** Uploads the cropped picture; it shows once the server has it. */
export async function uploadAvatar(picture: Blob) {
  const form = new FormData();
  form.set("avatar", picture);
  return showAvatar(actions.uploadAvatar(form));
}

export async function removeAvatar() {
  return showAvatar(actions.removeAvatar());
}

async function showAvatar(request: Promise<AvatarResult>) {
  const result = await request.catch(() => ({ error: "Couldn’t save your photo. Check your connection and try again." }));
  if ("error" in result) {
    toast.error(result.error);
    return false;
  }
  change({ avatarUrl: result.avatarUrl });
  return true;
}

/** Changes show right away; if the server didn't get one, say so. */
function save(request: Promise<unknown>) {
  request.catch(() => toast.error("That change wasn’t saved. Check your connection and try again."));
}
