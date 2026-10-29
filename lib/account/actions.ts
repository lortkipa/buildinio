"use server";

// What the settings ask the server to do. Each one checks who's asking and what it's given.

import { cleanName, DEFAULT_AVATAR, isTheme, MAX_AVATAR_BYTES, MAX_NAME } from "@/lib/account/options";
import * as account from "@/lib/account/server";
import { getCurrentUser } from "@/lib/auth/session";

export async function renameAccount(name: unknown) {
  const user = await getCurrentUser();
  const value = cleanName(name);
  if (user && value && value.length <= MAX_NAME) account.updateUser(user.id, { name: value });
}

export async function setTheme(theme: unknown) {
  const user = await getCurrentUser();
  if (user && isTheme(theme)) account.updateUser(user.id, { theme });
}

export async function setAutocorrect(on: unknown) {
  const user = await getCurrentUser();
  if (user && typeof on === "boolean") account.updateUser(user.id, { autocorrect: on });
}

export type AvatarResult = { avatarUrl: string } | { error: string };

/** The cropped picture from the settings, as `avatar` in the form. */
export async function uploadAvatar(form: FormData): Promise<AvatarResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You’re not logged in." };
  const file = form.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Pick a picture first." };
  if (file.size > MAX_AVATAR_BYTES) return { error: "That picture is too big." };
  const data = Buffer.from(await file.arrayBuffer());
  const type = account.imageType(data);
  if (!type) return { error: "Use a PNG, JPEG or WebP picture." };
  return { avatarUrl: account.saveAvatar(user.id, data, type) };
}

export async function removeAvatar(): Promise<AvatarResult> {
  const user = await getCurrentUser();
  if (!user) return { error: "You’re not logged in." };
  account.removeAvatar(user.id);
  return { avatarUrl: DEFAULT_AVATAR };
}
