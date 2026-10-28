import "server-only";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { NPM_CACHE, projectDir } from "@/lib/sandbox/workspace";

// Runs a shell command in a project's folder: npm installs, builds, and the AI's own
// checks. With SANDBOX=docker (the default) it runs in a throwaway container that
// only sees the project's folder. SANDBOX=host runs it right here, with a stripped
// environment: quicker to set up, but it can reach everything this server can.

const MAX_OUTPUT = 16_000; // The end of the output is kept: that's where errors are.
// Color codes: tokens the AI pays for and gets nothing from. NO_COLOR stops most;
// this cleans up after the rest. (CI=true, which npm wants, turns Vite's colors on.)
const COLORS = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
const IMAGE = process.env.SANDBOX_IMAGE || playwrightImage();

export type CommandResult = { exitCode: number; output: string; timedOut: boolean };

/** A file or folder of ours a command needs, shown read-only at `container` in Docker. */
export type Mount = { host: string; container: string };

/** The sandbox itself can't run (no Docker, say): nothing the AI can fix. */
export class SandboxError extends Error {}

export function sandboxMode() {
  return process.env.SANDBOX === "host" ? "host" : "docker";
}

export async function runCommand(
  projectId: string,
  command: string,
  { signal, timeoutMs, mounts = [] }: { signal: AbortSignal; timeoutMs: number; mounts?: Mount[] },
): Promise<CommandResult> {
  signal.throwIfAborted();
  const dir = projectDir(projectId);
  await mkdir(NPM_CACHE, { recursive: true });
  const docker = sandboxMode() === "docker";
  const name = `buildinio-${projectId.slice(0, 8)}-${randomBytes(4).toString("hex")}`;

  const child = docker
    ? spawn("docker", dockerArgs(name, dir, command, mounts), { stdio: ["ignore", "pipe", "pipe"] })
    : spawn(command, {
        cwd: dir,
        shell: true,
        env: hostEnv(),
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32", // Its own process group, to stop it with everything it started.
      });

  let output = "";
  const collect = (chunk: Buffer) => {
    output = (output + chunk.toString()).slice(-MAX_OUTPUT * 2);
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);

  let timedOut = false;
  const stop = () => {
    if (docker) {
      spawn("docker", ["kill", name], { stdio: "ignore" }).on("error", () => {});
      child.kill("SIGKILL");
    } else {
      killTree(child.pid);
    }
  };
  const timer = setTimeout(() => {
    timedOut = true;
    stop();
  }, timeoutMs);
  signal.addEventListener("abort", stop, { once: true });

  try {
    const exitCode = await new Promise<number>((resolve, reject) => {
      child.on("error", reject);
      child.on("close", (code) => resolve(code ?? 1));
    });
    signal.throwIfAborted();
    const problem = docker && exitCode !== 0 && !timedOut ? dockerProblem(exitCode, output) : null;
    if (problem) throw new SandboxError(problem);
    return { exitCode, output: tail(output), timedOut };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" && docker) {
      throw new SandboxError("Docker isn’t installed. Install it, or set SANDBOX=host in .env.local.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", stop);
  }
}

function dockerArgs(name: string, dir: string, command: string, mounts: Mount[]) {
  // Run as this user, so files made in the folder stay ours to change and delete.
  const user = process.getuid && process.getgid ? ["--user", `${process.getuid()}:${process.getgid()}`] : [];
  return [
    "run", "--rm", "--init", "--name", name,
    "--memory", "2g", "--cpus", "2", "--pids-limit", "512",
    ...user,
    "-v", `${dir}:/app`, "-w", "/app",
    "-v", `${NPM_CACHE}:/npm-cache`,
    ...mounts.flatMap((mount) => ["-v", `${mount.host}:${mount.container}:ro`]),
    "-e", "HOME=/tmp", "-e", "npm_config_cache=/npm-cache", "-e", "npm_config_update_notifier=false", "-e", "CI=true",
    "-e", "NO_COLOR=1",
    IMAGE, "sh", "-c", command,
  ];
}

// Docker's own complaints, as opposed to the command's.
const NO_DAEMON = /failed to connect to the docker api|cannot connect to the docker daemon|docker daemon is not running|error during connect/i;

/** Why `docker run` itself failed, in a sentence. Null if it was the command that failed. */
function dockerProblem(exitCode: number, output: string) {
  if (NO_DAEMON.test(output)) return "Docker isn’t running. Start it, or set SANDBOX=host in .env.local.";
  if (exitCode === 125) return `Docker couldn’t start the sandbox: ${output.trim().split("\n").at(-1)}`;
  return null;
}

// The host's environment, minus anything secret: just enough for npm to work
// (behind a proxy too). Without NODE_ENV, so devDependencies install.
// Plus where Chromium is, for the screenshots (lib/sandbox/look.ts).
const HOST_ENV = /^(path|pathext|home|userprofile|appdata|localappdata|temp|tmp|tmpdir|systemroot|comspec|lang|https?_proxy|no_proxy|node_extra_ca_certs|ssl_cert_file|npm_config_(https?_proxy|proxy|noproxy|cafile|registry)|chromium_path|playwright_browsers_path)$/i;

function hostEnv() {
  const env: Record<string, string | undefined> = {
    CI: "true",
    NO_COLOR: "1",
    npm_config_cache: NPM_CACHE,
    npm_config_update_notifier: "false",
  };
  for (const [key, value] of Object.entries(process.env)) if (HOST_ENV.test(key)) env[key] = value;
  return env as NodeJS.ProcessEnv;
}

function killTree(pid: number | undefined) {
  if (pid === undefined) return;
  try {
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-pid, "SIGKILL");
  } catch {
    // Already gone.
  }
}

/**
 * Playwright's image: Node and npm, plus the Chromium our playwright-core drives for
 * screenshots (look.ts). Same version, or playwright-core won't find its browser.
 */
function playwrightImage() {
  try {
    const manifest = path.join(/* turbopackIgnore: true */ process.cwd(), "node_modules", "playwright-core", "package.json");
    return `mcr.microsoft.com/playwright:v${JSON.parse(readFileSync(manifest, "utf8")).version}-noble`;
  } catch {
    return "node:22-slim"; // No screenshots, then.
  }
}

/**
 * Downloads the Docker image in the background if it isn't here yet, so the first
 * build doesn't spend its time limit on that. Called when the server starts.
 */
export function prepareSandbox() {
  if (sandboxMode() !== "docker") return;
  let noDocker = false; // The first command says so.
  const inspect = spawn("docker", ["image", "inspect", IMAGE], { stdio: "ignore" });
  inspect.on("error", () => (noDocker = true));
  inspect.on("close", (code) => {
    if (noDocker || code === 0) return;
    console.log(`Downloading the sandbox image (${IMAGE}) for the AI's commands…`);
    spawn("docker", ["pull", IMAGE], { stdio: "ignore" }).on("error", () => {});
  });
}

function tail(output: string) {
  const clean = output.replace(COLORS, "");
  return clean.length > MAX_OUTPUT ? `…${clean.slice(-MAX_OUTPUT)}` : clean;
}
