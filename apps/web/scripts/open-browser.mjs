// Opens the web app in the default browser once `next dev` answers.
// Run by `pnpm dev` (turbo task `dev:open`). Skip with BROWSER=none.
import { spawn } from "node:child_process";

const url = "http://localhost:3000";
const timeoutMs = 120_000;

if (process.env.BROWSER === "none" || process.env.CI) process.exit(0);

const deadline = Date.now() + timeoutMs;
while (!(await isUp())) {
  if (Date.now() > deadline) {
    console.log(`Web app not ready after ${timeoutMs / 1000}s. Open ${url} in your browser.`);
    process.exit(0);
  }
  await new Promise((resolve) => setTimeout(resolve, 500));
}

const [command, args] =
  process.platform === "darwin"
    ? ["open", [url]]
    : process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : ["xdg-open", [url]];

const child = spawn(command, args, { detached: true, stdio: "ignore" });
child.on("error", () => console.log(`Open ${url} in your browser.`));
child.on("spawn", () => {
  console.log(`Opened ${url} in your browser.`);
  child.unref();
});

async function isUp() {
  try {
    await fetch(url, { signal: AbortSignal.timeout(60_000) });
    return true;
  } catch {
    return false;
  }
}
