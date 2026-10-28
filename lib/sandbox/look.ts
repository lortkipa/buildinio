import "server-only";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { runCommand, sandboxMode } from "@/lib/sandbox/run";
import { projectDir } from "@/lib/sandbox/workspace";

// The AI looks at its built app: screenshot.mjs runs where the app's commands run (so
// the app's own code stays in the sandbox) and leaves its pictures in dist/.look/, which
// isn't a source file, goes with the next build, and isn't served (dot paths aren't).

// The ignore comments stop the bundler from tracing the whole project because of these paths.
const SCRIPT = path.join(/* turbopackIgnore: true */ process.cwd(), "lib", "sandbox", "screenshot.mjs");
const PLAYWRIGHT = path.join(/* turbopackIgnore: true */ process.cwd(), "node_modules", "playwright-core");
const OUT = "dist/.look";
const LOOK_MS = 2 * 60_000;
const ROUTE = /^#[\w\-./~%?=&]*$/; // Goes in a shell command: nothing that could break out of it.
const NO_BROWSER = /Executable doesn't exist|Failed to launch|Cannot find (module|package) 'playwright-core'/i;

export type Look =
  | { ok: true; phone: string; desktop: string; errors: string[]; broken: string[] } // Pictures as base64 PNG.
  | { ok: false; reason: string };

let unavailable: string | null = null; // Why there are no screenshots on this server, once we know.

/** The built app (dist/) on a phone and a desktop, at `route` (like "#/settings") or its start page. */
export async function lookAtApp(projectId: string, route: string, signal: AbortSignal): Promise<Look> {
  if (unavailable) return { ok: false, reason: unavailable };
  if (route && !ROUTE.test(route)) return { ok: false, reason: `"${route}" isn't a page of the app. Use one like #/settings, or nothing for the start page.` };

  const dir = projectDir(projectId);
  await rm(path.join(dir, OUT), { recursive: true, force: true });
  const docker = sandboxMode() === "docker";
  const page = route ? ` '${route}'` : "";
  const result = await runCommand(
    projectId,
    docker ? `node /buildinio/screenshot.mjs dist ${OUT}${page}` : `node "${SCRIPT}" dist ${OUT}${page}`,
    {
      signal,
      timeoutMs: LOOK_MS,
      mounts: [
        { host: SCRIPT, container: "/buildinio/screenshot.mjs" },
        { host: PLAYWRIGHT, container: "/buildinio/node_modules/playwright-core" },
      ],
    },
  );
  if (result.exitCode !== 0) {
    if (NO_BROWSER.test(result.output)) {
      console.warn(`\n  ⚠  The AI can't look at apps: there's no Chromium where commands run. See the README.\n`);
      unavailable = "Screenshots aren't set up on this server, so you can't look at the app. Carry on without.";
      return { ok: false, reason: unavailable };
    }
    const why = result.timedOut ? "it took too long" : result.output.trim().split("\n").slice(-3).join("\n");
    return { ok: false, reason: `Taking the screenshots failed: ${why}` };
  }

  const [phone, desktop, report] = await Promise.all([
    readFile(path.join(dir, OUT, "phone.png"), "base64"),
    readFile(path.join(dir, OUT, "desktop.png"), "base64"),
    readFile(path.join(dir, OUT, "report.json"), "utf8"),
  ]);
  const { errors = [], broken = [] } = JSON.parse(report);
  return { ok: true, phone, desktop, errors, broken };
}
