import type { NextRequest } from "next/server";
import { getAvatar } from "@/lib/account/server";
import { isId } from "@/lib/projects/ids";

/**
 * An uploaded avatar. No sign-in needed, like Google's and GitHub's pictures: the long
 * random id keeps it private. A new upload gets a new id, so this one never changes.
 */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/avatars/[id]">) {
  const { id } = await params;
  const avatar = isId(id) ? getAvatar(id) : null;
  if (!avatar) {
    return new Response("Not found.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": avatar.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
