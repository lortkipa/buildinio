import "server-only";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { PLAYWRIGHT_IMAGE, runCommand, sandboxMode } from "@/lib/sandbox/run";
import { projectDir } from "@/lib/sandbox/workspace";

// The AI looks at its built app: screenshot.mjs runs where the app's commands run (so
// the app's own code stays in the sandbox) and leaves its pictures in dist/.look/, which
// isn't a source file, goes with the next build, and isn't served (dot paths aren't).
// In Docker it always runs in Playwright's image, whatever SANDBOX_IMAGE is; on the host
// it downloads Playwright's Chromium the first time if there's none (and no CHROMIUM_PATH).

// The ignore comments stop the bundler from tracing the whole project because of these paths.
const SCRIPT = path.join(/* turbopackIgnore: true */ process.cwd(), "lib", "sandbox", "screenshot.mjs");
const PLAYWRIGHT = path.join(/* turbopackIgnore: true */ process.cwd(), "node_modules", "playwright-core");
const OUT = "dist/.look";
const LOOK_MS = 2 * 60_000;
const INSTALL_MS = 5 * 60_000;
const ROUTE = /^#[\w\-./~%?=&]*$/; // Goes in a shell command: nothing that could break out of it.
const NO_BROWSER = /Executable doesn't exist|Failed to launch|Cannot find (module|package) 'playwright-core'/i;

export type Look =
  | { ok: true; phone: string; desktop: string; errors: string[]; broken: string[] } // Pictures as base64 PNG.
  | { ok: false; reason: string; detail: string }; // Why, for the AI, and a word or two for the chat.

let unavailable: string | null = null; // Why there are no screenshots on this server, once we know.

/** The built app (dist/) on a phone and a desktop, at `page` (like "#/settings") or its start page. */
export async function lookAtApp(projectId: string, page: string, signal: AbortSignal): Promise<Look> {
  if (unavailable) return { ok: false, reason: unavailable, detail: "Not set up" };
  const route = toRoute(page);
  if (route === null) {
    return { ok: false, reason: `"${page}" isn't a page of the app. Leave it empty for the start page, or use one like #/settings.`, detail: "No such page" };
  }

  let result = await screenshot(projectId, route, signal);
  if (result.exitCode !== 0 && NO_BROWSER.test(result.output) && (await installChromium(projectId, signal))) {
    result = await screenshot(projectId, route, signal);
  }
  if (result.exitCode !== 0) {
    const output = result.output.trim().split("\n").slice(-5).join("\n");
    const log = result.output.trim().split("\n").slice(-30).join("\n"); // Enough to see where it failed.
    if (NO_BROWSER.test(result.output)) {
      console.warn(`\n  ⚠  The AI can't look at apps: no Chromium where commands run (see docs/settings.md).\n${log}\n`);
      unavailable = "Screenshots aren't set up on this server, so you can't look at the app. Carry on without.";
      return { ok: false, reason: unavailable, detail: "Not set up" };
    }
    console.warn(`\n  ⚠  The AI's screenshots didn't work:\n${log}\n`);
    const why = result.timedOut ? "it took too long" : output;
    return { ok: false, reason: `Taking the screenshots failed: ${why}`, detail: "Didn't work" };
  }

  const dir = projectDir(projectId);
  const [phone, desktop, report] = await Promise.all([
    readFile(path.join(dir, OUT, "phone.png"), "base64"),
    readFile(path.join(dir, OUT, "desktop.png"), "base64"),
    readFile(path.join(dir, OUT, "report.json"), "utf8"),
  ]);
  const { errors = [], broken = [] } = JSON.parse(report);
  return { ok: true, phone, desktop, errors, broken };
}

/** The hash route to open, "" for the start page, or null if `page` isn't one. Lenient: "/" and "/settings" work too. */
function toRoute(page: string) {
  const clean = page.trim().replace(/^\.?\/?(index\.html)?/, "");
  if (!clean || clean === "#" || clean === "#/") return "";
  const route = clean.startsWith("#") ? clean : `#/${clean}`;
  return ROUTE.test(route) ? route : null;
}

async function screenshot(projectId: string, route: string, signal: AbortSignal) {
  await rm(path.join(projectDir(projectId), OUT), { recursive: true, force: true });
  const docker = sandboxMode() === "docker";
  const page = route ? ` '${route}'` : "";
  return runCommand(projectId, docker ? `node /buildinio/screenshot.mjs dist ${OUT}${page}` : `node "${SCRIPT}" dist ${OUT}${page}`, {
    signal,
    timeoutMs: LOOK_MS,
    image: PLAYWRIGHT_IMAGE,
    // Chromium's profile and shared memory go in /tmp: in memory, not on Docker's disk, which may be full.
    tmp: "1g",
    mounts: [
      { host: SCRIPT, container: "/buildinio/screenshot.mjs" },
      { host: PLAYWRIGHT, container: "/buildinio/node_modules/playwright-core" },
    ],
  });
}

/** On the host, with no CHROMIUM_PATH: downloads Playwright's headless Chromium, once. True if it did. */
let triedInstall = false;
async function installChromium(projectId: string, signal: AbortSignal) {
  if (sandboxMode() === "docker" || process.env.CHROMIUM_PATH || triedInstall) return false;
  triedInstall = true;
  console.log("Downloading Chromium for the AI's screenshots…");
  const cli = path.join(PLAYWRIGHT, "cli.js");
  const result = await runCommand(projectId, `node "${cli}" install --only-shell chromium`, { signal, timeoutMs: INSTALL_MS });
  if (result.exitCode !== 0) console.warn(`\n  ⚠  Downloading Chromium failed:\n${result.output.trim().split("\n").slice(-5).join("\n")}\n`);
  return result.exitCode === 0;
}
