import { mkdirSync, readFileSync, symlinkSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { unzipSync, strFromU8 } from "fflate";
import { clearProjects, db, ORIGIN, PROJECTS, seedProject, testUser } from "./seed";

const owner = testUser("Settings");
const other = testUser("Other");

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Account", exact: true }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  return page.getByRole("dialog", { name: "Settings", exact: true });
}

function accountRow() {
  const database = db();
  const row = database.prepare("SELECT name,email,avatar_url,theme,reduced_motion FROM users WHERE id=?").get(owner.id) as {
    name: string; email: string; avatar_url: string; theme: string; reduced_motion: number;
  };
  database.close();
  return row;
}

test.beforeEach(async ({ context }) => {
  clearProjects(owner.id);
  const database = db();
  database.prepare("UPDATE users SET name='Settings', avatar_url='/avatars/default.svg', theme='system', reduced_motion=0 WHERE id=?").run(owner.id);
  database.prepare("DELETE FROM user_photos WHERE user_id=?").run(owner.id);
  database.close();
  await context.addCookies([{ name: "session", value: owner.token, url: ORIGIN }]);
});

test("name and uploaded photo persist on the server; email stays unchanged; photo can be removed", async ({ page, browser }) => {
  await page.goto("/");
  let settings = await openSettings(page);
  const email = settings.getByRole("textbox", { name: "Email", exact: true });
  await expect(email).toHaveAttribute("readonly", "");
  const originalEmail = await email.inputValue();
  // Tampering with the read-only input must not change the stored email.
  await email.evaluate((element: HTMLInputElement) => { element.value = "changed@example.test"; });
  await settings.getByRole("textbox", { name: "Name", exact: true }).fill("  Ada   Lovelace  ");
  const photo = await sharp({ create: { width: 40, height: 60, channels: 3, background: "#ef4444" } }).png().toBuffer();
  await settings.getByLabel("Profile photo upload").setInputFiles({ name: "portrait.png", mimeType: "image/png", buffer: photo });
  await settings.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(page.getByText("Profile saved.", { exact: true })).toBeVisible();
  expect(accountRow()).toMatchObject({ name: "Ada Lovelace", email: originalEmail });
  expect(accountRow().avatar_url).toMatch(/^\/api\/account\/photo\?v=/);
  const response = await page.request.get(accountRow().avatar_url);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  const metadata = await sharp(await response.body()).metadata();
  expect(metadata).toMatchObject({ format: "webp", width: 256, height: 256 });
  await settings.getByRole("button", { name: "Close settings" }).click();
  await expect(page.getByRole("heading", { name: "What should we build, Ada?" })).toBeVisible();

  const fresh = await browser.newContext();
  try {
    await fresh.addCookies([{ name: "session", value: owner.token, url: ORIGIN }]);
    const anotherPage = await fresh.newPage();
    await anotherPage.goto(ORIGIN);
    settings = await openSettings(anotherPage);
    await expect(settings.getByRole("textbox", { name: "Name", exact: true })).toHaveValue("Ada Lovelace");
    await expect(settings.getByAltText("Profile photo")).toHaveAttribute("src", accountRow().avatar_url);
    await settings.getByRole("button", { name: "Remove", exact: true }).click();
    await settings.getByRole("button", { name: "Save changes", exact: true }).click();
    await expect(anotherPage.getByText("Profile saved.", { exact: true })).toBeVisible();
    expect(accountRow().avatar_url).toBe("/avatars/default.svg");
    expect((await fresh.request.get(`${ORIGIN}/api/account/photo`)).status()).toBe(404);
  } finally { await fresh.close(); }
});

test("invalid photo content is rejected without partially saving the profile", async ({ page }) => {
  await page.goto("/");
  const settings = await openSettings(page);
  await settings.getByRole("textbox", { name: "Name", exact: true }).fill("Should not save");
  await settings.getByLabel("Profile photo upload").setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not a photo") });
  await settings.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(settings.getByRole("alert")).toContainText("We couldn’t read that photo");
  expect(accountRow().name).toBe("Settings");
});

test("theme and reduced motion persist across browsers and follow system changes", async ({ page, browser, context }) => {
  await page.emulateMedia({ colorScheme: "light", reducedMotion: "no-preference" });
  await page.goto("/");
  const settings = await openSettings(page);
  await settings.getByRole("button", { name: "Appearance", exact: true }).click();
  await settings.getByRole("radio", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(accountRow().theme).toBe("dark");
  await settings.getByRole("switch", { name: "Reduced motion", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "true");
  expect(accountRow().reduced_motion).toBe(1);
  expect(await settings.evaluate((element) => getComputedStyle(element).animationDuration)).toBe("1e-05s");
  await settings.screenshot({ path: test.info().outputPath("appearance-desktop.png") });
  expect(await page.evaluate(() => Object.keys(localStorage))).toEqual([]);
  expect((await context.cookies()).some((cookie) => /theme|motion|appearance/.test(cookie.name))).toBe(false);

  const fresh = await browser.newContext({ colorScheme: "light" });
  try {
    await fresh.addCookies([{ name: "session", value: owner.token, url: ORIGIN }]);
    const anotherPage = await fresh.newPage();
    await anotherPage.goto(ORIGIN);
    await expect(anotherPage.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(anotherPage.locator("html")).toHaveAttribute("data-reduced-motion", "true");
    const freshSettings = await openSettings(anotherPage);
    await freshSettings.getByRole("button", { name: "Appearance", exact: true }).click();
    await freshSettings.getByRole("radio", { name: "Light", exact: true }).click();
    await expect(anotherPage.locator("html")).toHaveAttribute("data-theme", "light");
    await anotherPage.emulateMedia({ colorScheme: "dark" });
    await expect(anotherPage.locator("html")).toHaveAttribute("data-theme", "light");
    await freshSettings.getByRole("radio", { name: "System", exact: true }).click();
    await expect.poll(() => accountRow().theme).toBe("system");
    await expect(anotherPage.locator("html")).toHaveAttribute("data-theme", "dark");
    await anotherPage.emulateMedia({ colorScheme: "light" });
    await expect(anotherPage.locator("html")).toHaveAttribute("data-theme", "light");
    await freshSettings.getByRole("switch", { name: "Reduced motion", exact: true }).click();
    await expect(anotherPage.locator("html")).toHaveAttribute("data-reduced-motion", "false");
  } finally { await fresh.close(); }

  await context.clearCookies();
  await context.addCookies([{ name: "session", value: other.token, url: ORIGIN }]);
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-reduced-motion", "false");
});

test("export downloads actual projects, binary source and chats, excluding other accounts and symlinks", async ({ page }) => {
  const projectId = seedProject(owner.id, { name: "Export me", messages: [
    { role: "user", text: "Build my café" }, { role: "assistant", text: "Here is your café." },
  ], built: "built output must not be exported" });
  const privateId = seedProject(other.id, { name: "Other account secret" });
  const dir = path.join(PROJECTS, projectId);
  mkdirSync(path.join(dir, "src"), { recursive: true });
  mkdirSync(path.join(dir, "node_modules"), { recursive: true });
  mkdirSync(path.join(dir, ".git"), { recursive: true });
  writeFileSync(path.join(dir, "src", "App.tsx"), "export default function App() { return 'Café'; }\n");
  writeFileSync(path.join(dir, "image.png"), Buffer.from([0, 128, 255, 10, 13]));
  writeFileSync(path.join(dir, "node_modules", "private.txt"), "dependency");
  writeFileSync(path.join(dir, ".git", "config"), "git config");
  symlinkSync("/etc/passwd", path.join(dir, "outside.txt"));
  await page.goto("/");
  const settings = await openSettings(page);
  await settings.getByRole("button", { name: "Privacy & data", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await settings.getByRole("button", { name: "Export projects and chats", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toMatch(/^buildinio-export-\d{4}-\d{2}-\d{2}\.zip$/);
  const files = unzipSync(readFileSync((await download.path())!));
  const manifest = JSON.parse(strFromU8(files["projects.json"]));
  expect(manifest.projects.some((project: { id: string }) => project.id === projectId)).toBe(true);
  expect(manifest.projects.some((project: { id: string }) => project.id === privateId)).toBe(false);
  expect(strFromU8(files[`projects/${projectId}/chat.md`])).toContain("Build my café");
  expect(strFromU8(files[`projects/${projectId}/chat.md`])).toContain("Here is your café.");
  expect(strFromU8(files[`projects/${projectId}/source/src/App.tsx`])).toContain("Café");
  expect(Buffer.from(files[`projects/${projectId}/source/image.png`])).toEqual(Buffer.from([0, 128, 255, 10, 13]));
  expect(Object.keys(files).some((file) => /node_modules|\/dist\/|\/\.git\/|outside\.txt/.test(file))).toBe(false);
  await settings.screenshot({ path: test.info().outputPath("privacy-desktop.png") });
});

test("empty accounts export a valid archive; private endpoints require authentication", async ({ browser, page }) => {
  const response = await page.request.get("/api/account/export");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  expect(unzipSync(await response.body())["projects.json"]).toBeTruthy();
  const fresh = await browser.newContext();
  try {
    expect((await fresh.request.get(`${ORIGIN}/api/account/export`)).status()).toBe(401);
    expect((await fresh.request.get(`${ORIGIN}/api/account/photo`)).status()).toBe(401);
  } finally { await fresh.close(); }
});

test("expired sessions cannot save account or appearance changes", async ({ page, context }) => {
  await page.goto("/");
  const settings = await openSettings(page);
  await settings.getByRole("textbox", { name: "Name", exact: true }).fill("Not authorized");
  await context.clearCookies();
  await settings.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(settings.getByRole("alert")).toContainText("Please log in again");
  expect(accountRow().name).toBe("Settings");
  await settings.getByRole("button", { name: "Appearance", exact: true }).click();
  await settings.getByRole("radio", { name: "Dark", exact: true }).click();
  await expect(settings.getByRole("alert")).toContainText("Please log in again");
  expect(accountRow().theme).toBe("system");
});

test("phone settings fit the viewport in every section", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/");
  const settings = await openSettings(page);
  for (const section of ["Account", "Appearance", "Privacy & data"]) {
    await settings.getByRole("navigation", { name: "Settings sections" }).getByRole("button", { name: section, exact: true }).click();
    await expect.poll(() => settings.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight && element.scrollWidth <= element.clientWidth;
    })).toBe(true);
    await settings.screenshot({ path: test.info().outputPath(`settings-${section.split(" ")[0].toLowerCase()}-mobile.png`) });
  }
});

test("deleting an account from settings removes its photo, sessions, projects, chats and source", async ({ page, context }) => {
  const projectId = seedProject(other.id, { name: "Delete me", messages: [{ role: "user", text: "Delete this too" }], built: "delete this source" });
  const database = db();
  database.prepare("INSERT INTO user_photos (user_id,data) VALUES (?,?)").run(other.id, Buffer.from("test photo"));
  database.close();
  await context.clearCookies();
  await context.addCookies([{ name: "session", value: other.token, url: ORIGIN }]);
  await page.goto("/");
  const settings = await openSettings(page);
  await settings.getByRole("button", { name: "Delete account", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "Delete your account?" });
  await confirm.getByRole("button", { name: "Delete account", exact: true }).click();
  await expect(page.getByRole("button", { name: "Account", exact: true })).toHaveCount(0);
  const after = db();
  for (const [table, column, value] of [
    ["users", "id", other.id], ["sessions", "user_id", other.id], ["user_photos", "user_id", other.id],
    ["projects", "user_id", other.id], ["messages", "project_id", projectId],
  ]) expect(after.prepare(`SELECT count(*) AS count FROM ${table} WHERE ${column}=?`).get(value)).toEqual({ count: 0 });
  after.close();
  expect(existsSync(path.join(PROJECTS, projectId))).toBe(false);
  expect(accountRow().name).toBe("Settings");
});
