import type { NextRequest } from "next/server";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { watchApp } from "@/lib/projects/changes";
import { isId } from "@/lib/projects/ids";
import { getSharedApp } from "@/lib/projects/server";
import type { SharedAppState } from "@/lib/projects/types";
import { KEEP_ALIVE_MS, STREAM_HEADERS } from "@/lib/stream";

/**
 * The app as its share page (app/share) should show it, as server-sent events: now, then
 * again whenever that changes (a new build, made private or public, deleted), so the page
 * follows without a refresh. "Not available" is the same for a private app and a missing
 * one, so nothing leaks; it stays connected, to hear when the app is made public.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/api/share/[id]">) {
  const { id } = await params;
  if (!isId(id)) return new Response("Not found.", { status: 404 });
  const userId = getSessionUser(request.cookies.get(SESSION_COOKIE)?.value)?.id ?? null;

  const encoder = new TextEncoder();
  let stop = () => {};
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (text: string) => controller.enqueue(encoder.encode(text));
      let last = "";
      const send = () => {
        const app = getSharedApp(id, userId);
        const state: SharedAppState = app ? { available: true, ...app } : { available: false };
        const data = JSON.stringify(state);
        if (data !== last) write(`data: ${data}\n\n`);
        last = data;
      };
      const keepAlive = setInterval(() => write(": still here\n\n"), KEEP_ALIVE_MS);
      const unwatch = watchApp(id, send);
      const end = () => {
        stop();
        try {
          controller.close();
        } catch {} // Already closed by the browser leaving.
      };
      stop = () => {
        clearInterval(keepAlive);
        unwatch();
        request.signal.removeEventListener("abort", end);
      };
      request.signal.addEventListener("abort", end);
      send();
    },
    cancel() {
      stop();
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", ...STREAM_HEADERS },
  });
}
