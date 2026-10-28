import { createHash, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { test } from "@playwright/test";

// Test data, written straight into the database the test server uses (see playwright.config.ts).

const DATABASE = "data/playwright.db";
export const PROJECTS = "data/playwright-projects";
export const ORIGIN = "http://localhost:3100";

export function db() {
  const database = new Database(DATABASE);
  database.pragma("foreign_keys = ON");
  return database;
}

/** An id like the app makes them. */
export function newId() {
  return randomBytes(16).toString("hex");
}

/** A signed-in user for the tests in this file: made before them and deleted (with their projects) after. */
export function testUser(name: string) {
  const user = { id: `${name}-${randomBytes(8).toString("hex")}`, token: randomBytes(32).toString("hex") };
  test.beforeAll(() => {
    const database = db();
    database
      .prepare("INSERT INTO users (id,email,name,avatar_url,created_at) VALUES (?,?,?,?,?)")
      .run(user.id, `${user.id}@example.test`, name, "/avatars/default.svg", Date.now());
    database
      .prepare("INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)")
      .run(createHash("sha256").update(user.token).digest("hex"), user.id, Date.now() + 3_600_000);
    database.close();
  });
  test.afterAll(() => {
    const database = db();
    database.prepare("DELETE FROM users WHERE id = ?").run(user.id);
    database.close();
  });
  return user;
}

type SeedProject = {
  name: string | null;
  icon?: string;
  color?: string;
  createdAt?: number;
  messages?: { role: "user" | "assistant"; text: string }[];
  built?: string; // The built app's index.html.
};

/** A project of the user's. With `built`, its app is built and ready to preview. */
export function seedProject(userId: string, project: SeedProject) {
  const id = newId();
  const createdAt = project.createdAt ?? Date.now();
  const database = db();
  database
    .prepare("INSERT INTO projects (id,user_id,name,icon,color,ready,app_version,created_at) VALUES (?,?,?,?,?,0,?,?)")
    .run(id, userId, project.name, project.icon ?? "sparkles", project.color ?? "slate", project.built ? 1 : 0, createdAt);
  (project.messages ?? []).forEach((message, index) => {
    database
      .prepare("INSERT INTO messages (id,project_id,role,text,seconds,feedback,created_at) VALUES (?,?,?,?,?,NULL,?)")
      .run(newId(), id, message.role, message.text, message.role === "assistant" ? 1 : null, createdAt + index);
  });
  database.close();
  if (project.built) {
    const dist = path.join(PROJECTS, id, "dist");
    mkdirSync(dist, { recursive: true });
    writeFileSync(path.join(dist, "index.html"), project.built);
  }
  return id;
}

/** Deletes the user's projects (their folders are cleaned up when the test server starts). */
export function clearProjects(userId: string) {
  const database = db();
  database.prepare("DELETE FROM projects WHERE user_id = ?").run(userId);
  database.close();
}
