import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, messages, projects, users } from "@/lib/db/schema";
import { listFiles } from "@/lib/sandbox/files";
import { projectDir } from "@/lib/sandbox/workspace";

// Everything a user has here, as one JSON document: their account and settings (the avatar
// as its address, not the picture itself), and each project with its chat and its code
// (the source, without node_modules or the built app).

const MAX_FILE_BYTES = 10_000_000; // Commands can leave big files behind; the AI's own are far smaller.

export async function exportAccount(userId: string, origin: string) {
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) return null;

  const signIns = db
    .select({ provider: accounts.provider, createdAt: accounts.createdAt })
    .from(accounts)
    .where(eq(accounts.userId, userId))
    .all();

  const rows = db.select().from(projects).where(eq(projects.userId, userId)).orderBy(asc(projects.createdAt)).all();
  const exported = [];
  for (const project of rows) {
    const chat = db
      .select()
      .from(messages)
      .where(eq(messages.projectId, project.id))
      .orderBy(asc(messages.createdAt), sql`rowid`)
      .all();
    const dir = projectDir(project.id);
    const code: Record<string, string> = {};
    for (const file of await listFiles(dir)) {
      if (file.size > MAX_FILE_BYTES) continue;
      const data = await readFile(path.join(dir, file.path)).catch(() => null);
      if (data) code[file.path] = data.toString("utf8");
    }
    exported.push({
      name: project.name,
      icon: project.icon,
      color: project.color,
      visibility: project.visibility,
      createdAt: project.createdAt.toISOString(),
      chat: chat.map((message) => ({
        role: message.role,
        text: message.text,
        sentAt: message.createdAt.toISOString(),
        ...(message.role === "assistant" && { seconds: message.seconds, feedback: message.feedback }),
      })),
      code,
    });
  }

  return {
    name: user.name,
    email: user.email,
    avatar: absolute(origin, user.avatarUrl),
    createdAt: user.createdAt.toISOString(),
    settings: { theme: user.theme, autocorrect: user.autocorrect },
    linkedAccounts: signIns.map((account) => ({ provider: account.provider, linkedAt: account.createdAt.toISOString() })),
    projects: exported,
    exportedAt: new Date().toISOString(),
  };
}

/** A full address: Google and GitHub pictures already are one, uploaded ones are a path. */
function absolute(origin: string, url: string) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `${origin}${url.startsWith("/") ? "" : "/"}${url}`;
}
