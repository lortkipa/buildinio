import "server-only";
import { eq } from "drizzle-orm";
import { DEFAULT_AVATAR } from "@/lib/account/options";
import type { Theme } from "@/lib/account/options";
import { db } from "@/lib/db";
import { avatars, users } from "@/lib/db/schema";
import { newId } from "@/lib/projects/ids";

// The signed-in user's own settings in the database. Their projects are in lib/projects.

const AVATAR_PATH = "/api/avatars/"; // Served by app/api/avatars/[id].

export function updateUser(id: string, changes: Partial<{ name: string; theme: Theme; autocorrect: boolean }>) {
  db.update(users).set(changes).where(eq(users.id, id)).run();
}

/** The picture's type from its first bytes, or null if it isn't a PNG, JPEG or WebP. */
export function imageType(data: Buffer) {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (data.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return "image/jpeg";
  if (data.toString("latin1", 0, 4) === "RIFF" && data.toString("latin1", 8, 12) === "WEBP") return "image/webp";
  return null;
}

/** Makes the picture the user's avatar, in place of any they uploaded before. Returns its address. */
export function saveAvatar(userId: string, data: Buffer, contentType: string) {
  const id = newId();
  const avatarUrl = AVATAR_PATH + id;
  db.transaction((tx) => {
    tx.delete(avatars).where(eq(avatars.userId, userId)).run();
    tx.insert(avatars).values({ id, userId, contentType, data, createdAt: new Date() }).run();
    tx.update(users).set({ avatarUrl }).where(eq(users.id, userId)).run();
  });
  return avatarUrl;
}

/** Back to the default avatar. */
export function removeAvatar(userId: string) {
  db.transaction((tx) => {
    tx.delete(avatars).where(eq(avatars.userId, userId)).run();
    tx.update(users).set({ avatarUrl: DEFAULT_AVATAR }).where(eq(users.id, userId)).run();
  });
}

export function getAvatar(id: string) {
  return db.select({ contentType: avatars.contentType, data: avatars.data }).from(avatars).where(eq(avatars.id, id)).get() ?? null;
}
