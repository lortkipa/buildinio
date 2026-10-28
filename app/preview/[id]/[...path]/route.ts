import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { isId } from "@/lib/projects/ids";
import { projectExists } from "@/lib/projects/server";
import { projectDir } from "@/lib/sandbox/workspace";

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
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

/**
 * The built app (a project's dist/), shown in the preview's frame. Sandboxed even
 * when opened on its own: its scripts get an origin of their own, so they can't
 * reach this site or the signed-in user. No sign-in needed, so the long random
 * project id is what keeps it private.
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/preview/[id]/[...path]">) {
  const { id, path: parts } = await params;
  if (!isId(id) || parts.some((part) => part.startsWith(".")) || !projectExists(id)) return notFound();

  // The ignore comments stop the bundler from tracing the whole project because of these paths.
  const dist = path.join(projectDir(id), "dist");
  let file = path.join(dist, ...parts);
  if (!(await stat(/* turbopackIgnore: true */ file).catch(() => null))?.isFile()) {
    if (path.extname(file)) return notFound();
    file = path.join(dist, "index.html"); // A page the app routes itself.
  }

  // Links could lead anywhere: only what's really in dist/.
  const [real, root] = await Promise.all([
    realpath(/* turbopackIgnore: true */ file).catch(() => null),
    realpath(/* turbopackIgnore: true */ dist).catch(() => null),
  ]);
  if (!real || !root || !real.startsWith(root + path.sep)) return notFound();

  return new Response(new Uint8Array(await readFile(/* turbopackIgnore: true */ real)), {
    headers: {
      "Content-Type": TYPES[path.extname(real).toLowerCase()] ?? "application/octet-stream",
      "Content-Security-Policy": "sandbox allow-scripts allow-forms allow-modals allow-popups; frame-ancestors 'self'",
      // Its own origin makes its scripts and styles cross-origin requests (Vite marks them crossorigin).
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-cache",
    },
  });
}

function notFound() {
  return new Response("Not found.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
