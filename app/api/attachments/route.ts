import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { MAX_ATTACHMENT_BYTES } from "@/lib/projects/attachments";
import { saveAttachment } from "@/lib/projects/server";

/**
 * A file attached in the prompt box, as `file` in the form. Uploaded as soon as it's picked,
 * so sending is quick; it waits, loose, until a prompt claims it (see the turn route).
 */
export async function POST(request: NextRequest) {
  const user = getSessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) return text("Log in first.", 401);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return text("That file is empty.", 400);
  if (file.size > MAX_ATTACHMENT_BYTES) return text(`${file.name} is bigger than 10 MB.`, 413);
  const saved = saveAttachment(user.id, file.name, file.type, Buffer.from(await file.arrayBuffer()));
  if (!saved) return text("Too many files are waiting to be sent. Send or remove some first.", 429);
  return Response.json(saved);
}

function text(message: string, status: number) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
