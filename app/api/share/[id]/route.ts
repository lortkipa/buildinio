import type { NextRequest } from "next/server";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { watchBuilds } from "@/lib/projects/builds";
import { isId } from "@/lib/projects/ids";
import { getSharedApp } from "@/lib/projects/server";

const KEEP_ALIVE_MS = 25_000; // Under the usual proxy idle timeouts.

/**
 * The app's version for its share page (app/share), as server-sent events: the current
 * one, then each new build, so the page shows it without a refresh. Only for whoever
 * may see the app, checked again with every build: made private or deleted, it ends.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/share/[id]">) {
  const { id } = await params;
  const userId = getSessionUser(request.cookies.get(SESSION_COOKIE)?.value)?.id ?? null;
  const app = isId(id) ? getSharedApp(id, userId) : null;
  if (!app) return new Response("Not found.", { status: 404 });

  const encoder = new TextEncoder();
  let stop = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => controller.enqueue(encoder.encode(text));
      const keepAlive = setInterval(() => send(": still here\n\n"), KEEP_ALIVE_MS);
      const unwatch = watchBuilds(id, (appVersion) => {
        if (getSharedApp(id, userId)) send(`data: ${appVersion}\n\n`);
        else end();
      });
      function end() {
        stop();
        try {
          controller.close();
        } catch {} // Already closed by the browser leaving.
      }
      stop = () => {
        clearInterval(keepAlive);
        unwatch();
        request.signal.removeEventListener("abort", end);
      };
      request.signal.addEventListener("abort", end);
      send(`data: ${app.appVersion}\n\n`);
    },
    cancel() {
      stop();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-store" },
  });
}
