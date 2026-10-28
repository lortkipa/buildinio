import { existsSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { clearProjects, db, ORIGIN, PROJECTS, testUser } from "./seed";

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
