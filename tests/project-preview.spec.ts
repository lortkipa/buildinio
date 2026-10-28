import { expect, test, type Locator, type Page } from "@playwright/test";
import { clearProjects, db, ORIGIN, seedProject, testUser } from "./seed";

const user = testUser("Preview Test");
const BUILT_HEADING = "Built by the test AI"; // What the fake AI builds (tests/fake-openai.mjs).

test.beforeEach(async ({ context }) => {
  clearProjects(user.id);
  await context.addCookies([{ name: "session", value: user.token, url: ORIGIN }]);
});

/** A built app. */
function seedBuilt() {
  return seedProject(user.id, {
    name: "Café Menu",
    icon: "coffee",
    color: "amber",
    messages: [
      { role: "user", text: "An online menu for my café" },
      { role: "assistant", text: "**Café Menu** is ready." },
    ],
    built: "<!doctype html><html><body><h1>Café Menu</h1></body></html>",
  });
}

/** One the AI hasn't answered yet: it starts when the page loads. */
function seedBuilding() {
  return seedProject(user.id, {
    name: "Salon Booking",
    icon: "scissors",
    color: "pink",
    messages: [{ role: "user", text: "A booking app for my hair salon" }],
  });
}

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

async function drag(page: Page, handle: Locator, toX: number, y = 400) {
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, y);
  await page.mouse.down();
  await page.mouse.move(toX, y, { steps: 8 });
  await page.mouse.up();
}

test("desktop: the preview button lines up with the prompt box and the panel resizes, hides and comes back", async ({ page, context }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/projects/${seedBuilt()}`);
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
  await expect(panel.frameLocator("iframe").getByRole("heading", { name: "Café Menu" })).toBeVisible();
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

  // Along its whole height, even beside the prompt box, which floats over the chat.
  await toggle.click();
  await expect.poll(() => width(panel)).toBe(0);
  const prompt = await page.getByRole("textbox", { name: "Ask for changes" }).boundingBox();
  await drag(page, handle, right - 520, prompt!.y + prompt!.height / 2);
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
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme });
    await page.goto(`/projects/${seedBuilding()}`);
    await loaded(page);
    const toggle = page.locator("header").getByRole("button", { name: "Toggle preview" });
    const panel = page.getByRole("region", { name: "Preview", exact: true });

    await toggle.click();
    await expect(panel.getByText("Building your app")).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`desktop-skeleton-${colorScheme}.png`), animations: "disabled" });
    await toggle.click();
    await expect.poll(() => width(panel)).toBe(0);

    // The AI's steps fold away, its answer stays, and the app shows up.
    await expect(page.getByText("Created page.html")).toBeVisible({ timeout: 15_000 });
    await expect(toggle).toHaveAttribute("aria-pressed", "true", { timeout: 15_000 });
    await expect.poll(() => width(panel)).toBe(480);
    await expect(panel.frameLocator("iframe").getByRole("heading", { name: BUILT_HEADING })).toBeVisible();
    await expect(page.getByText("Created page.html")).toHaveCount(0);
    await expect(page.getByText("is ready. Take a look, and tell me what to change.")).toBeVisible();
    await expect(page.getByText("Your app is ready", { exact: true })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`desktop-built-${colorScheme}.png`), animations: "disabled" });
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`phone ${colorScheme}: "app is ready" opens the preview, which slides over the chat`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme });
    await page.goto(`/projects/${seedBuilding()}`);
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
    const ready = page.getByText("Your app is ready", { exact: true });
    await expect(ready).toBeVisible({ timeout: 20_000 });
    await expect(sheet).not.toBeVisible();
    const card = await ready.boundingBox();
    const prompt = await page.getByRole("textbox", { name: "Ask for changes" }).boundingBox();
    expect(card!.y + card!.height).toBeLessThan(prompt!.y);
    await page.screenshot({ path: test.info().outputPath(`phone-ready-${colorScheme}.png`), animations: "disabled" });

    await page.getByRole("button", { name: "View your app" }).click();
    await expect(sheet).toBeVisible();
    await expect(sheet.frameLocator("iframe").getByRole("heading", { name: BUILT_HEADING })).toBeVisible();
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
  await page.setViewportSize({ width: 390, height: 844 });
  const id = seedBuilding();
  await page.goto(`/projects/${id}`);
  await loaded(page);
  const ready = page.getByText("Your app is ready", { exact: true });
  await expect(ready).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Dismiss" }).click();
  await expect(ready).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Preview", exact: true })).not.toBeVisible();
  // Saved on the server, so it stays dismissed.
  await expect.poll(() => {
    const database = db();
    const row = database.prepare("SELECT ready FROM projects WHERE id = ?").get(id) as { ready: number };
    database.close();
    return row.ready;
  }).toBe(0);
  await page.reload();
  await loaded(page);
  await expect(page.getByText("is ready. Take a look")).toBeVisible();
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
    await page.goto(`/projects/${seedBuilt()}`);
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
    await expect(sheet.frameLocator("iframe").getByRole("heading", { name: "Café Menu" })).toBeVisible();
    await expect.poll(() => sheet.evaluate((element) => element.getBoundingClientRect().left)).toBe(0);

    // Left again does nothing; right from the app's left edge pushes it back out (the
    // app's frame keeps touches elsewhere to itself).
    await swipe(page, { x: 330, y: 400 }, { x: 60, y: 400 });
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
    await swipe(page, { x: 8, y: 400 }, { x: 330, y: 410 });
    await expect(sheet).not.toBeVisible();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
  });
});
