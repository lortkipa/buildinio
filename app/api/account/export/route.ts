import { getCurrentUser } from "@/lib/auth/session";
import { exportProjects } from "@/lib/settings/export";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Log in to export your projects.", { status: 401 });
  return new Response(exportProjects(user.id), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="buildinio-export-${new Date().toISOString().slice(0, 10)}.zip"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
