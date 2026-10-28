import { randomBytes, createHash } from "node:crypto";
import Database from "better-sqlite3";
import { expect, test, type Locator, type Page } from "@playwright/test";

const userId = `preview-test-${randomBytes(8).toString("hex")}`;
const token = randomBytes(32).toString("hex");

test.beforeAll(() => {
  const db = new Database("data/playwright.db");
  db.prepare("INSERT INTO users (id,email,name,avatar_url,created_at) VALUES (?,?,?,?,?)")
    .run(userId, `${userId}@example.test`, "Preview Test", "/avatars/default.svg", Date.now());
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

// A built app, and one the AI is still building (its build starts again on load).
test.beforeEach(async ({ page, context }) => {
  await context.addCookies([{ name: "session", value: token, url: "http://localhost:3100" }]);
  await page.addInitScript((userId) => {
    const key = `buildinio:projects:${userId}`;
    if (localStorage.getItem(key)) return; // Keep what changed, across reloads.
    localStorage.setItem(key, JSON.stringify([{
      id: "built", name: "Café Menu", icon: "coffee", color: "amber", createdAt: 1,
      messages: [
        { id: "ask", role: "user", text: "An online menu for my café" },
        { id: "done", role: "assistant", text: "**Café Menu** is ready.", seconds: 20, feedback: null },
      ],
      turn: null,
    }, {
      id: "building", name: "Salon Booking", icon: "scissors", color: "pink", createdAt: 0,
      messages: [{ id: "ask", role: "user", text: "A booking app for my hair salon" }],
      turn: null,
    }]));
  }, userId);
});

/** The projects are in (the title shows), so the build is under way. */
const loaded = (page: Page) =>
  expect(page.locator("header").getByRole("button", { name: "Options for Salon Booking", exact: true })).toBeVisible();

const width = (panel: Locator) => panel.evaluate((element) => element.getBoundingClientRect().width);

/** The preview button's right edge, against the prompt box's. */
async function rightEdges(page: Page) {
  const toggle = await page.locator("header").getByRole("button", { name: "Toggle preview" }).boundingBox();
  const prompt = await page.locator("form").filter({ has: page.getByRole("textbox", { name: "Ask for changes" }) }).boundingBox();
  return [Math.round(toggle!.x + toggle!.width), Math.round(prompt!.x + prompt!.width)];
}

async function drag(page: Page, handle: Locator, toX: number) {
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, 400);
  await page.mouse.down();
  await page.mouse.move(toX, 400, { steps: 8 });
  await page.mouse.up();
}

test("desktop: the preview button lines up with the prompt box and the panel resizes, hides and comes back", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/projects/built");
  const toggle = page.locator("header").getByRole("button", { name: "Toggle preview" });
  const panel = page.getByRole("region", { name: "Preview", exact: true });
  const handle = page.getByRole("separator", { name: "Resize preview" });

  // Hidden to start with, the chat taking the room.
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  expect(await width(panel)).toBe(0);
  await expect.poll(() => rightEdges(page).then(([a, b]) => Math.abs(a - b))).toBeLessThanOrEqual(1);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => width(panel)).toBe(480);
  await expect(panel.getByRole("heading", { name: "Café Menu" })).toBeVisible();
  await expect.poll(() => rightEdges(page).then(([a, b]) => Math.abs(a - b))).toBeLessThanOrEqual(1);
  await page.screenshot({ path: test.info().outputPath("desktop-preview.png"), animations: "disabled" });

  // Dragging its left edge resizes it.
  const right = await panel.evaluate((element) => element.getBoundingClientRect().right);
  await drag(page, handle, right - 600);
  await expect.poll(() => width(panel)).toBe(600);

  // Dragging it narrow hides it completely, remembering the width.
  await drag(page, handle, right - 100);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect.poll(() => width(panel)).toBe(0);
  await toggle.click();
  await expect.poll(() => width(panel)).toBe(600);

  // Its edge stays at the side of the screen while hidden, to drag it back out.
  await toggle.click();
  await expect.poll(() => width(panel)).toBe(0);
  await drag(page, handle, right - 520);
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect.poll(() => width(panel)).toBe(520);

  // The keyboard works too.
  await handle.focus();
  await page.keyboard.press("ArrowLeft");
  await expect.poll(() => width(panel)).toBe(536);
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-pressed", "true");

  // Remembered like the sidebar, so it comes back the same with no jump.
  const cookies = Object.fromEntries((await context.cookies()).map(({ name, value }) => [name, value]));
  expect([cookies.preview_width, cookies.preview_open]).toEqual(["536", "1"]);
  await page.reload();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  expect(await width(panel)).toBe(536);

  // On a narrower screen it gives way, so the chat keeps its room, and the app isn't cut off.
  await page.setViewportSize({ width: 900, height: 800 });
  await expect.poll(() => width(panel)).toBe(900 - 260 - 360);
  const frame = await panel.locator(".rounded-2xl").first().boundingBox();
  const panelBox = await panel.boundingBox();
  expect(frame!.x).toBeGreaterThanOrEqual(panelBox!.x);
  await expect.poll(() => rightEdges(page).then(([a, b]) => Math.abs(a - b))).toBeLessThanOrEqual(1);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`desktop ${colorScheme}: a skeleton while building, then the preview opens by itself`, async ({ page }) => {
    await page.clock.install();
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme });
    await page.goto("/projects/building");
    await loaded(page);
    const toggle = page.locator("header").getByRole("button", { name: "Toggle preview" });
    const panel = page.getByRole("region", { name: "Preview", exact: true });

    await toggle.click();
    await expect(panel.getByText("Building your app")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`desktop-skeleton-${colorScheme}.png`), animations: "disabled" });
    await toggle.click();
    await expect.poll(() => width(panel)).toBe(0);

    await page.clock.runFor(60_000);
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => width(panel)).toBe(480);
    await expect(panel.getByRole("heading", { name: "Salon Booking" })).toBeVisible();
    await expect(page.getByText("Your app is ready", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`desktop-built-${colorScheme}.png`), animations: "disabled" });
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`phone ${colorScheme}: "app is ready" opens the preview, which slides over the chat`, async ({ page }) => {
    await page.clock.install();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme });
    await page.goto("/projects/building");
    await loaded(page);
    const header = page.locator("header");
    const toggle = header.getByRole("button", { name: "Toggle preview" });
    const sheet = page.getByRole("dialog", { name: "Preview", exact: true });

    // Building: the skeleton.
    await toggle.click();
    await expect(sheet.getByText("Building your app")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`phone-skeleton-${colorScheme}.png`), animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(sheet).not.toBeVisible();
    await expect(toggle).toBeFocused();

    // Done: it doesn't cover the chat by itself, but says so above the prompt box.
    await page.clock.runFor(60_000);
    const ready = page.getByText("Your app is ready", { exact: true });
    await expect(ready).toBeVisible();
    await expect(sheet).not.toBeVisible();
    const card = await ready.boundingBox();
    const prompt = await page.getByRole("textbox", { name: "Ask for changes" }).boundingBox();
    expect(card!.y + card!.height).toBeLessThan(prompt!.y);
    await page.screenshot({ path: test.info().outputPath(`phone-ready-${colorScheme}.png`), animations: "disabled" });

    await page.getByRole("button", { name: "View your app" }).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("heading", { name: "Salon Booking" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Open sidebar" })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Options for Salon Booking", exact: true })).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Toggle preview" })).toHaveAttribute("aria-pressed", "true");
    await page.screenshot({ path: test.info().outputPath(`phone-preview-${colorScheme}.png`), animations: "disabled" });

    // Seen, so no card once it's closed.
    await sheet.getByRole("button", { name: "Toggle preview" }).click();
    await expect(sheet).not.toBeVisible();
    await expect(ready).toHaveCount(0);
  });
}

test("phone: the ready card's X dismisses it for good", async ({ page }) => {
  await page.clock.install();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/projects/building");
  await loaded(page);
  await page.clock.runFor(60_000);
  const ready = page.getByText("Your app is ready", { exact: true });
  await expect(ready).toBeVisible();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(ready).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Preview", exact: true })).not.toBeVisible();
  await page.reload();
  await loaded(page);
  await expect(ready).toHaveCount(0);
});

test.describe("phone swipes", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });

  /** A real finger: touch events through the browser, so touch-action applies. */
  async function swipe(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [from] });
    for (let step = 1; step <= 10; step++) {
      const point = { x: from.x + ((to.x - from.x) * step) / 10, y: from.y + ((to.y - from.y) * step) / 10 };
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await cdp.detach();
  }

  test("swiping left on the chat opens the preview, swiping right closes it", async ({ page }) => {
    await page.goto("/projects/built");
    await expect(page.locator("header").getByRole("button", { name: "Options for Café Menu", exact: true })).toBeVisible();
    const sheet = page.getByRole("dialog", { name: "Preview", exact: true });
    const toggle = page.locator("header").getByRole("button", { name: "Toggle preview" });

    // Up and down, or the other way, leave it be.
    await swipe(page, { x: 200, y: 600 }, { x: 205, y: 300 });
    await swipe(page, { x: 100, y: 400 }, { x: 330, y: 400 });
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(sheet).not.toBeVisible();

    await swipe(page, { x: 330, y: 400 }, { x: 60, y: 410 });
    await expect(sheet).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await expect(sheet.getByRole("heading", { name: "Café Menu" })).toBeVisible();
    await expect.poll(() => sheet.evaluate((element) => element.getBoundingClientRect().left)).toBe(0);

    // Left again does nothing; right pushes it back out.
    await swipe(page, { x: 330, y: 400 }, { x: 60, y: 400 });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await swipe(page, { x: 60, y: 400 }, { x: 330, y: 410 });
    await expect(sheet).not.toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
  });
});
