import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { imageType } from "@/lib/account/server";
import { db } from "@/lib/db";
import { attachments, messages, projects } from "@/lib/db/schema";
import { isRunning, stopRun, stopUserRuns } from "@/lib/ai/registry";
import { cleanFileName, extension, isPicture } from "@/lib/projects/attachments";
import { announceChange } from "@/lib/projects/changes";
import { newId } from "@/lib/projects/ids";
import { removeWorkspace } from "@/lib/sandbox/workspace";
import type { ProjectColor, ProjectIcon } from "@/lib/projects/options";
import type { Attachment, Feedback, Message, ProjectData, UserMessage, Visibility } from "@/lib/projects/types";

// The user's projects and chats in the database. Their code is on disk (lib/sandbox).

type Row = typeof projects.$inferSelect;

/** All of a user's projects with their chats, newest first. */
export function listProjects(userId: string): ProjectData[] {
  const rows = db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt)).all();
  if (rows.length === 0) return [];
  const chats = new Map<string, Message[]>();
  const files = attachmentsOf(and(eq(attachments.userId, userId), isNotNull(attachments.messageId))!);
  for (const message of messageRows(inArray(messages.projectId, rows.map((row) => row.id)))) {
    const chat = chats.get(message.projectId) ?? [];
    chat.push(toMessage(message, files));
    chats.set(message.projectId, chat);
  }
  return rows.map((row) => toProject(row, chats.get(row.id) ?? []));
}

/** One of the user's projects, or null if it isn't theirs (or doesn't exist). */
export function getProject(userId: string, id: string): ProjectData | null {
  const row = db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).get();
  if (!row) return null;
  const chat = db.select({ id: messages.id }).from(messages).where(eq(messages.projectId, id));
  const files = attachmentsOf(inArray(attachments.messageId, chat));
  return toProject(row, messageRows(eq(messages.projectId, id)).map((message) => toMessage(message, files)));
}

export function projectExists(id: string) {
  return db.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).get() !== undefined;
}

/**
 * A project's app, for its share link and its pages in the preview: anyone's if it's
 * public, only its owner's (`userId`, null when signed out) if it's private. Null otherwise.
 */
export function getSharedApp(id: string, userId: string | null) {
  const row = db
    .select({
      userId: projects.userId,
      name: projects.name,
      appVersion: projects.appVersion,
      visibility: projects.visibility,
    })
    .from(projects)
    .where(eq(projects.id, id))
    .get();
  if (!row || (row.visibility !== "public" && row.userId !== userId)) return null;
  return { name: row.name, appVersion: row.appVersion };
}

export function insertProject(userId: string, id: string) {
  db.insert(projects).values({ id, userId, icon: "sparkles", color: "slate", createdAt: new Date() }).run();
}

export function addMessage(projectId: string, message: Message) {
  db.insert(messages)
    .values({
      id: message.id,
      projectId,
      role: message.role,
      text: message.text,
      seconds: message.role === "assistant" ? message.seconds : null,
      feedback: message.role === "assistant" ? message.feedback : null,
      questions: message.role === "assistant" ? (message.questions ?? null) : null,
      createdAt: new Date(),
    })
    .run();
}

/** Takes a prompt back out of the chat (Stop, see runs.ts). */
export function deleteMessage(projectId: string, messageId: string) {
  db.delete(messages).where(and(eq(messages.id, messageId), eq(messages.projectId, projectId))).run();
}

/** Retires an answer's questions: a prompt answered them, even one that was stopped. */
export function clearQuestions(projectId: string, messageId: string) {
  db.update(messages)
    .set({ questions: null })
    .where(and(eq(messages.id, messageId), eq(messages.projectId, projectId)))
    .run();
}

class FilesGone extends Error {}

/**
 * Adds a prompt, after the skipped questions sent with it if any (`before`), and claims
 * the files attached to it, in their order. False, and nothing added, if one of the files
 * isn't the user's to attach anymore (sent already, removed, or cleared out).
 */
export function addPrompt(userId: string, projectId: string, prompt: UserMessage, fileIds: string[], before?: UserMessage) {
  try {
    db.transaction(() => {
      if (before) addMessage(projectId, before);
      addMessage(projectId, prompt);
      fileIds.forEach((id, position) => {
        const claimed = db
          .update(attachments)
          .set({ messageId: prompt.id, position })
          .where(and(eq(attachments.id, id), eq(attachments.userId, userId), isNull(attachments.messageId)))
          .run();
        if (claimed.changes === 0) throw new FilesGone();
      });
    });
    return true;
  } catch (error) {
    if (error instanceof FilesGone) return false;
    throw error;
  }
}

// Files attached to prompts. They're uploaded as soon as they're picked, and wait loose
// (without a message) in the prompt box until it's sent.

const MAX_LOOSE = 50; // Files waiting in prompt boxes, per user.
const LOOSE_MS = 24 * 60 * 60 * 1000; // Left in a prompt box this long, they're cleared out.

/** Keeps a file someone attached, loose until a prompt claims it. Null if they have too many waiting. */
export function saveAttachment(userId: string, name: unknown, claimedType: string, data: Buffer): Attachment | null {
  const loose = db
    .select({ count: sql<number>`count(*)` })
    .from(attachments)
    .where(and(eq(attachments.userId, userId), isNull(attachments.messageId)))
    .get();
  if ((loose?.count ?? 0) >= MAX_LOOSE) return null;
  const clean = cleanFileName(name);
  const file: Attachment = { id: newId(), name: clean, type: fileType(data, clean, claimedType), size: data.length };
  db.insert(attachments)
    .values({ id: file.id, userId, name: file.name, contentType: file.type, size: file.size, data, createdAt: new Date() })
    .run();
  return file;
}

/** One of the user's files, with its bytes. */
export function getAttachment(userId: string, id: string) {
  return (
    db
      .select({ name: attachments.name, contentType: attachments.contentType, data: attachments.data })
      .from(attachments)
      .where(and(eq(attachments.id, id), eq(attachments.userId, userId)))
      .get() ?? null
  );
}

/** Removed from the prompt box before it was sent. */
export function deleteLooseAttachment(userId: string, id: string) {
  db.delete(attachments)
    .where(and(eq(attachments.id, id), eq(attachments.userId, userId), isNull(attachments.messageId)))
    .run();
}

/** Takes a stopped prompt's files back off it, loose again for the prompt box (see runs.ts's `withdraw`). */
export function releaseAttachments(messageId: string) {
  const files = attachmentsOf(eq(attachments.messageId, messageId)).get(messageId) ?? [];
  db.update(attachments)
    .set({ messageId: null, position: 0, createdAt: new Date() })
    .where(eq(attachments.messageId, messageId))
    .run();
  return files;
}

/** Every file attached in a project's chat, in the order they were sent. */
export function projectAttachments(projectId: string): Attachment[] {
  return db
    .select({ id: attachments.id, name: attachments.name, type: attachments.contentType, size: attachments.size })
    .from(attachments)
    .innerJoin(messages, eq(attachments.messageId, messages.id))
    .where(eq(messages.projectId, projectId))
    .orderBy(asc(messages.createdAt), sql`${messages}.rowid`, asc(attachments.position))
    .all();
}

/** The files' bytes, by id. */
export function attachmentData(ids: string[]) {
  if (ids.length === 0) return new Map<string, Buffer>();
  const rows = db.select({ id: attachments.id, data: attachments.data }).from(attachments).where(inArray(attachments.id, ids)).all();
  return new Map(rows.map((row) => [row.id, row.data]));
}

/** Clears out files left in prompt boxes and never sent. */
export function pruneLooseAttachments() {
  db.delete(attachments)
    .where(and(isNull(attachments.messageId), lt(attachments.createdAt, new Date(Date.now() - LOOSE_MS))))
    .run();
}

/**
 * The file's type, from its bytes for pictures and PDFs (the ones that show as pictures
 * or go to the AI), so a renamed file isn't taken for one. Otherwise what the browser said.
 */
function fileType(data: Buffer, name: string, claimed: string) {
  const known = imageType(data);
  if (known) return known;
  const head = data.toString("latin1", 0, 6);
  if (head === "GIF87a" || head === "GIF89a") return "image/gif";
  if (head.startsWith("%PDF-")) return "application/pdf";
  const svg = extension(name).toLowerCase() === "svg" || claimed === "image/svg+xml";
  const start = data.toString("utf8", 0, 4096).trimStart();
  if (svg && start.startsWith("<") && /<svg[\s>]/i.test(start)) return "image/svg+xml";
  if (isPicture(claimed) || claimed === "application/pdf") return "application/octet-stream";
  return /^[\w.+-]+\/[\w.+-]+$/.test(claimed) ? claimed.toLowerCase() : "application/octet-stream";
}

/** The files of the messages found by `where`, by message, in their order. */
function attachmentsOf(where: SQL) {
  const rows = db
    .select({
      id: attachments.id,
      messageId: attachments.messageId,
      name: attachments.name,
      type: attachments.contentType,
      size: attachments.size,
    })
    .from(attachments)
    .where(where)
    .orderBy(asc(attachments.position))
    .all();
  const files = new Map<string, Attachment[]>();
  for (const { messageId, ...file } of rows) {
    if (!messageId) continue;
    files.set(messageId, [...(files.get(messageId) ?? []), file]);
  }
  return files;
}

export function updateProject(
  id: string,
  changes: Partial<{
    name: string | null;
    icon: ProjectIcon;
    color: ProjectColor;
    ready: boolean;
    appVersion: number;
    visibility: Visibility;
  }>,
) {
  db.update(projects).set(changes).where(eq(projects.id, id)).run();
}

/** Gives the project the AI's name, unless it was named (by hand) in the meantime. */
export function nameProject(id: string, name: string, icon: ProjectIcon, color: ProjectColor) {
  const result = db
    .update(projects)
    .set({ name, icon, color })
    .where(and(eq(projects.id, id), sql`${projects.name} is null`))
    .run();
  return result.changes > 0;
}

export function setFeedback(projectId: string, messageId: string, feedback: Feedback | null) {
  db.update(messages)
    .set({ feedback })
    .where(and(eq(messages.id, messageId), eq(messages.projectId, projectId), eq(messages.role, "assistant")))
    .run();
}

/** Deletes a project: stops the AI if it's working on it, then drops its chat and its code. */
export async function removeProject(id: string) {
  await stopRun(id);
  db.delete(projects).where(eq(projects.id, id)).run(); // Messages go with it.
  announceChange(id); // Gone from its share page too.
  await removeWorkspace(id);
}

/** The code of every project a user has, before their account (and with it the rows) is deleted. */
export async function removeUserProjects(userId: string) {
  await stopUserRuns(userId);
  const rows = db.select({ id: projects.id }).from(projects).where(eq(projects.userId, userId)).all();
  for (const { id } of rows) await removeWorkspace(id);
}

function messageRows(where: SQL) {
  return db.select().from(messages).where(where).orderBy(asc(messages.createdAt), sql`rowid`).all();
}

function toMessage(row: typeof messages.$inferSelect, files: Map<string, Attachment[]>): Message {
  const attached = files.get(row.id);
  return row.role === "user"
    ? { id: row.id, role: "user", text: row.text, ...(attached && { attachments: attached }) }
    : {
        id: row.id,
        role: "assistant",
        text: row.text,
        seconds: row.seconds ?? 0,
        feedback: row.feedback ?? null,
        ...(row.questions && { questions: row.questions }),
      };
}

function toProject(row: Row, chat: Message[]): ProjectData {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    createdAt: row.createdAt.getTime(),
    messages: chat,
    ready: row.ready,
    appVersion: row.appVersion,
    visibility: row.visibility,
    running: isRunning(row.id),
  };
}
