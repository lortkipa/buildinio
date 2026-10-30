import "server-only";
import { cp, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { isId } from "@/lib/projects/ids";
import { PROJECTS_ROOT, projectDir } from "@/lib/sandbox/workspace";

// A copy of a project's folder from before an answer, so stopping the answer can put
// everything back: the source and the built app. Installed packages aren't copied;
// putting package.json back makes the next build install again (see build.ts). Nor are
// the attached files, which can be big: the next answer puts them right (attachments.ts).

const ROOT = path.join(PROJECTS_ROOT, ".snapshots"); // Not a project id, so not taken for a project's folder.
const KEPT = new Set(["node_modules", "attachments"]); // Left as they are, not copied or restored.

function snapshotDir(id: string) {
  if (!isId(id)) throw new Error(`Not a project id: ${id}`);
  return path.join(ROOT, id);
}

export async function takeSnapshot(id: string) {
  const to = snapshotDir(id);
  await rm(to, { recursive: true, force: true });
  await copyFolder(projectDir(id), to);
}

/** Puts the project's folder back the way it was when the snapshot was taken. */
export async function restoreSnapshot(id: string) {
  const dir = projectDir(id);
  for (const entry of await readdir(dir)) {
    if (!KEPT.has(entry)) await rm(path.join(dir, entry), { recursive: true, force: true });
  }
  await copyFolder(snapshotDir(id), dir);
}

export async function dropSnapshot(id: string) {
  await rm(snapshotDir(id), { recursive: true, force: true });
}

/** Snapshots left behind when the server stopped: no answer outlives it. */
export async function dropAllSnapshots() {
  await rm(ROOT, { recursive: true, force: true });
}

// Same times as the originals, so the source's fingerprint matches its last build again.
function copyFolder(from: string, to: string) {
  return cp(from, to, {
    recursive: true,
    preserveTimestamps: true,
    verbatimSymlinks: true,
    filter: (source) => !KEPT.has(path.relative(from, source)),
  });
}
