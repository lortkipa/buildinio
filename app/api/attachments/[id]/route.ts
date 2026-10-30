import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getSessionUser, SESSION_COOKIE } from "@/lib/auth/session";
import { AI_IMAGE_TYPES } from "@/lib/projects/attachments";
import { isId } from "@/lib/projects/ids";
import { deleteLooseAttachment, getAttachment } from "@/lib/projects/server";

/**
 * A file attached to a prompt, for its owner only. Pictures show in place; anything else
 * downloads, and nothing it holds can run here. A file never changes, so it's cached for good.
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/attachments/[id]">) {
  const { id } = await params;
  const user = getSessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  const file = user && isId(id) ? getAttachment(user.id, id) : null;
  if (!file) {
    return new Response("Not found.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const shown = AI_IMAGE_TYPES.includes(file.contentType);
  // An SVG shown in an <img> keeps its own styles; scripts never run in one.
  const styles = file.contentType === "image/svg+xml" ? " style-src 'unsafe-inline';" : "";
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `${shown ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.name)}`,
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Security-Policy": `default-src 'none';${styles} sandbox`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Removed from the prompt box before it was sent. A sent file goes with its message. */
export async function DELETE(_request: NextRequest, { params }: RouteContext<"/api/attachments/[id]">) {
  const { id } = await params;
  const user = getSessionUser((await cookies()).get(SESSION_COOKIE)?.value);
  if (!user) return new Response("Log in first.", { status: 401 });
  if (isId(id)) deleteLooseAttachment(user.id, id);
  return new Response(null, { status: 204 });
}
