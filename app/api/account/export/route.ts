import { exportAccount } from "@/lib/account/export";
import { getCurrentUser } from "@/lib/auth/session";

/** The signed-in user's data as a .zip download (see lib/account/export.ts). */
export async function GET() {
  const user = await getCurrentUser();
  const zip = user && (await exportAccount(user.id));
  if (!zip) {
    return new Response("Log in to export your data.", { status: 401, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  const date = new Date().toISOString().slice(0, 10);
  return new Response(zip, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="buildinio-export-${date}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
