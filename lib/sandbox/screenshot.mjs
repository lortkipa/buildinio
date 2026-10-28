// Screenshots of a built app, for the AI to look at. lib/sandbox/look.ts runs it where
// the app's commands run (in Docker, or on the host): it serves dist/ itself, opens the
// app at a phone's and a desktop's width, and writes phone.png, desktop.png and
// report.json (console errors and broken requests) to the output folder.
//
// node screenshot.mjs <dist> <out> [#/route]
// Chromium: CHROMIUM_PATH, or Playwright's own (PLAYWRIGHT_BROWSERS_PATH).

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { isIP } from "node:net";
import path from "node:path";
import { chromium } from "playwright-core";

const [dist, out, hash = ""] = process.argv.slice(2);
const VIEWS = [
  { name: "phone", width: 390, height: 844, isMobile: true },
  { name: "desktop", width: 1280, height: 800, isMobile: false },
];
const SCREENS = 2; // Pictures are at most this many screens tall: enough to judge, cheap to send.
const MAX_NOTES = 20;
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

// dist/ as the preview serves it: files, and index.html for the paths the app routes itself.
const root = path.resolve(dist);
const server = createServer(async (request, response) => {
  let file = path.join(root, decodeURIComponent(new URL(request.url ?? "/", "http://app").pathname));
  if (!(await stat(file).catch(() => null))?.isFile() && !path.extname(file)) file = path.join(root, "index.html");
  const body = file.startsWith(root + path.sep) ? await readFile(file).catch(() => null) : null;
  if (!body) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream" });
  response.end(body);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const errors = new Set();
const broken = new Set();
const note = (notes, text) => notes.size < MAX_NOTES && notes.add(String(text).slice(0, 300));

// Docker's /dev/shm is small (64 MB): Chromium crashes on big pages unless it uses /tmp instead.
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  chromiumSandbox: false,
  args: ["--disable-dev-shm-usage"],
});
try {
  await mkdir(out, { recursive: true });
  for (const view of VIEWS) {
    const page = await browser.newPage({
      viewport: { width: view.width, height: view.height },
      isMobile: view.isMobile,
      hasTouch: view.isMobile,
    });
    page.on("console", (message) => {
      // Failed loads show up as broken requests, with their addresses.
      if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) note(errors, message.text());
    });
    page.on("pageerror", (error) => note(errors, error.message));
    page.on("response", (response) => response.status() >= 400 && note(broken, `${response.url()} (${response.status()})`));
    page.on("requestfailed", (request) => {
      const reason = request.failure()?.errorText ?? "failed";
      if (!reason.includes("BLOCKED_BY_CLIENT")) note(broken, `${request.url()} (${reason})`);
    });
    // The app's own code runs here: keep it off this machine's network, apart from its own files.
    await page.route("**/*", (route) => (allowed(route.request().url()) ? route.continue() : route.abort("blockedbyclient")));

    await page.goto(`${origin}/${hash}`, { waitUntil: "load", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready).catch(() => {});
    const height = Math.min(await page.evaluate(() => document.documentElement.scrollHeight), view.height * SCREENS);
    await page.screenshot({
      path: path.join(out, `${view.name}.png`),
      fullPage: true,
      clip: { x: 0, y: 0, width: view.width, height: Math.max(height, view.height) },
      animations: "disabled",
    });
    await page.close();
  }
  await writeFile(path.join(out, "report.json"), JSON.stringify({ errors: [...errors], broken: [...broken] }));
} finally {
  await browser.close();
  server.close();
}

/** Its own server, and anything out on the internet. Not this machine or its network. */
function allowed(raw) {
  const url = new URL(raw);
  if (url.origin === origin || url.protocol === "data:" || url.protocol === "blob:") return true;
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (host === "localhost" || /\.(localhost|local|internal)$/.test(host)) return false;
  if (isIP(host) === 4) {
    const [a, b] = host.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127));
  }
  if (isIP(host) === 6) return !(host === "::" || host === "::1" || /^(fc|fd|fe8|fe9|fea|feb)/.test(host) || host.startsWith("::ffff:"));
  return true;
}
