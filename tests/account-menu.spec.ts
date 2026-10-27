import { randomBytes, createHash } from "node:crypto";
import Database from "better-sqlite3";
import { expect, test, type Page } from "@playwright/test";

const userId = `popup-test-${randomBytes(8).toString("hex")}`;
const token = randomBytes(32).toString("hex");

test.beforeAll(() => {
  const db = new Database("data/playwright.db");
  db.prepare("INSERT INTO users (id,email,name,avatar_url,created_at) VALUES (?,?,?,?,?)")
    .run(userId, `${userId}@example.test`, "Popup Test", "/avatars/default.svg", Date.now());
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

async function checkPopup(page: Page, inSidebar: boolean) {
  const scope = inSidebar ? page.getByRole("dialog", { name: "Sidebar" }) : page;
  const trigger = scope.getByRole("button", { name: "Account", exact: true }).filter({ visible: true });
  await trigger.click();
  const menuId = await trigger.getAttribute("aria-controls");
  const menu = page.locator(`[id="${menuId}"]`);
  await expect(menu).toBeVisible();
  // Sample the whole panel, including its right side beyond the sidebar boundary.
  // Hit testing also catches another element painting over the panel.
  await expect.poll(() => menu.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.left < 0 || rect.right > innerWidth || rect.top < 0 || rect.bottom > innerHeight) return false;
    return [0.1, 0.5, 0.9].every((x) => [0.1, 0.5, 0.9].every((y) =>
      element.contains(document.elementFromPoint(rect.left + rect.width * x, rect.top + rect.height * y)),
    ));
  })).toBe(true);
  await menu.screenshot({ path: test.info().outputPath("account-popup.png") });
  // A pointer click at the formerly covered right edge must reach the action.
  const action = menu.getByRole("button", { name: "Delete account", exact: true });
  const rect = await action.boundingBox();
  expect(rect).not.toBeNull();
  await action.click({ position: { x: rect!.width - 5, y: rect!.height / 2 } });
  const dialog = page.getByRole("dialog", { name: "Delete your account?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).not.toBeVisible();
  await trigger.click();
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(trigger).toBeFocused();
}

for (const variant of ["narrow", "collapsed", "mobile", "mobile sidebar"] as const) {
  test(`${variant}: account popup stays above chat content`, async ({ page, context }) => {
    const mobile = variant.startsWith("mobile");
    await page.setViewportSize({ width: mobile ? 390 : 1280, height: 800 });
    await page.emulateMedia({ colorScheme: "dark" });
    await context.addCookies([
      { name: "session", value: token, url: "http://localhost:3100" },
      { name: "sidebar_width", value: "180", url: "http://localhost:3100" },
      { name: "sidebar_collapsed", value: variant === "collapsed" ? "1" : "0", url: "http://localhost:3100" },
    ]);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What should we build, Popup?" })).toBeVisible();
    if (variant === "mobile sidebar") await page.getByRole("button", { name: "Open sidebar" }).click();
    await checkPopup(page, variant === "mobile sidebar");
    if (variant === "mobile sidebar") await page.getByRole("button", { name: "Close sidebar" }).click();
    await page.locator("textarea:visible").fill("Build a recipe app");
    await page.locator("textarea:visible").press("Enter");
    await page.waitForURL("**/projects/*");
    await expect(page.getByText("Build a recipe app", { exact: true })).toBeVisible();
    // Project chats use a preview toggle in the phone header; the account lives in the sidebar.
    if (mobile) await page.getByRole("button", { name: "Open sidebar" }).click();
    await checkPopup(page, mobile);
  });
}
