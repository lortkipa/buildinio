import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { isRunning } from "@/lib/ai/registry";
import { listen, startRun } from "@/lib/ai/runs";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { isId } from "@/lib/projects/ids";
import { addMessage, getProject, insertProject, projectExists } from "@/lib/projects/server";
import type { TurnEvent } from "@/lib/projects/types";
import { createWorkspace } from "@/lib/sandbox/workspace";

const MAX_PROMPT = 20_000;

/**
 * Sends a prompt and streams the AI's answer, one JSON event per line (TurnEvent).
 * The first prompt also creates the project. Without a prompt, it joins the answer in
 * progress (or restarts one the server lost), or says how the last one ended.
 */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/projects/[id]/turn">) {
  const { id } = await params;
  const user = getSessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) return new Response("Log in first.", { status: 401 });
  if (!isId(id)) return new Response("Not found.", { status: 404 });

  const body = await request.json().catch(() => null);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  // The AI's questions, all skipped, when a prompt was typed instead of answering them.
  const skipped = typeof body?.skipped?.text === "string" ? body.skipped.text.trim() : "";
  if (text.length > MAX_PROMPT || skipped.length > MAX_PROMPT) return new Response("That’s too long.", { status: 413 });

  let project = getProject(user.id, id);
  // Sent again after the connection dropped: it's already here.
  const resent = project?.messages.some((message) => message.id === body?.messageId);
  if (text && !resent) {
    if (!isId(body.messageId) || (skipped && !isId(body.skipped.messageId))) {
      return new Response("Bad message id.", { status: 400 });
    }
    if (!project) {
      if (projectExists(id)) return new Response("Not found.", { status: 404 });
      insertProject(user.id, id);
      await createWorkspace(id);
    } else if (isRunning(id)) {
      return new Response("The AI is still answering.", { status: 409 });
    }
    if (skipped && project) addMessage(id, { id: body.skipped.messageId, role: "user", text: skipped });
    addMessage(id, { id: body.messageId, role: "user", text });
    project = getProject(user.id, id)!;
    startRun(project, user.id);
  } else if (!project) {
    return new Response("Not found.", { status: 404 });
  } else if (!isRunning(id) && project.messages.at(-1)?.role === "user") {
    startRun(project, user.id); // Cut off by a restart: answer it again.
  }

  return new Response(stream(user.id, id, request.signal), {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/** The answer's events until it's done. Leaving only stops listening: the answer goes on. */
function stream(userId: string, projectId: string, signal: AbortSignal) {
  const encoder = new TextEncoder();
  let unlisten = () => {};
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        unlisten();
        signal.removeEventListener("abort", close);
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      };
      const send = (event: TurnEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));

      const stop = listen(projectId, (event) => {
        if (event === null) return close();
        send(event);
        if (event.type === "done" || event.type === "withdrawn") close();
      });
      if (stop) {
        unlisten = stop;
        signal.addEventListener("abort", close, { once: true });
      } else {
        // Nothing in progress: how the last answer ended, in case it was missed.
        const project = getProject(userId, projectId);
        const last = project?.messages.at(-1);
        if (project && last?.role === "assistant") {
          send({
            type: "project_updated",
            changes: { ...(project.name !== null ? { name: project.name } : {}), icon: project.icon, color: project.color },
          });
          send({ type: "done", message: last, appVersion: project.appVersion, ready: project.ready });
        }
        close();
      }
    },
    cancel() {
      unlisten();
    },
  });
}
