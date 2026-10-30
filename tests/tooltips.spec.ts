import { expect, test, type Locator, type Page } from "@playwright/test";
import { clearProjects, ORIGIN, seedProject, testUser } from "./seed";

const user = testUser("Tooltip Test");
let project = "";

test.beforeEach(async ({ context }) => {
  clearProjects(user.id);
  project = seedProject(user.id, {
    name: "Moon Garden",
    messages: [
      { role: "user", text: "Build a planting calendar" },
      { role: "assistant", text: "Here it is." },
    ],
    built: "<!doctype html><title>Moon Garden</title><h1>Moon Garden</h1>",
  });
  await context.addCookies([{ name: "session", value: user.token, url: ORIGIN }]);
});

const tooltip = (page: Page) => page.locator("[data-tooltip]");

/** Hovers the button and waits for its tooltip; checks it sits on the given side, inside the screen. */
async function hoverFor(page: Page, button: Locator, text: string | RegExp, side: "top" | "bottom" | "right") {
  await button.hover();
  await expect(tooltip(page)).toHaveText(text);
  const tip = (await tooltip(page).boundingBox())!;
  const box = (await button.boundingBox())!;
  if (side === "right") expect(tip.x).toBeGreaterThanOrEqual(box.x + box.width);
  if (side === "bottom") expect(tip.y).toBeGreaterThanOrEqual(box.y + box.height);
  if (side === "top") expect(tip.y + tip.height).toBeLessThanOrEqual(box.y);
  const viewport = page.viewportSize()!;
  expect(tip.x).toBeGreaterThanOrEqual(0);
  expect(tip.x + tip.width).toBeLessThanOrEqual(viewport.width);
}

test("desktop: the collapsed sidebar's tabs and avatar, and its toggle, have tooltips", async ({ page, context }) => {
  await context.addCookies([{ name: "sidebar_collapsed", value: "1", url: ORIGIN }]);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const sidebar = page.locator("aside");

  await hoverFor(page, sidebar.getByRole("link", { name: "New" }), "New", "right");
  // The next one shows at once.
  await sidebar.getByRole("button", { name: "Search", exact: true }).hover();
  await expect(tooltip(page)).toHaveText(/^Search(Ctrl|⌘)K$/, { timeout: 200 });
  await hoverFor(page, sidebar.getByRole("button", { name: "Account", exact: true }), "Tooltip Test", "right");
  await page.screenshot({ path: test.info().outputPath("collapsed-avatar.png") });

  // Opening its menu hides it.
  await sidebar.getByRole("button", { name: "Account", exact: true }).click();
  await expect(tooltip(page)).toHaveCount(0);
  await page.keyboard.press("Escape");

  const toggle = sidebar.getByRole("button", { name: "Open sidebar" });
  await hoverFor(page, toggle, "Open sidebar", "right");
  // Pressed, it's gone until the pointer leaves and comes back.
  await toggle.click();
  await expect(tooltip(page)).toHaveCount(0);
  await page.mouse.move(640, 400);

  // With the sidebar open, the tabs and the avatar show their labels: no tooltips.
  await sidebar.getByRole("link", { name: "New" }).hover();
  await sidebar.getByRole("button", { name: "Account", exact: true }).hover();
  await page.waitForTimeout(800);
  await expect(tooltip(page)).toHaveCount(0);
});

test("desktop: share, preview and the prompt box's buttons have tooltips", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/projects/${project}`);
  const header = page.locator("header");

  const share = header.getByRole("button", { name: "Share" });
  await hoverFor(page, share, "Share", "bottom");
  await share.click();
  await expect(tooltip(page)).toHaveCount(0);
  await page.keyboard.press("Escape");

  const toggle = header.getByRole("button", { name: "Toggle preview" }).filter({ visible: true });
  await page.mouse.move(640, 400);
  await hoverFor(page, toggle, /^(Show|Hide) preview$/, "bottom");

  await page.mouse.move(640, 400);
  await hoverFor(page, page.getByRole("button", { name: "Add files" }), "Add files", "top");
  await hoverFor(page, page.getByRole("button", { name: "Use voice input" }), "Voice input", "top");
  await page.getByRole("textbox", { name: "Ask for changes" }).fill("Make it green");
  await page.mouse.move(640, 400);
  await hoverFor(page, page.getByRole("button", { name: "Send" }), "Send↵", "top");
  await page.screenshot({ path: test.info().outputPath("send.png") });

  // Keyboard focus shows it at once; Escape hides it.
  await page.mouse.move(640, 400);
  await page.getByRole("button", { name: "Add files" }).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(tooltip(page)).toHaveText("Add files");
  await page.keyboard.press("Escape");
  await expect(tooltip(page)).toHaveCount(0);
});

test.describe("touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("tapping a button shows no tooltip", async ({ page }) => {
    await page.goto(`/projects/${project}`);
    await page.getByRole("button", { name: "Add files" }).tap();
    await page.waitForTimeout(800);
    await expect(tooltip(page)).toHaveCount(0);
  });
});
