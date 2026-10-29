import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { asc, eq, sql } from "drizzle-orm";
import { strToU8, zipSync } from "fflate";
import type { Zippable } from "fflate";
import { DEFAULT_AVATAR } from "@/lib/account/options";
import { db } from "@/lib/db";
import { accounts, avatars, messages, projects, users } from "@/lib/db/schema";
import { listFiles } from "@/lib/sandbox/files";
import { projectDir } from "@/lib/sandbox/workspace";

// Everything a user has here, as a .zip: their account and settings, and each project
// with its chat and its code (the source, without node_modules or the built app).

const MAX_FILE_BYTES = 10_000_000; // Commands can leave big files behind; the AI's own are far smaller.
const EXTENSIONS: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

export async function exportAccount(userId: string) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return null;
  const files: Zippable = {};

  const avatar = db.select().from(avatars).where(eq(avatars.userId, userId)).get();
  const avatarFile = avatar ? `avatar.${EXTENSIONS[avatar.contentType] ?? "img"}` : null;
  const signIns = db
    .select({ provider: accounts.provider, createdAt: accounts.createdAt })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .all();
  files["account.json"] = json({
    name: user.name,
    email: user.email,
    avatar: avatarFile ?? (user.avatarUrl === DEFAULT_AVATAR ? null : user.avatarUrl),
    createdAt: user.createdAt.toISOString(),
    settings: { theme: user.theme, autocorrect: user.autocorrect },
    linkedAccounts: signIns.map((account) => ({ provider: account.provider, linkedAt: account.createdAt.toISOString() })),
    exportedAt: new Date().toISOString(),
  });
  if (avatar && avatarFile) files[avatarFile] = [new Uint8Array(avatar.data), { level: 0 }];

  const taken = new Set<string>();
  const rows = db.select().from(projects).where(eq(projects.userId, userId)).orderBy(asc(projects.createdAt)).all();
  for (const project of rows) {
    const folder = `projects/${folderName(project.name, taken)}`;
    const chat = db
      .select()
      .from(messages)
      .where(eq(messages.projectId, project.id))
      .orderBy(asc(messages.createdAt), sql`rowid`)
      .all();
    files[`${folder}/project.json`] = json({
      name: project.name,
      icon: project.icon,
      color: project.color,
      createdAt: project.createdAt.toISOString(),
      chat: chat.map((message) => ({
        role: message.role,
        text: message.text,
        sentAt: message.createdAt.toISOString(),
        ...(message.role === "assistant" && { seconds: message.seconds, feedback: message.feedback }),
      })),
    });

    const dir = projectDir(project.id);
    for (const file of await listFiles(dir)) {
      if (file.size > MAX_FILE_BYTES) continue;
      const data = await readFile(path.join(dir, file.path)).catch(() => null);
      if (data) files[`${folder}/code/${file.path}`] = new Uint8Array(data);
    }
  }

  return zipSync(files, { level: 6 });
}

function json(value: unknown) {
  return strToU8(`${JSON.stringify(value, null, 2)}\n`);
}

/** "My Recipe App" → "my-recipe-app", in any script; numbered when two projects share a name. */
function folderName(name: string | null, taken: Set<string>) {
  const base =
    (name ?? "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "untitled";
  let folder = base;
  for (let n = 2; taken.has(folder); n++) folder = `${base}-${n}`;
  taken.add(folder);
  return folder;
}
