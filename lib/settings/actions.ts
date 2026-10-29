"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { getCurrentUser } from "@/lib/auth/session";
import { DEFAULT_AVATAR } from "@/lib/auth/signup";
import { db } from "@/lib/db";
import { userPhotos, users } from "@/lib/db/schema";
import { MAX_NAME, MAX_PHOTO_BYTES, THEMES, type Theme } from "@/lib/settings";

export async function saveProfile(form: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again to save your profile." };
  const value = form.get("name");
  const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > MAX_NAME) return { error: `Enter a name between 1 and ${MAX_NAME} characters.` };

  const file = form.get("photo");
  let photo: Buffer | undefined;
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PHOTO_BYTES) return { error: "Choose a photo smaller than 2 MB." };
    try {
      const image = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 16_000_000 });
      const metadata = await image.metadata();
      if (!["jpeg", "png", "webp"].includes(metadata.format ?? "")) {
        return { error: "Choose a JPG, PNG or WebP photo." };
      }
      photo = await image.rotate().resize(256, 256, { fit: "cover" }).webp({ quality: 85 }).toBuffer();
    } catch {
      return { error: "We couldn’t read that photo. Choose a different JPG, PNG or WebP." };
    }
  }

  db.transaction((tx) => {
    let avatarUrl = user.avatarUrl;
    if (photo) {
      tx.insert(userPhotos).values({ userId: user.id, data: photo })
        .onConflictDoUpdate({ target: userPhotos.userId, set: { data: photo } }).run();
      avatarUrl = `/api/account/photo?v=${randomUUID()}`;
    } else if (form.get("removePhoto") === "true") {
      tx.delete(userPhotos).where(eq(userPhotos.userId, user.id)).run();
      avatarUrl = DEFAULT_AVATAR;
    }
    // Email is deliberately never accepted from the form.
    tx.update(users).set({ name, avatarUrl }).where(eq(users.id, user.id)).run();
  });
  revalidatePath("/", "layout");
  return {};
}

export async function saveAppearance(value: unknown): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: "Please log in again to save your preferences." };
  if (!value || typeof value !== "object" || !("theme" in value) || !("reducedMotion" in value) ||
    !THEMES.includes(value.theme as Theme) || typeof value.reducedMotion !== "boolean") {
    return { error: "Choose a valid theme and motion preference." };
  }
  db.update(users).set({ theme: value.theme as Theme, reducedMotion: value.reducedMotion })
    .where(eq(users.id, user.id)).run();
  revalidatePath("/", "layout");
  return {};
}
