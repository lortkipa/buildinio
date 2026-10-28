import "server-only";
import { createHash } from "node:crypto";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { runCommand } from "@/lib/sandbox/run";
import { projectDir } from "@/lib/sandbox/workspace";

const INSTALL_MS = 5 * 60_000;
const BUILD_MS = 3 * 60_000;
const INSTALLED = path.join("node_modules", ".buildinio-installed"); // What package.json was when last installed.

/**
 * Builds the app into dist/, which the preview shows: installs packages first if
 * package.json changed since the last install. On failure, the output says why.
 */
export async function buildApp(projectId: string, signal: AbortSignal): Promise<{ ok: boolean; output: string }> {
  const dir = projectDir(projectId);

  const packages = await packagesHash(dir);
  if (packages && packages !== (await readFile(path.join(dir, INSTALLED), "utf8").catch(() => null))) {
    const install = await runCommand(projectId, "npm install --no-audit --no-fund --loglevel=error", {
      signal,
      timeoutMs: INSTALL_MS,
    });
    if (install.exitCode !== 0) {
      return { ok: false, output: install.timedOut ? "npm install took too long." : `npm install failed:\n${install.output}` };
    }
    // npm may have updated the lock file: remember it as it is now.
    await writeFile(path.join(dir, INSTALLED), (await packagesHash(dir)) ?? "").catch(() => {});
  }

  const build = await runCommand(projectId, "npm run build", { signal, timeoutMs: BUILD_MS });
  if (build.exitCode !== 0) return { ok: false, output: build.timedOut ? "The build took too long." : build.output };
  if (!(await stat(path.join(dir, "dist", "index.html")).catch(() => null))) {
    return { ok: false, output: "The build finished but didn't make dist/index.html, which the preview opens." };
  }
  return { ok: true, output: build.output };
}

/** Changes when the packages to install do. Null when there's nothing to install. */
async function packagesHash(dir: string) {
  const manifest = await readFile(path.join(dir, "package.json"), "utf8").catch(() => null);
  if (manifest === null) return null;
  try {
    const { dependencies, devDependencies } = JSON.parse(manifest);
    if (!Object.keys({ ...dependencies, ...devDependencies }).length) return null;
  } catch {
    return null; // Broken JSON: the build says so.
  }
  const lock = await readFile(path.join(dir, "package-lock.json"), "utf8").catch(() => "");
  return createHash("sha256").update(manifest).update("\0").update(lock).digest("hex");
}
