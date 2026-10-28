import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { db } from "@/lib/db";
import { messages, projects } from "@/lib/db/schema";
import { isRunning, stopRun, stopUserRuns } from "@/lib/ai/registry";
import { removeWorkspace } from "@/lib/sandbox/workspace";
import type { ProjectColor, ProjectIcon } from "@/lib/projects/options";
import type { Feedback, Message, ProjectData } from "@/lib/projects/types";

// The user's projects and chats in the database. Their code is on disk (lib/sandbox).

type Row = typeof projects.$inferSelect;

/** All of a user's projects with their chats, newest first. */
export function listProjects(userId: string): ProjectData[] {
  const rows = db.select().from(projects).where(eq(projects.userId, userId)).orderBy(desc(projects.createdAt)).all();
  if (rows.length === 0) return [];
  const chats = new Map<string, Message[]>();
  for (const message of messageRows(inArray(messages.projectId, rows.map((row) => row.id)))) {
    const chat = chats.get(message.projectId) ?? [];
    chat.push(toMessage(message));
    chats.set(message.projectId, chat);
  }
  return rows.map((row) => toProject(row, chats.get(row.id) ?? []));
}

/** One of the user's projects, or null if it isn't theirs (or doesn't exist). */
export function getProject(userId: string, id: string): ProjectData | null {
  const row = db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).get();
  return row ? toProject(row, messageRows(eq(messages.projectId, id)).map(toMessage)) : null;
}

export function projectExists(id: string) {
  return db.select({ id: projects.id }).from(projects).where(eq(projects.id, id)).get() !== undefined;
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
      createdAt: new Date(),
    })
    .run();
}

export function updateProject(
  id: string,
  changes: Partial<{ name: string; icon: ProjectIcon; color: ProjectColor; ready: boolean; appVersion: number }>,
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

function toMessage(row: typeof messages.$inferSelect): Message {
  return row.role === "user"
    ? { id: row.id, role: "user", text: row.text }
    : { id: row.id, role: "assistant", text: row.text, seconds: row.seconds ?? 0, feedback: row.feedback ?? null };
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
    running: isRunning(row.id),
  };
}
