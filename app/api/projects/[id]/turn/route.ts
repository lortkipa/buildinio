import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { isRunning } from "@/lib/ai/registry";
import { listen, startRun } from "@/lib/ai/runs";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from "@/lib/projects/attachments";
import { isId } from "@/lib/projects/ids";
import { addPrompt, getProject, insertProject, projectExists } from "@/lib/projects/server";
import type { SentFile } from "@/lib/projects/server";
import type { TurnEvent } from "@/lib/projects/types";
import { createWorkspace } from "@/lib/sandbox/workspace";
import { KEEP_ALIVE_MS, STREAM_HEADERS } from "@/lib/stream";

const MAX_PROMPT = 20_000;

/**
 * Sends a prompt and streams the AI's answer, one JSON event per line (TurnEvent).
 * The first prompt also creates the project. A prompt is text, files or both: with files
 * it's a form, the prompt as JSON in `prompt` and each file as a `file`, in the order of
 * their ids in `attachments` (made in the browser, like the message's). Without a prompt,
 * it joins the answer in progress (or restarts one the server lost), or says how the
 * last one ended.
 */
export async function POST(request: NextRequest, { params }: RouteContext<"/api/projects/[id]/turn">) {
  const { id } = await params;
  const user = getSessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) return new Response("Log in first.", { status: 401 });
  if (!isId(id)) return new Response("Not found.", { status: 404 });

  const { body, uploads } = await readBody(request);
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  // The AI's questions, all skipped, when a prompt was typed instead of answering them.
  const skipped = typeof body?.skipped?.text === "string" ? body.skipped.text.trim() : "";
  if (text.length > MAX_PROMPT || skipped.length > MAX_PROMPT) return new Response("That’s too long.", { status: 413 });
  const ids: unknown[] = Array.isArray(body?.attachments) ? body.attachments : [];
  if (ids.length > MAX_ATTACHMENTS) return new Response(`Attach up to ${MAX_ATTACHMENTS} files.`, { status: 413 });
  if (uploads.some((file) => file.size > MAX_ATTACHMENT_BYTES)) {
    return new Response("Each file can be up to 10 MB.", { status: 413 });
  }

  let project = getProject(user.id, id);
  // Sent again after the connection dropped: it's already here.
  const resent = project?.messages.some((message) => message.id === body?.messageId);
  if ((text || ids.length) && !resent) {
    if (!isId(body.messageId) || (skipped && !isId(body.skipped.messageId))) {
      return new Response("Bad message id.", { status: 400 });
    }
    if (!ids.every(isId) || new Set(ids).size !== ids.length || uploads.length !== ids.length) {
      return new Response("Bad files.", { status: 400 });
    }
    if (!project) {
      if (projectExists(id)) return new Response("Not found.", { status: 404 });
      insertProject(user.id, id);
      await createWorkspace(id);
    } else if (isRunning(id)) {
      return new Response("The AI is still answering.", { status: 409 });
    }
    const before = skipped && project ? { id: body.skipped.messageId, role: "user" as const, text: skipped } : undefined;
    const files: SentFile[] = await Promise.all(
      uploads.map(async (file, index) => ({
        id: ids[index],
        name: file.name,
        type: file.type,
        data: Buffer.from(await file.arrayBuffer()),
      })),
    );
    if (!addPrompt(user.id, id, { id: body.messageId, role: "user", text }, files, before)) {
      return new Response("Bad files.", { status: 400 });
    }
    project = getProject(user.id, id)!;
    startRun(project, user.id);
  } else if (!project) {
    return new Response("Not found.", { status: 404 });
  } else if (!isRunning(id) && project.messages.at(-1)?.role === "user") {
    startRun(project, user.id); // Cut off by a restart: answer it again.
  }

  return new Response(stream(user.id, id, request.signal), {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", ...STREAM_HEADERS },
  });
}

/** The request's JSON, and the files sent with it: a form when there are files. */
async function readBody(request: NextRequest) {
  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
    return { body: await request.json().catch(() => null), uploads: [] };
  }
  const form = await request.formData().catch(() => null);
  const prompt = form?.get("prompt");
  let body = null;
  try {
    body = typeof prompt === "string" ? JSON.parse(prompt) : null;
  } catch {
    // Not JSON: no prompt.
  }
  const uploads = (form?.getAll("file") ?? []).filter((file): file is File => file instanceof File);
  return { body, uploads };
}

/** The answer's events until it's done. Leaving only stops listening: the answer goes on. */
function stream(userId: string, projectId: string, signal: AbortSignal) {
  const encoder = new TextEncoder();
  let unlisten = () => {};
  let keepAlive: ReturnType<typeof setInterval> | undefined;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => {
        unlisten();
        clearInterval(keepAlive);
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
        // An empty line, which the browser skips: a long npm install can be quiet for minutes,
        // and a proxy in front of the server (like Cloudflare's) would drop the connection.
        keepAlive = setInterval(() => controller.enqueue(encoder.encode("\n")), KEEP_ALIVE_MS);
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
      clearInterval(keepAlive);
    },
  });
}
