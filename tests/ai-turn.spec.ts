import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { clearProjects, db, ORIGIN, PROJECTS, seedProject, testUser, newId } from "./seed";

// The AI end to end, with tests/fake-openai.mjs standing in for OpenAI: the turn route,
// the AI's tools writing files, the build, the preview, and deleting it all again.

const user = testUser("AI Test");
const BUILT_HEADING = "Built by the test AI";

test.beforeEach(async ({ page, context }) => {
  clearProjects(user.id);
  await context.addCookies([{ name: "session", value: user.token, url: ORIGIN }]);
  await page.setViewportSize({ width: 1280, height: 800 });
});

/** Sends the first prompt from New and returns the new project's id. */
async function startProject(page: Page, prompt: string) {
  await page.goto("/");
  await page.locator("textarea:visible").fill(prompt);
  await page.locator("textarea:visible").press("Enter");
  await page.waitForURL("**/projects/*");
  return new URL(page.url()).pathname.split("/").at(-1)!;
}

function saved(id: string) {
  const database = db();
  const project = database.prepare("SELECT app_version AS appVersion FROM projects WHERE id = ?").get(id) as
    | { appVersion: number }
    | undefined;
  const roles = database.prepare("SELECT role FROM messages WHERE project_id = ? ORDER BY created_at").all(id) as {
    role: string;
  }[];
  database.close();
  return { appVersion: project?.appVersion ?? null, roles: roles.map(({ role }) => role) };
}

test("a prompt builds the app, which shows in the preview, and deleting the project deletes its code", async ({ page }) => {
  const id = await startProject(page, "A page for my test kitchen");
  const header = page.locator("header");
  const toggle = header.getByRole("button", { name: "Toggle preview" });
  const panel = page.getByRole("region", { name: "Preview", exact: true });

  // Named, then building step by step.
  const title = header.getByRole("button", { name: "Options for Test Kitchen", exact: true });
  await expect(title).toBeVisible();
  await expect(page.getByRole("link", { name: "Test Kitchen", exact: true })).toBeVisible();
  await expect(page.getByText("Created page.html")).toBeVisible({ timeout: 15_000 });

  // Built: the preview opens by itself with the app in it.
  await expect(toggle).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  await expect(panel.frameLocator("iframe").getByRole("heading", { name: BUILT_HEADING })).toBeVisible();
  await expect(page.getByText("Created page.html")).toHaveCount(0);
  await page.screenshot({ path: test.info().outputPath("built.png"), animations: "disabled" });
  expect(saved(id)).toEqual({ appVersion: 1, roles: ["user", "assistant"] });
  expect(existsSync(path.join(PROJECTS, id, "dist", "index.html"))).toBe(true);

  // Kept on the server: it's all there after a reload.
  await page.reload();
  await expect(page.getByText("A page for my test kitchen")).toBeVisible();
  await expect(page.getByText("is ready. Take a look")).toBeVisible();
  await expect(panel.frameLocator("iframe").getByRole("heading", { name: BUILT_HEADING })).toBeVisible();

  // The preview is sandboxed, even opened on its own.
  const response = await page.request.get(`/preview/${id}/index.html`);
  expect(response.headers()["content-security-policy"]).toContain("sandbox allow-scripts");
  expect((await page.request.get(`/preview/${id}/%2e%2e/package.json`)).status()).toBe(404);

  await title.click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete project", exact: true }).click();
  await expect(page).toHaveURL(`${ORIGIN}/`);
  await expect.poll(() => existsSync(path.join(PROJECTS, id))).toBe(false);
  expect(saved(id)).toEqual({ appVersion: null, roles: [] });
  expect((await page.request.get(`/preview/${id}/index.html`)).status()).toBe(404);
});

test("the AI reads up on a skill when one fits, and builds with it", async ({ page }) => {
  const id = await startProject(page, "A page for my test kitchen with a warm design");
  await expect(page.getByText("Read up on frontend design")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("is ready, designed with the guide.")).toBeVisible({ timeout: 15_000 });
  expect(saved(id)).toEqual({ appVersion: 1, roles: ["user", "assistant"] });
});

test("the AI looks at the app it built, on a phone and a desktop", async ({ page }) => {
  const id = await startProject(page, "A page for my test kitchen, then look at it");
  await expect(page.getByText("Looked at your app")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("is ready, and I checked how it looks.")).toBeVisible({ timeout: 15_000 });
  expect(saved(id)).toEqual({ appVersion: 1, roles: ["user", "assistant"] }); // Built to look at, and not again.
  expect(existsSync(path.join(PROJECTS, id, "dist", ".look", "phone.png"))).toBe(true);
});

test("a question just gets an answer, and nothing is built", async ({ page }) => {
  const id = await startProject(page, "What can you build?");
  await expect(page.getByText("Good question. I can build websites and apps from a description.")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator("[aria-busy]")).toHaveCount(0);
  await page.locator("header").getByRole("button", { name: "Toggle preview" }).click();
  await expect(page.getByText("Your app shows up here once there’s something to see.")).toBeVisible();
  expect(saved(id)).toEqual({ appVersion: 0, roles: ["user", "assistant"] });
});

test("the AI keeps working through a reload, and answers once", async ({ page }) => {
  const id = await startProject(page, "A page for my test kitchen");
  await expect(page.getByText("Thinking")).toBeVisible();
  await page.reload();

  // Joined back in: the answer finishes and the app shows up.
  const toggle = page.locator("header").getByRole("button", { name: "Toggle preview" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
  await expect(page.getByText("is ready. Take a look")).toBeVisible();
  expect(saved(id)).toEqual({ appVersion: 1, roles: ["user", "assistant"] });
});

function projectLook(id: string) {
  const database = db();
  const look = database.prepare("SELECT name, icon, color FROM projects WHERE id = ?").get(id);
  database.close();
  return look;
}

test("the AI changes project settings with visible tool rows and keeps them after reload", async ({ page }) => {
  const id = seedProject(user.id, { name: "Old Garden", icon: "coffee", color: "amber" });
  await page.goto(`/projects/${id}`);
  await page.locator("textarea:visible").fill("Change project settings to Moon Garden, leaf icon and violet color");
  await page.locator("textarea:visible").press("Enter");
  for (const label of ["Renamed project", "Changed project icon", "Changed project color"]) {
    const row = page.getByRole("listitem").filter({ hasText: label });
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.getByLabel("Done", { exact: true })).toBeVisible();
  }
  await expect(page.locator("header").getByRole("button", { name: "Options for Moon Garden", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Moon Garden", exact: true })).toBeVisible();
  await expect(page.locator("[aria-busy]")).toHaveCount(0, { timeout: 15_000 });
  expect(projectLook(id)).toEqual({ name: "Moon Garden", icon: "leaf", color: "violet" });
  expect(saved(id).appVersion).toBe(0);
  await page.reload();
  const title = page.locator("header").getByRole("button", { name: "Options for Moon Garden", exact: true });
  await expect(title).toBeVisible();
  await expect(page).toHaveTitle("Moon Garden - Buildinio");
  await title.click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  await expect(page.getByRole("radio", { name: "Leaf", exact: true })).toBeChecked();
  await expect(page.getByRole("radio", { name: "Violet", exact: true })).toBeChecked();
});

test("renaming alone preserves the project's icon and color", async ({ page }) => {
  const id = seedProject(user.id, { name: "Old Garden", icon: "coffee", color: "amber" });
  await page.goto(`/projects/${id}`);
  await page.locator("textarea:visible").fill("Change project settings: name only to Moon Garden");
  await page.locator("textarea:visible").press("Enter");
  await expect(page.getByText("Renamed project", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[aria-busy]")).toHaveCount(0, { timeout: 15_000 });
  expect(projectLook(id)).toEqual({ name: "Moon Garden", icon: "coffee", color: "amber" });
  expect(saved(id).appVersion).toBe(0);
});

test("invalid AI project settings show failed tools and leave settings unchanged", async ({ page }) => {
  const id = seedProject(user.id, { name: "Old Garden", icon: "coffee", color: "amber" });
  await page.goto(`/projects/${id}`);
  await page.locator("textarea:visible").fill("Try invalid project settings");
  await page.locator("textarea:visible").press("Enter");
  await expect(page.getByLabel("Failed", { exact: true })).toHaveCount(3, { timeout: 15_000 });
  await expect(page.locator("[aria-busy]")).toHaveCount(0, { timeout: 15_000 });
  expect(projectLook(id)).toEqual({ name: "Old Garden", icon: "coffee", color: "amber" });
  expect(saved(id).appVersion).toBe(0);
});

test("an explicit color on the first prompt wins over initial naming", async ({ page }) => {
  const id = await startProject(page, "Change project color only to violet");
  await expect(page.getByText("Changed project color", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("[aria-busy]")).toHaveCount(0, { timeout: 15_000 });
  expect(projectLook(id)).toEqual({ name: "Test Kitchen", icon: "utensils", color: "violet" });
  expect(saved(id).appVersion).toBe(0);
});


test("rejoining a turn replays changed settings, including after it finishes", async ({ page }) => {
  const id = seedProject(user.id, { name: "Old Garden", icon: "coffee", color: "amber" });
  const endpoint = `/api/projects/${id}/turn`;
  const answering = page.request.post(endpoint, {
    data: { text: "Change project settings", messageId: newId() },
  });
  await expect.poll(() => projectLook(id), { timeout: 15_000 }).toEqual({ name: "Moon Garden", icon: "leaf", color: "violet" });
  const joined = await page.request.post(endpoint, { data: {} });
  const events = (await joined.text()).trim().split("\n").map((line) => JSON.parse(line));
  expect(events[0]).toMatchObject({
    type: "snapshot",
    changes: { name: "Moon Garden", icon: "leaf", color: "violet" },
  });
  expect((await answering).ok()).toBe(true);
  const finished = await page.request.post(endpoint, { data: {} });
  const finalEvents = (await finished.text()).trim().split("\n").map((line) => JSON.parse(line));
  expect(finalEvents[0]).toEqual({ type: "project_updated", changes: { name: "Moon Garden", icon: "leaf", color: "violet" } });
  expect(finalEvents[1].type).toBe("done");
});
