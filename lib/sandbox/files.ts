import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

// The AI's file tools, kept inside the project's folder. Paths are relative, with
// forward slashes, like "src/App.tsx". Installed packages (node_modules) and the
// built app (dist) are made by npm, not written by hand. The files people attached
// (attachments/) aren't the app's source: they can be read, not changed.

const MAX_FILE_BYTES = 200_000;
const MAX_PROJECT_BYTES = 5_000_000; // Source only, not node_modules or dist, nor pictures and media (MEDIA).
const MAX_PATH = 200;
const MANAGED = new Set(["node_modules", ".git"]); // Anywhere. Plus dist/ at the top.
const OUTSIDE = new Set(["dist", "attachments"]); // At the top: not source files.
// Copied in from attachments/, not written by the AI, so they don't count toward the limit.
const MEDIA = /\.(png|jpe?g|webp|gif|avif|bmp|ico|tiff?|heic|mp3|wav|ogg|m4a|mp4|webm|mov|woff2?|ttf|otf|pdf)$/i;

/** Something the AI got wrong, like a file that isn't there. It's told, and can try again. */
export class FileError extends Error {}

export type FileInfo = { path: string; size: number; mtimeMs: number };

/** The project's source files, sorted. */
export async function listFiles(dir: string): Promise<FileInfo[]> {
  const files: FileInfo[] = [];
  async function walk(folder: string, prefix: string) {
    const entries = await readdir(folder, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      // Links are skipped: one made by a command could point anywhere.
      if (entry.isSymbolicLink() || MANAGED.has(entry.name) || (!prefix && OUTSIDE.has(entry.name))) continue;
      const full = path.join(folder, entry.name);
      const relative = prefix + entry.name;
      if (entry.isDirectory()) {
        await walk(full, `${relative}/`);
      } else if (entry.isFile()) {
        const { size, mtimeMs } = await stat(full);
        files.push({ path: relative, size, mtimeMs });
      }
    }
  }
  await walk(dir, "");
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

/** Changes whenever a source file is added, removed or changed. */
export async function fingerprint(dir: string) {
  const files = await listFiles(dir);
  return createHash("sha256")
    .update(files.map((file) => `${file.path}:${file.size}:${file.mtimeMs}`).join("\n"))
    .digest("hex");
}

export async function readText(dir: string, file: string) {
  const { full, clean } = await resolve(dir, file);
  const info = await stat(full).catch(() => null);
  if (!info) throw new FileError(`${clean} doesn't exist.`);
  if (info.isDirectory()) throw new FileError(`${clean} is a folder.`);
  if (info.size > MAX_FILE_BYTES) throw new FileError(`${clean} is too big to read (${info.size} bytes).`);
  return readFile(full, "utf8");
}

/** Creates or replaces a file. Returns whether it's new and how many lines changed. */
export async function writeText(dir: string, file: string, content: string) {
  const { full, clean } = await resolve(dir, file, true);
  const before = await readFile(full, "utf8").catch(() => null);
  await checkSize(dir, clean, content, before);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, content);
  return { created: before === null, ...lineChanges(before ?? "", content) };
}

/** Replaces `oldText`, which has to appear exactly once, with `newText`. */
export async function editText(dir: string, file: string, oldText: string, newText: string) {
  const { full, clean } = await resolve(dir, file, true);
  const before = await readText(dir, clean);
  const count = oldText ? before.split(oldText).length - 1 : 0;
  if (count === 0) throw new FileError(`The text to replace isn't in ${clean}. Read the file and try again.`);
  if (count > 1) {
    throw new FileError(`The text to replace appears ${count} times in ${clean}. Include more of the lines around it.`);
  }
  const after = before.replace(oldText, () => newText);
  await checkSize(dir, clean, after, before);
  await writeFile(full, after);
  return lineChanges(before, after);
}

/** Deletes a file or a folder. Returns how many lines went with it. */
export async function deletePath(dir: string, file: string) {
  const { full, clean } = await resolve(dir, file, true);
  const info = await stat(full).catch(() => null);
  if (!info) throw new FileError(`${clean} doesn't exist.`);
  const before = info.isFile() && info.size <= MAX_FILE_BYTES ? await readFile(full, "utf8") : "";
  await rm(full, { recursive: true, force: true });
  return lineChanges(before, "");
}

/** Lines added and removed, counting lines rather than finding a real diff: good enough for "+12 −3". */
export function lineChanges(before: string, after: string) {
  const left = new Map<string, number>();
  for (const line of lines(before)) left.set(line, (left.get(line) ?? 0) + 1);
  let added = 0;
  for (const line of lines(after)) {
    const count = left.get(line) ?? 0;
    if (count > 0) left.set(line, count - 1);
    else added++;
  }
  let removed = 0;
  left.forEach((count) => (removed += count));
  return { added, removed };
}

function lines(text: string) {
  return text === "" ? [] : text.replace(/\n$/, "").split("\n");
}

/** `file` within the project folder, or a FileError saying what's wrong with it. `change`: it's to be written or deleted. */
async function resolve(dir: string, file: string, change = false) {
  const clean = String(file).trim().replace(/\\/g, "/").replace(/^(\.\/)+/, "");
  const parts = clean.split("/");
  if (
    !clean ||
    clean.length > MAX_PATH ||
    clean.startsWith("/") ||
    clean.includes("\0") ||
    parts.some((part) => part === "" || part === "." || part === "..")
  ) {
    throw new FileError(`"${file}" isn't a path in the project. Use one like src/App.tsx.`);
  }
  const managed = parts.find((part) => MANAGED.has(part)) ?? (parts[0] === "dist" ? "dist" : null);
  if (managed) throw new FileError(`${managed}/ is made by npm. Change the source files instead.`);
  if (change && parts[0] === "attachments") {
    throw new FileError("attachments/ holds the files they attached, as they sent them. Copy one elsewhere with a command to use it.");
  }

  const full = path.join(dir, ...parts);
  await checkInside(dir, full);
  return { full, clean };
}

/** Follows links, which a command could have made, to make sure `full` stays in the project. */
async function checkInside(dir: string, full: string) {
  const root = await realpath(dir);
  let existing = full;
  let real = await realpath(existing).catch(() => null);
  while (real === null) {
    // Not there yet: check the folder it would go in.
    existing = path.dirname(existing);
    real = await realpath(existing).catch(() => null);
  }
  if (real !== root && !real.startsWith(root + path.sep)) throw new FileError("That path leads outside the project.");
}

async function checkSize(dir: string, file: string, content: string, before: string | null) {
  const size = Buffer.byteLength(content);
  if (size > MAX_FILE_BYTES) {
    throw new FileError(`${file} would be too big (${size} bytes; the limit is ${MAX_FILE_BYTES}). Split it up.`);
  }
  const total = (await listFiles(dir)).reduce((sum, info) => sum + (MEDIA.test(info.path) ? 0 : info.size), 0);
  if (total - Buffer.byteLength(before ?? "") + size > MAX_PROJECT_BYTES) {
    throw new FileError("The project is too big. Remove files it doesn't need first.");
  }
}
