import type { NextRequest } from "next/server";
import { exportAccount } from "@/lib/account/export";
import { getCurrentUser } from "@/lib/auth/session";

/** The signed-in user's data as a .json download (see lib/account/export.ts). */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const data = user && (await exportAccount(user.id, request.nextUrl.origin));
  if (!data) {
    return new Response("Log in to export your data.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const date = new Date().toISOString().slice(0, 10);
  return new Response(`${JSON.stringify(data, null, 2)}\n`, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="buildinio-export-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
