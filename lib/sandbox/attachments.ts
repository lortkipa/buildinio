import "server-only";
import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { extension } from "@/lib/projects/attachments";
import { attachmentData, projectAttachments } from "@/lib/projects/server";
import type { Attachment } from "@/lib/projects/types";
import { projectDir } from "@/lib/sandbox/workspace";

// The files attached in a project's chat, as copies in its folder (attachments/), so the
// AI can use them in the app: a logo, photos, a menu. Not part of the app's source (see
// files.ts) and not built, so nothing in them is published unless the AI copies it in.

export const ATTACHMENTS_DIR = "attachments";

/**
 * Where each file is in the project, like "attachments/logo.png": by name, in the order
 * they were sent, so a file keeps its place as more are attached. Clashing names get a number.
 */
export function attachmentPaths(files: Attachment[]) {
  const taken = new Set<string>();
  const paths = new Map<string, string>();
  for (const file of files) {
    const name = safeName(file.name);
    const ext = extension(name);
    const stem = ext ? name.slice(0, -ext.length - 1) : name;
    let candidate = name;
    for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = ext ? `${stem}-${n}.${ext}` : `${stem}-${n}`;
    taken.add(candidate.toLowerCase());
    paths.set(file.id, `${ATTACHMENTS_DIR}/${candidate}`);
  }
  return paths;
}

/**
 * Makes attachments/ hold the project's files and nothing else: missing ones are written,
 * and ones no longer in the chat (a stopped prompt's) are removed. Returns their paths.
 */
export async function syncAttachments(projectId: string) {
  const files = projectAttachments(projectId);
  const paths = attachmentPaths(files);
  const folder = path.join(projectDir(projectId), ATTACHMENTS_DIR);
  const wanted = new Set([...paths.values()].map((relative) => path.basename(relative)));

  const entries = await readdir(folder).catch(() => []);
  for (const entry of entries) {
    if (!wanted.has(entry)) await rm(path.join(folder, entry), { recursive: true, force: true });
  }
  const missing = [];
  for (const file of files) {
    const info = await stat(path.join(folder, path.basename(paths.get(file.id)!))).catch(() => null);
    if (!info?.isFile() || info.size !== file.size) missing.push(file.id);
  }
  if (missing.length) {
    await mkdir(folder, { recursive: true });
    const data = attachmentData(missing);
    for (const id of missing) {
      const bytes = data.get(id);
      if (bytes) await writeFile(path.join(folder, path.basename(paths.get(id)!)), bytes);
    }
  }
  return paths;
}

/** A name that's fine in a command line: letters, numbers, dots, dashes and underscores. */
function safeName(name: string) {
  const clean = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // "é" is "e" and an accent.
    .replace(/[^\w.-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .slice(-80)
    .replace(/^[-.]+|[-.]+$/g, "");
  return clean || "file";
}
