import { expect, test, type Page } from "@playwright/test";
import { clearProjects, db, newId, ORIGIN, seedProject, testUser } from "./seed";

// Sharing a project's app on its own: the Share button next to the preview, who can open
// its link (app/share), and the "Build with Buildinio" badge on it.

const user = testUser("Share Test");
const stranger = testUser("Share Stranger");

test.beforeEach(async ({ context }) => {
  clearProjects(user.id);
  await context.addCookies([{ name: "session", value: user.token, url: ORIGIN }]);
});

function seedBuilt(visibility: "private" | "public" = "private") {
  return seedProject(user.id, {
    name: "Café Menu",
    icon: "coffee",
    color: "amber",
    messages: [
      { role: "user", text: "An online menu for my café" },
      { role: "assistant", text: "**Café Menu** is ready." },
    ],
    built: "<!doctype html><html><body><h1>Café Menu</h1></body></html>",
    visibility,
  });
}

/** One the AI hasn't answered yet: it starts building when its chat opens (tests/fake-openai.mjs). */
function seedBuilding(visibility: "private" | "public" = "private") {
  return seedProject(user.id, {
    name: "Salon Booking",
    icon: "scissors",
    color: "pink",
    messages: [{ role: "user", text: "A booking app for my hair salon" }],
    visibility,
  });
}

const BUILT_HEADING = "Built by the test AI";

function savedVisibility(id: string) {
  const database = db();
  const row = database.prepare("SELECT visibility FROM projects WHERE id = ?").get(id) as { visibility: string };
  database.close();
  return row.visibility;
}

function setVisibility(id: string, visibility: "private" | "public") {
  const database = db();
  database.prepare("UPDATE projects SET visibility = ? WHERE id = ?").run(visibility, id);
  database.close();
}

const center = (box: { x: number; width: number } | null) => box!.x + box!.width / 2;

/** The app at its share link, and the badge over it. */
async function expectSharedApp(page: Page) {
  await expect(page.frameLocator("iframe").getByRole("heading", { name: "Café Menu" })).toBeVisible();
  await expect(page).toHaveTitle("Café Menu");
  const badge = page.getByRole("complementary", { name: "Buildinio" });
  await expect(badge.getByRole("link", { name: "Build with Buildinio" })).toHaveAttribute("href", "/");
  return badge;
}

test("desktop: Share sits by the preview button, makes the link public and copies it", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: ORIGIN });
  await page.setViewportSize({ width: 1280, height: 800 });
  const id = seedBuilt();
  await page.goto(`/projects/${id}`);
  const header = page.locator("header");
  const title = header.getByRole("button", { name: "Options for Café Menu", exact: true });
  const toggle = header.getByRole("button", { name: "Toggle preview" });
  const share = header.getByRole("button", { name: "Share", exact: true });
  const panel = page.getByRole("region", { name: "Preview", exact: true });
  await expect(title).toBeVisible();

  // Always there, left of the preview button, the title still centered over the prompt box,
  // whether the panel shows or not.
  const prompt = page.locator("form").filter({ has: page.getByRole("textbox", { name: "Ask for changes" }) });
  const expectLaidOut = async () => {
    const shareBox = await share.boundingBox();
    expect(shareBox!.x + shareBox!.width).toBeLessThan((await toggle.boundingBox())!.x);
    expect(Math.abs(center(await title.boundingBox()) - center(await prompt.boundingBox()))).toBeLessThanOrEqual(1);
    const titleBox = await title.boundingBox();
    expect(titleBox!.x + titleBox!.width).toBeLessThan(shareBox!.x);
  };
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(share).toBeVisible();
  await expectLaidOut();
  await page.screenshot({ path: test.info().outputPath("desktop-share-closed-panel.png"), animations: "disabled" });
  await toggle.click();
  await expect.poll(() => panel.evaluate((element) => element.getBoundingClientRect().width)).toBe(480);
  await expectLaidOut();

  // Private to start with, shown in the drop-down, which has focus.
  await share.click();
  const popup = page.getByRole("dialog", { name: "Share", exact: true });
  const picker = popup.getByRole("button", { name: /^Who can open the link/ });
  const menu = popup.getByRole("menu", { name: "Who can open the link" });
  const isPrivate = menu.getByRole("menuitemradio", { name: /Private/ });
  const isPublic = menu.getByRole("menuitemradio", { name: /Public/ });
  await expect(picker).toHaveAccessibleName("Who can open the link Private");
  await expect(picker).toBeFocused();
  await expect(popup.getByText(`localhost:3100/share/${id}`)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("desktop-share.png"), animations: "disabled" });

  // Copying shows a check for a moment.
  await popup.getByRole("button", { name: "Copy link" }).click();
  await expect(popup.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${ORIGIN}/share/${id}`);
  await expect(popup.getByRole("button", { name: "Copy link" })).toBeVisible();

  // The drop-down opens on the chosen one; Escape closes just it.
  await picker.click();
  await expect(picker).toHaveAttribute("aria-expanded", "true");
  await expect(isPrivate).toHaveAttribute("aria-checked", "true");
  await expect(isPrivate).toBeFocused();
  await page.screenshot({ path: test.info().outputPath("desktop-share-menu.png"), animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(popup).toBeVisible();
  await expect(picker).toBeFocused();

  // Public by keyboard, saved on the server, and still so after a reload.
  await page.keyboard.press("Enter");
  await page.keyboard.press("ArrowDown");
  await expect(isPublic).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(picker).toHaveAccessibleName("Who can open the link Public");
  await expect(picker).toBeFocused();
  await expect.poll(() => savedVisibility(id)).toBe("public");
  await picker.click();
  await expect(isPublic).toHaveAttribute("aria-checked", "true");
  await expect(isPrivate).toHaveAttribute("aria-checked", "false");
  await page.screenshot({ path: test.info().outputPath("desktop-share-public.png"), animations: "disabled" });
  // A click elsewhere in the pop-up closes just the drop-down.
  await popup.getByText("Who can open the link", { exact: true }).click();
  await expect(menu).toHaveCount(0);
  await expect(popup).toBeVisible();

  // Escape closes it, giving the button its focus back.
  await page.keyboard.press("Escape");
  await expect(popup).toHaveCount(0);
  await expect(share).toBeFocused();

  await page.reload();
  await share.click();
  await expect(picker).toHaveAccessibleName("Who can open the link Public");

  // A click in the app closes it too.
  await panel.frameLocator("iframe").getByRole("heading", { name: "Café Menu" }).click();
  await expect(popup).toHaveCount(0);

  // Hiding the preview leaves it there.
  await toggle.click();
  await expect.poll(() => panel.evaluate((element) => element.getBoundingClientRect().width)).toBe(0);
  await expect(share).toBeVisible();
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`phone ${colorScheme}: the preview's bar goes back on the left and shares on the right`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme });
    await page.goto(`/projects/${seedBuilt()}`);
    const toggle = page.locator("header").getByRole("button", { name: "Toggle preview" });
    await expect(page.locator("header").getByRole("button", { name: "Options for Café Menu", exact: true })).toBeVisible();
    await toggle.click();

    const sheet = page.getByRole("dialog", { name: "Preview", exact: true });
    const back = sheet.getByRole("button", { name: "Close preview" });
    const share = sheet.getByRole("button", { name: "Share", exact: true });
    await expect(back).toBeFocused();
    await expect.poll(() => sheet.evaluate((element) => element.getBoundingClientRect().left)).toBe(0);
    await expect(sheet.getByRole("button", { name: "Open sidebar" })).toHaveCount(0);
    await expect(sheet.getByRole("button", { name: "Toggle preview" })).toHaveCount(0);
    expect(center(await back.boundingBox())).toBeLessThan(60);
    expect(center(await share.boundingBox())).toBeGreaterThan(330);
    await page.screenshot({ path: test.info().outputPath(`phone-bar-${colorScheme}.png`), animations: "disabled" });

    // The pop-up stays on screen; Escape closes it, and only it.
    await share.click();
    const popup = page.getByRole("dialog", { name: "Share", exact: true });
    await expect(popup.getByRole("button", { name: "Who can open the link Private" })).toBeVisible();
    const box = await popup.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(8);
    expect(box!.x + box!.width).toBeLessThanOrEqual(390 - 8);
    await page.screenshot({ path: test.info().outputPath(`phone-share-${colorScheme}.png`), animations: "disabled" });
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await expect(sheet).toBeVisible();
    await expect(share).toBeFocused();

    // Back to the chat.
    await back.click();
    await expect(sheet).not.toBeVisible();
    await expect(toggle).toBeFocused();
  });
}

test("the link: a private app opens only for its owner, a public one for anyone, with the badge", async ({ page, browser }) => {
  const id = seedBuilt();
  const link = `/share/${id}`;

  // Private: its owner sees the app on its own, the badge at the bottom right.
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(link);
  const badge = await expectSharedApp(page);
  const box = await badge.boundingBox();
  expect(1280 - (box!.x + box!.width)).toBeLessThanOrEqual(16);
  expect(800 - (box!.y + box!.height)).toBeLessThanOrEqual(16);
  await page.screenshot({ path: test.info().outputPath("shared-app.png"), animations: "disabled" });

  // Anyone else, signed out or not: not available, and neither are its pages in the preview.
  const visitors = await browser.newContext({ baseURL: ORIGIN, viewport: { width: 390, height: 844 } });
  const visitor = await visitors.newPage();
  for (const token of [null, stranger.token]) {
    if (token) await visitors.addCookies([{ name: "session", value: token, url: ORIGIN }]);
    await visitor.goto(link);
    await expect(visitor.getByRole("heading", { name: "This app isn’t available" })).toBeVisible();
    await expect(visitor).toHaveTitle("App not available - Buildinio");
    await expect(visitor.locator("iframe")).toHaveCount(0);
    expect((await visitor.request.get(`/preview/${id}/index.html`)).status()).toBe(404);
    expect((await visitor.request.get(`/preview/${id}/some/page`)).status()).toBe(404);
  }
  await visitor.screenshot({ path: test.info().outputPath("shared-app-private.png"), animations: "disabled" });

  // Public: anyone. The badge's X hides it.
  setVisibility(id, "public");
  await visitors.clearCookies();
  await visitor.emulateMedia({ colorScheme: "dark" });
  await visitor.reload();
  const visitorBadge = await expectSharedApp(visitor);
  await visitor.screenshot({ path: test.info().outputPath("shared-app-phone-dark.png"), animations: "disabled" });
  await visitorBadge.getByRole("button", { name: "Hide" }).click();
  await expect(visitorBadge).toHaveCount(0);
  expect((await visitor.request.get(`/preview/${id}/index.html`)).status()).toBe(200);

  // Private again: closed to them again.
  setVisibility(id, "private");
  await visitor.reload();
  await expect(visitor.getByRole("heading", { name: "This app isn’t available" })).toBeVisible();
  await visitors.close();
});

test("the link of an app that isn't built yet, or doesn't exist", async ({ page }) => {
  const id = seedProject(user.id, { name: "Salon Booking", visibility: "public" });
  await page.goto(`/share/${id}`);
  await expect(page.getByRole("heading", { name: "Nothing to see yet" })).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);

  for (const missing of [newId(), "not-an-id"]) {
    await page.goto(`/share/${missing}`);
    await expect(page.getByRole("heading", { name: "This app isn’t available" })).toBeVisible();
  }
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`${colorScheme}: while the first version builds, Share says so, then shows the link by itself`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.emulateMedia({ colorScheme });
    await page.goto(`/projects/${seedBuilding()}`);
    const header = page.locator("header");
    await expect(header.getByRole("button", { name: "Options for Salon Booking", exact: true })).toBeVisible();
    await header.getByRole("button", { name: "Toggle preview" }).click();
    await header.getByRole("button", { name: "Share", exact: true }).click();

    const popup = page.getByRole("dialog", { name: "Share", exact: true });
    await expect(popup.getByRole("status")).toContainText("Building your app");
    await expect(popup.getByRole("button", { name: /^Who can open the link/ })).toHaveCount(0);
    await expect(popup.getByRole("button", { name: "Copy link" })).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`share-building-${colorScheme}.png`), animations: "disabled" });

    // Built: the same pop-up turns into the link.
    await expect(popup.getByRole("button", { name: "Who can open the link Private" })).toBeVisible({ timeout: 20_000 });
    await expect(popup.getByRole("button", { name: "Copy link" })).toBeVisible();
    await expect(popup.getByRole("status")).toHaveCount(0);
  });
}

test("the link shows a new build without a refresh", async ({ page, browser }) => {
  const id = seedBuilding("public");
  const visitors = await browser.newContext({ baseURL: ORIGIN });
  const visitor = await visitors.newPage();
  await visitor.goto(`/share/${id}`);
  await expect(visitor.getByRole("heading", { name: "Nothing to see yet" })).toBeVisible();

  // Its owner's chat opening starts the AI, which builds the app: it shows up on its own.
  await page.goto(`/projects/${id}`);
  await expect(visitor.frameLocator("iframe").getByRole("heading", { name: BUILT_HEADING })).toBeVisible({
    timeout: 20_000,
  });
  await expect(visitor.getByRole("complementary", { name: "Buildinio" })).toBeVisible();
  await expect(visitor.locator("iframe")).toHaveAttribute("src", `/preview/${id}/index.html?v=1`);
  await visitors.close();
});

test("the link follows the app going private, public again, and being deleted, without a refresh", async ({ page, browser }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  const id = seedBuilt("public");
  const visitors = await browser.newContext({ baseURL: ORIGIN });
  const visitor = await visitors.newPage();
  await visitor.goto(`/share/${id}`);
  await expectSharedApp(visitor);
  const unavailable = visitor.getByRole("heading", { name: "This app isn’t available" });

  // Its owner turns it private: closed to the visitor at once.
  await page.goto(`/projects/${id}`);
  const header = page.locator("header");
  await header.getByRole("button", { name: "Share", exact: true }).click();
  const popup = page.getByRole("dialog", { name: "Share", exact: true });
  const picker = popup.getByRole("button", { name: /^Who can open the link/ });
  await picker.click();
  await popup.getByRole("menuitemradio", { name: /Private/ }).click();
  await expect(unavailable).toBeVisible();
  await expect(visitor.locator("iframe")).toHaveCount(0);
  await expect(visitor.getByRole("complementary", { name: "Buildinio" })).toHaveCount(0);
  await expect(visitor).toHaveTitle("App not available - Buildinio");

  // Public again: back for them.
  await picker.click();
  await popup.getByRole("menuitemradio", { name: /Public/ }).click();
  await expectSharedApp(visitor);
  await expect(unavailable).toHaveCount(0);
  await page.keyboard.press("Escape");

  // Deleted: gone.
  await header.getByRole("button", { name: "Options for Café Menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await page.getByRole("button", { name: "Delete project", exact: true }).click();
  await expect(unavailable).toBeVisible();
  await visitors.close();
});

test("a private link opens for a visitor who's waiting on it as soon as it's made public", async ({ page, browser }) => {
  const id = seedBuilt();
  const visitors = await browser.newContext({ baseURL: ORIGIN });
  const visitor = await visitors.newPage();
  await visitor.goto(`/share/${id}`);
  await expect(visitor.getByRole("heading", { name: "This app isn’t available" })).toBeVisible();

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/projects/${id}`);
  await page.locator("header").getByRole("button", { name: "Share", exact: true }).click();
  const popup = page.getByRole("dialog", { name: "Share", exact: true });
  await popup.getByRole("button", { name: /^Who can open the link/ }).click();
  await popup.getByRole("menuitemradio", { name: /Public/ }).click();
  await expectSharedApp(visitor);
  await visitors.close();
});
