import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { userPhotos } from "@/lib/db/schema";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Log in to view your photo.", { status: 401 });
  const photo = db.select().from(userPhotos).where(eq(userPhotos.userId, user.id)).get();
  if (!photo) return new Response("Photo not found.", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
