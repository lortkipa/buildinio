import "server-only";
import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import path from "node:path";
import { asc, eq, sql } from "drizzle-orm";
import { Zip, ZipDeflate, strToU8 } from "fflate";
import { db } from "@/lib/db";
import { messages, projects } from "@/lib/db/schema";
import { listFiles } from "@/lib/sandbox/files";
import { projectDir } from "@/lib/sandbox/workspace";

/** A streamed ZIP of this user's project records, chats and source files. */
export function exportProjects(userId: string) {
  // Keep the metadata and chats consistent, even if a running build finishes next.
  const snapshot = db.transaction((tx) => tx.select().from(projects)
    .where(eq(projects.userId, userId)).orderBy(asc(projects.createdAt)).all()
    .map((project) => ({
      ...project,
      messages: tx.select().from(messages).where(eq(messages.projectId, project.id))
        .orderBy(asc(messages.createdAt), sql`rowid`).all(),
    })));
  let cancelled = false;
  let drain: (() => void) | undefined;
  let zip: Zip;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const waitForReader = async () => {
        while (!cancelled && controller.desiredSize !== null && controller.desiredSize <= 0) {
          await new Promise<void>((resolve) => { drain = resolve; });
        }
      };
      zip = new Zip((error, data, final) => {
        if (cancelled) return;
        if (error) { controller.error(error); cancelled = true; return; }
        controller.enqueue(data);
        if (final) controller.close();
      });
      const addText = (name: string, text: string) => {
        const entry = new ZipDeflate(name);
        zip.add(entry);
        entry.push(strToU8(text), true);
      };
      // Do not return this promise from start: pull must be able to drain the queue.
      const writeArchive = async () => {
        try {
          addText("README.txt", "Buildinio export\n\nEach project folder contains project.json, chat.md and source/.\nSource includes your project files, without installed dependencies, build output or .git.\nA project with no source yet still includes its metadata and chat.\nFiles reflect their state while the export is downloaded; active builds may still be changing them.\n");
          await waitForReader();
          addText("projects.json", JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), projects: snapshot }, null, 2));
          await waitForReader();
          for (const { messages: chat, ...project } of snapshot) {
            if (cancelled) return;
            const folder = `projects/${project.id}`;
            addText(`${folder}/project.json`, JSON.stringify(project, null, 2));
            addText(`${folder}/chat.md`, chat.map((message) =>
              `## ${message.role === "user" ? "You" : "Buildinio"} · ${message.createdAt.toISOString()}\n\n${message.text}\n`,
            ).join("\n"));
            await waitForReader();
            const dir = projectDir(project.id);
            const info = await lstat(dir).catch((error: NodeJS.ErrnoException) => {
              if (error.code === "ENOENT") return null;
              throw error;
            });
            if (!info) continue;
            if (!info.isDirectory() || info.isSymbolicLink()) throw new Error("Project source is not a regular folder.");
            const root = await realpath(dir);
            for (const file of await listFiles(dir)) {
              if (cancelled) return;
              const full = path.join(dir, file.path);
              const resolved = await realpath(full);
              if (!resolved.startsWith(root + path.sep)) throw new Error("Source file leads outside the project.");
              // Refuse symlink files, including ones changed since the directory listing.
              const handle = await open(full, constants.O_RDONLY | constants.O_NOFOLLOW);
              try {
                if (!(await handle.stat()).isFile()) throw new Error("Source is not a regular file.");
                const entry = new ZipDeflate(`${folder}/source/${file.path}`);
                zip.add(entry);
                for await (const chunk of handle.createReadStream({ autoClose: false })) {
                  if (cancelled) return;
                  entry.push(new Uint8Array(chunk), false);
                  await waitForReader();
                }
                entry.push(new Uint8Array(), true);
                await waitForReader();
              } finally {
                await handle.close();
              }
            }
          }
          if (!cancelled) zip.end();
        } catch (error) {
          if (!cancelled) controller.error(error);
          cancelled = true;
          zip.terminate();
        }
      };
      void writeArchive();
    },
    pull() {
      const resume = drain;
      drain = undefined;
      resume?.();
    },
    cancel() {
      cancelled = true;
      drain?.();
      zip?.terminate();
    },
  });
}
