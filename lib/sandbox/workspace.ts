import "server-only";
import { cp, mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";
import { isId } from "@/lib/projects/ids";

// Each project's code is a folder on disk, kept until the project or its account is
// deleted: the app's source, plus its node_modules and the built app in dist/.

// The ignore comments stop the bundler from tracing the whole project because of these paths.
export const PROJECTS_ROOT = path.resolve(/* turbopackIgnore: true */ process.env.PROJECTS_PATH || "data/projects");
const TEMPLATE = path.join(/* turbopackIgnore: true */ process.cwd(), "templates", "app");

/** Where npm keeps downloaded packages, shared by every project so installs are quick. */
export const NPM_CACHE = path.join(path.dirname(PROJECTS_ROOT), "npm-cache");

export function projectDir(id: string) {
  if (!isId(id)) throw new Error(`Not a project id: ${id}`);
  return path.join(PROJECTS_ROOT, id);
}

/** A new project starts as a copy of the template (templates/app): a Vite + React + Tailwind app. */
export async function createWorkspace(id: string) {
  await mkdir(PROJECTS_ROOT, { recursive: true });
  await cp(TEMPLATE, projectDir(id), {
    recursive: true,
    filter: (source) => !/[\\/](node_modules|dist)$/.test(source),
  });
}

/** Makes the project's folder if it's missing, like a project made before its code was kept. */
export async function ensureWorkspace(id: string) {
  if (!(await stat(projectDir(id)).catch(() => null))) await createWorkspace(id);
}

export async function removeWorkspace(id: string) {
  await rm(projectDir(id), { recursive: true, force: true });
}

/** Removes the folders of projects that are gone, in case the server stopped while deleting one. */
export async function pruneWorkspaces(isProject: (id: string) => boolean) {
  const entries = await readdir(PROJECTS_ROOT, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (entry.isDirectory() && isId(entry.name) && !isProject(entry.name)) await removeWorkspace(entry.name);
  }
}
