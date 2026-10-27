import { randomBytes, createHash } from "node:crypto";
import Database from "better-sqlite3";
import { expect, test } from "@playwright/test";

const userId = `header-test-${randomBytes(8).toString("hex")}`;
const token = randomBytes(32).toString("hex");
const projectName = "A very long project name that cannot fit a phone header";

test.beforeAll(() => {
  const db = new Database("data/playwright.db");
  db.prepare("INSERT INTO users (id,email,name,avatar_url,created_at) VALUES (?,?,?,?,?)")
    .run(userId, `${userId}@example.test`, "Header Test", "/avatars/default.svg", Date.now());
  db.prepare("INSERT INTO sessions (id,user_id,expires_at) VALUES (?,?,?)")
    .run(createHash("sha256").update(token).digest("hex"), userId, Date.now() + 3_600_000);
  db.close();
});

test.afterAll(() => {
  const db = new Database("data/playwright.db");
  db.pragma("foreign_keys = ON");
  db.prepare("DELETE FROM users WHERE id = ?").run(userId);
  db.close();
});

test.beforeEach(async ({ page, context }) => {
  await context.addCookies([{ name: "session", value: token, url: "http://localhost:3100" }]);
  await page.addInitScript(({ userId, projectName }) => {
    localStorage.setItem(`buildinio:projects:${userId}`, JSON.stringify([{
      id: "header-project", name: projectName, icon: "sparkles", color: "slate", createdAt: 1,
      messages: Array.from({ length: 20 }, (_, index) => ({
        id: `message-${index}`, role: "assistant", text: `Message ${index}: Here is the app we built for you.`,
        seconds: 1, feedback: null,
      })), turn: null,
    }, {
      id: "other-project", name: "Other app", icon: "sparkles", color: "slate", createdAt: 0,
      messages: [], turn: null,
    }]));
  }, { userId, projectName });
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`mobile ${colorScheme}: title edits, preview toggles, and deletion asks first`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme });
    await page.goto("/projects/header-project");
    const header = page.locator("header");
    const title = header.getByRole("button", { name: `Options for ${projectName}`, exact: true });
    const preview = header.getByRole("button", { name: "Toggle preview" });
    await expect(title).toBeVisible();
    await expect(header.getByRole("button", { name: "Account", exact: true })).toHaveCount(0);
    await expect(preview).toHaveAttribute("aria-pressed", "false");
    const previewColors = await preview.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.backgroundColor, style.color];
    });
    await preview.click();
    await expect(preview).toHaveAttribute("aria-pressed", "true");
    await page.mouse.move(0, 100);
    await expect.poll(() => preview.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.backgroundColor, style.color];
    })).toEqual(previewColors);
    await preview.click();
    await expect(preview).toHaveAttribute("aria-pressed", "false");
    await page.mouse.move(0, 100);

    // The whole name remains accessible while its visible text truncates before the chevron.
    expect(await title.locator("span").evaluate((element) => {
      const style = getComputedStyle(element);
      return element.scrollWidth > element.clientWidth && style.textOverflow === "ellipsis" && style.maskImage === "none";
    })).toBe(true);
    const fade = page.locator("main > div[aria-hidden]").first();
    await expect(fade).not.toHaveClass(/opacity-0/);
    expect(await fade.evaluate((element) => getComputedStyle(element).backdropFilter)).toBe("none");
    const sidebarButton = header.getByRole("button", { name: "Open sidebar" });
    const sidebarAppearance = await sidebarButton.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.borderRadius, style.backgroundColor, style.width, style.height];
    });
    await page.screenshot({ path: test.info().outputPath(`mobile-header-${colorScheme}.png`) });

    await title.click();
    const menu = page.getByRole("menu", { name: "Project", exact: true });
    await expect(menu.getByRole("menuitem", { name: "Edit", exact: true })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Delete", exact: true })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).not.toBeVisible();
    await expect(title).toBeFocused();
    await title.click();
    await menu.getByRole("menuitem", { name: "Edit", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "Edit project", exact: true });
    await editor.getByRole("textbox", { name: "Name", exact: true }).fill("Updated app");
    await editor.getByRole("button", { name: "Save", exact: true }).click();
    const renamedTitle = header.getByRole("button", { name: "Options for Updated app", exact: true });
    await expect(renamedTitle).toBeVisible();
    await expect(page).toHaveTitle("Updated app - Buildinio");

    // Header edits update the same store and actions used by the sidebar.
    await header.getByRole("button", { name: "Open sidebar" }).click();
    const sidebar = page.getByRole("dialog", { name: "Sidebar", exact: true });
    await expect(sidebar.getByRole("link", { name: "Updated app", exact: true })).toBeVisible();
    await sidebar.getByRole("button", { name: "Options for Updated app", exact: true }).click();
    await menu.getByRole("menuitem", { name: "Edit", exact: true }).click();
    await expect(editor).toBeVisible();
    await editor.getByRole("button", { name: "Cancel", exact: true }).click();
    await sidebar.getByRole("button", { name: "Close sidebar" }).click();

    await renamedTitle.click();
    await menu.getByRole("menuitem", { name: "Delete", exact: true }).click();
    const confirmation = page.getByRole("dialog", { name: "Delete “Updated app”?", exact: true });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(renamedTitle).toBeVisible();
    await renamedTitle.click();
    await menu.getByRole("menuitem", { name: "Delete", exact: true }).click();
    await confirmation.getByRole("button", { name: "Delete project", exact: true }).click();
    await expect(page).toHaveURL("http://localhost:3100/");
    await expect(header.getByRole("button", { name: "Account", exact: true })).toBeVisible();
    await expect(header.getByRole("button", { name: "Toggle preview" })).toHaveCount(0);
    expect(await sidebarButton.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.borderRadius, style.backgroundColor, style.width, style.height];
    })).toEqual(sidebarAppearance);
    expect(await page.evaluate((userId) => JSON.parse(localStorage.getItem(`buildinio:projects:${userId}`)!).length, userId)).toBe(1);
  });
}

test("preview stays mobile-only and the title menu works across screen sizes", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/projects/header-project");
  const header = page.locator("header");
  const preview = header.getByRole("button", { name: "Toggle preview" });
  await preview.click();
  await header.getByRole("button", { name: "Open sidebar" }).click();
  await page.getByRole("dialog", { name: "Sidebar", exact: true }).getByRole("link", { name: "Other app", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/other-project$/);
  await expect(preview).toHaveAttribute("aria-pressed", "false");
  await expect(header.getByRole("button", { name: "Options for Other app", exact: true })).toBeVisible();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(preview).not.toBeVisible();
  const title = header.getByRole("button", { name: "Options for Other app", exact: true });
  await expect(title).toBeVisible();
  await title.click();
  await page.getByRole("menuitem", { name: "Edit", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Edit project", exact: true });
  await expect(editor).toBeVisible();
  await editor.getByRole("button", { name: "Cancel", exact: true }).click();
  await title.click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Delete “Other app”?", exact: true });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.screenshot({ path: test.info().outputPath("desktop-header.png") });
});
