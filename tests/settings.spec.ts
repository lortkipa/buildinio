import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { clearProjects, db, ORIGIN, PROJECTS, seedProject, testUser } from "./seed";

const user = testUser("Settings Test");
const themeUser = testUser("Theme Test"); // Logs out at the end.
const doomed = testUser("Doomed Test"); // Deletes their account.

const LIGHT = "rgb(250, 250, 249)";
const DARK = "rgb(17, 17, 19)";

function account(id: string) {
  const database = db();
  const row = database.prepare("SELECT name, avatar_url, theme, autocorrect FROM users WHERE id = ?").get(id) as
    | { name: string; avatar_url: string; theme: string; autocorrect: number }
    | undefined;
  const avatars = (database.prepare("SELECT COUNT(*) AS n FROM avatars WHERE user_id = ?").get(id) as { n: number }).n;
  database.close();
  return row && { ...row, avatars };
}

async function signIn(page: Page, token: string, width = 1280) {
  await page.setViewportSize({ width, height: 800 });
  await page.context().addCookies([{ name: "session", value: token, url: ORIGIN }]);
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "Account", exact: true }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Settings", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

function background(page: Page) {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

/** A 600×400 picture: red on the left half, blue on the right. */
async function photo(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 400;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#ff0000";
    context.fillRect(0, 0, 300, 400);
    context.fillStyle = "#0000ff";
    context.fillRect(300, 0, 300, 400);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  return { name: "me.png", mimeType: "image/png", buffer: Buffer.from(base64, "base64") };
}

test.beforeEach(() => clearProjects(user.id));

test("profile: the name is saved and shows everywhere; the email can't change", async ({ page }) => {
  await signIn(page, user.token);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "What should we build, Settings?" })).toBeVisible();
  const dialog = await openSettings(page);
  await expect(dialog.getByRole("tab", { name: "Profile" })).toHaveAttribute("aria-selected", "true");
  await expect(dialog.getByRole("tab", { name: "Profile" })).toBeFocused();

  const email = dialog.getByRole("textbox", { name: "Email" });
  await expect(email).toHaveValue(`${user.id}@example.test`);
  await expect(email).not.toBeEditable();

  const name = dialog.getByRole("textbox", { name: "Name" });
  const save = dialog.locator("button[type=submit]");
  // It fades out and can't be reached while there's nothing to save.
  const saveShown = () => save.evaluate((element: HTMLButtonElement) => !element.inert && getComputedStyle(element).opacity === "1");
  await expect(name).toHaveValue("Settings Test");
  await expect.poll(saveShown).toBe(false);
  await name.fill("  Ada   Lovelace ");
  await expect.poll(saveShown).toBe(true);
  await name.press("Enter");
  await expect(dialog.getByRole("status")).toHaveText("Saved");
  await expect(name).toHaveValue("Ada Lovelace");
  await expect.poll(saveShown).toBe(false);
  await expect.poll(() => account(user.id)?.name).toBe("Ada Lovelace");
  // An empty name isn't saved.
  await name.fill("   ");
  await expect.poll(saveShown).toBe(false);

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("heading", { name: "What should we build, Ada?" })).toBeVisible();
  const row = page.getByRole("button", { name: "Account", exact: true }).filter({ visible: true });
  await expect(row).toContainText("Ada Lovelace");
  await page.reload();
  await expect(page.getByRole("heading", { name: "What should we build, Ada?" })).toBeVisible();
  await expect(row).toContainText("Ada Lovelace");

  // Back as it was, for the other tests. Saved with the button, the focus stays in the field.
  await openSettings(page);
  await name.fill("Settings Test");
  await save.click();
  await expect(name).toBeFocused();
  await expect.poll(() => account(user.id)?.name).toBe("Settings Test");
});

test("profile: a photo is cropped, uploaded, shown and removed", async ({ page, request }) => {
  await signIn(page, user.token);
  await page.goto("/");
  const dialog = await openSettings(page);
  const picker = dialog.getByLabel("Photo", { exact: true });
  await expect(dialog.getByRole("button", { name: "Remove" })).toHaveCount(0);

  // Not a picture: the cropper says so and goes away.
  await picker.setInputFiles({ name: "notes.png", mimeType: "image/png", buffer: Buffer.from("not a picture") });
  await expect(page.getByText("Couldn’t open that picture. Try a PNG or JPEG.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Change photo" })).toBeVisible();

  // Escape while cropping puts the photo back, and the settings stay open.
  await picker.setInputFiles(await photo(page));
  const stage = dialog.getByRole("img", { name: /^Your photo/ });
  await expect(stage).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(stage).toHaveCount(0);
  await expect(dialog).toBeVisible();

  await picker.setInputFiles(await photo(page));
  await expect(stage).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Save photo" })).toBeEnabled();
  await page.screenshot({ path: test.info().outputPath("cropper.png"), animations: "disabled" });
  // Dragged as far right as it goes, the circle shows the photo's left 400px: red up to 300.
  const box = (await stage.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 200, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  // Zooming in and out again keeps it covering the circle.
  const zoom = dialog.getByRole("slider", { name: "Zoom" });
  await zoom.fill("3");
  await zoom.fill("1");
  await dialog.getByRole("button", { name: "Save photo" }).click();

  const avatar = dialog.locator('img[src^="/api/avatars/"]');
  await expect(avatar).toBeVisible();
  await expect.poll(() => account(user.id)?.avatars).toBe(1);
  const src = (await avatar.getAttribute("src"))!;
  expect(account(user.id)?.avatar_url).toBe(src);
  await expect(page.getByRole("button", { name: "Account", exact: true }).filter({ visible: true }).locator("img")).toHaveAttribute("src", src);

  const response = await request.get(src);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/webp");
  expect(response.headers()["cache-control"]).toContain("immutable");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  const pixels = await page.evaluate(async (url) => {
    const image = new Image();
    image.src = url;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d")!;
    context.drawImage(image, 0, 0);
    const at = (x: number) => [...context.getImageData(x, 128, 1, 1).data.slice(0, 3)];
    return { size: [image.naturalWidth, image.naturalHeight], left: at(20), middle: at(180), right: at(240) };
  }, src);
  expect(pixels.size).toEqual([256, 256]);
  const red = ([r, , b]: number[]) => r > 200 && b < 60;
  const blue = ([r, , b]: number[]) => b > 200 && r < 60;
  expect(red(pixels.left) && red(pixels.middle) && blue(pixels.right)).toBe(true);

  await page.reload();
  const reopened = await openSettings(page);
  await expect(reopened.locator(`img[src="${src}"]`)).toBeVisible();
  await reopened.getByRole("button", { name: "Remove" }).click();
  await expect(reopened.locator('img[src="/avatars/default.svg"]')).toBeVisible();
  await expect(reopened.getByRole("button", { name: "Remove" })).toHaveCount(0);
  await expect.poll(() => account(user.id)).toMatchObject({ avatar_url: "/avatars/default.svg", avatars: 0 });
  expect((await request.get(src)).status()).toBe(404);
  expect((await request.get("/api/avatars/nope")).status()).toBe(404);
});

test("general: autocorrect turns the prompt boxes' spell check on and off", async ({ page }) => {
  const projectId = seedProject(user.id, { name: "Spelling app", messages: [{ role: "user", text: "Hi" }, { role: "assistant", text: "Hello." }] });
  await signIn(page, user.token);
  await page.goto("/");
  const prompt = page.locator("textarea:visible");
  await expect(prompt).toHaveAttribute("spellcheck", "true");

  const dialog = await openSettings(page);
  await dialog.getByRole("tab", { name: "General" }).click();
  const toggle = dialog.getByRole("switch", { name: "Autocorrect" });
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect.poll(() => account(user.id)?.autocorrect).toBe(0);
  await page.keyboard.press("Escape");
  await expect(prompt).toHaveAttribute("spellcheck", "false");
  await expect(prompt).toHaveAttribute("autocorrect", "off");

  // The project chat's prompt box too, and after a reload.
  await page.getByRole("link", { name: "Spelling app" }).click();
  await page.waitForURL(`**/projects/${projectId}`);
  await expect(prompt).toHaveAttribute("spellcheck", "false");
  await page.reload();
  await expect(prompt).toHaveAttribute("spellcheck", "false");

  const again = await openSettings(page);
  await again.getByRole("tab", { name: "General" }).click();
  await again.getByRole("switch", { name: "Autocorrect" }).click();
  await expect.poll(() => account(user.id)?.autocorrect).toBe(1);
  await page.keyboard.press("Escape");
  await expect(prompt).toHaveAttribute("spellcheck", "true");
});

test("general: the theme is saved, drawn from the first paint, and dropped on logging out", async ({ page }) => {
  await signIn(page, themeUser.token);
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  // "system" is resolved: the attribute itself is only ever light or dark.
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await background(page)).toBe(LIGHT);

  const dialog = await openSettings(page);
  await dialog.getByRole("tab", { name: "General" }).click();
  const system = dialog.getByRole("radio", { name: "System" });
  const dark = dialog.getByRole("radio", { name: "Dark" });
  const light = dialog.getByRole("radio", { name: "Light" });
  // The radios are visually hidden: their cards are what's clicked.
  const card = (name: string) => dialog.locator("label").filter({ has: page.getByRole("radio", { name }) });
  await expect(system).toBeChecked();

  await card("Dark").click();
  await expect(dark).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => background(page)).toBe(DARK);
  await expect(page.locator('meta[name="theme-color"]').first()).toHaveAttribute("content", "#111113");
  await expect.poll(() => account(themeUser.id)?.theme).toBe("dark");
  await page.screenshot({ path: test.info().outputPath("theme-dark.png"), animations: "disabled" });

  // Every frame of a reload is dark, the first one too: the server sends the database's theme
  // in a cookie with the page, and the page's first script reads it.
  const themeCookie = async () => (await page.context().cookies()).find((cookie) => cookie.name === "theme")?.value;
  await page.addInitScript(() => {
    const seen: string[] = [];
    Object.assign(window, { backgrounds: seen });
    const frame = () => {
      if (document.body) seen.push(getComputedStyle(document.body).backgroundColor);
      if (seen.length < 20) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  for (let load = 0; load < 3; load++) {
    await page.reload();
    await expect(page.getByRole("heading", { name: "What should we build, Theme?" })).toBeVisible();
    const backgrounds = await page.evaluate(() => (window as unknown as { backgrounds: string[] }).backgrounds);
    expect(new Set(backgrounds)).toEqual(new Set([DARK]));
  }
  expect(await themeCookie()).toBe("dark");

  // In the page as it arrives: dark before any of the app's scripts run.
  await page.route("**/_next/static/chunks/*.js", (route) => route.abort());
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(await background(page)).toBe(DARK);
  await page.unrouteAll();

  // Changed somewhere else: the database's theme wins over the cookie, which follows it.
  const database = db();
  database.prepare("UPDATE users SET theme = 'system' WHERE id = ?").run(themeUser.id);
  database.close();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await background(page)).toBe(LIGHT);
  expect(await themeCookie()).toBe("system");

  // Light even when the system is dark.
  await page.emulateMedia({ colorScheme: "dark" });
  const reopened = await openSettings(page);
  await reopened.getByRole("tab", { name: "General" }).click();
  await card("Light").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(() => background(page)).toBe(LIGHT);
  await expect.poll(() => account(themeUser.id)?.theme).toBe("light");
  // A chosen light theme stays light while the system is dark, including the logo.
  await expect(page.locator('img[class*="dark:hidden"]').first()).toBeVisible();

  // System follows the system, and keeps following it when the system changes.
  await card("System").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect.poll(() => background(page)).toBe(DARK);
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect.poll(() => background(page)).toBe(LIGHT);
  await expect.poll(() => account(themeUser.id)?.theme).toBe("system");

  // Keyboard: the theme is a radio group.
  await system.focus();
  await page.keyboard.press("ArrowRight");
  await expect(light).toBeChecked();
  await page.keyboard.press("ArrowRight");
  await expect(dark).toBeChecked();
  await expect.poll(() => account(themeUser.id)?.theme).toBe("dark");

  // Logged out, the landing page is back to the system's theme.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Account", exact: true }).filter({ visible: true }).click();
  await page.getByRole("button", { name: "Log out", exact: true }).click();
  await expect(page.getByText("You’re logged out.")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await background(page)).toBe(LIGHT);
  await page.reload();
  await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await themeCookie()).toBeUndefined();
});

test("data: the export is a json file of the account, its projects, chats and code", async ({ page, request }) => {
  const projectId = seedProject(user.id, {
    name: "Recipe Box",
    messages: [
      { role: "user", text: "Build a recipe app" },
      { role: "assistant", text: "Here's your recipe box." },
    ],
    built: "<!doctype html><title>Built</title>",
  });
  const dir = path.join(PROJECTS, projectId);
  mkdirSync(path.join(dir, "src"), { recursive: true });
  writeFileSync(path.join(dir, "src", "App.tsx"), "export default function App() { return <h1>Recipes</h1>; }\n");
  mkdirSync(path.join(dir, "node_modules", "left-pad"), { recursive: true });
  writeFileSync(path.join(dir, "node_modules", "left-pad", "index.js"), "module.exports = 1;\n");

  expect((await request.get("/api/account/export")).status()).toBe(401);

  await signIn(page, user.token);
  await page.goto("/");
  const dialog = await openSettings(page);
  await dialog.getByRole("tab", { name: "Data" }).click();
  const downloading = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export" }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/^buildinio-export-\d{4}-\d{2}-\d{2}\.json$/);

  const exported = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(exported).toMatchObject({
    name: "Settings Test",
    email: `${user.id}@example.test`,
    avatar: `${ORIGIN}/avatars/default.svg`,
    settings: { theme: "system", autocorrect: true },
    linkedAccounts: [],
  });
  const recipe = exported.projects.find((project: { name: string }) => project.name === "Recipe Box");
  expect(recipe).toMatchObject({
    name: "Recipe Box",
    chat: [
      { role: "user", text: "Build a recipe app" },
      { role: "assistant", text: "Here's your recipe box.", seconds: 1, feedback: null },
    ],
  });
  expect(recipe.code["src/App.tsx"]).toContain("<h1>Recipes</h1>");
  expect(JSON.stringify(exported)).not.toContain("node_modules");
  expect(Object.keys(recipe.code).some((file: string) => file.startsWith("dist/"))).toBe(false);
});

test("data: deleting the account asks first, then removes it", async ({ page }) => {
  seedProject(doomed.id, { name: "Doomed app" });
  await signIn(page, doomed.token);
  await page.goto("/");
  const dialog = await openSettings(page);
  await dialog.getByRole("tab", { name: "Data" }).click();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Delete your account?" });
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toContainText(`${doomed.id}@example.test`);
  await page.screenshot({ path: test.info().outputPath("delete-account.png"), animations: "disabled" });

  // Cancelling closes only the question.
  await confirmation.getByRole("button", { name: "Cancel" }).click();
  await expect(confirmation).not.toBeVisible();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(confirmation).not.toBeVisible();
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await confirmation.getByRole("button", { name: "Delete account" }).click();
  await expect(page.getByText("Your account was deleted.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Log in" }).first()).toBeVisible();
  await expect(dialog).toHaveCount(0);
  expect(account(doomed.id)).toBeUndefined();
  const database = db();
  const left = database.prepare("SELECT COUNT(*) AS n FROM projects WHERE user_id = ?").get(doomed.id) as { n: number };
  database.close();
  expect(left.n).toBe(0);
});

for (const colorScheme of ["light", "dark"] as const) {
  for (const width of [1280, 390]) {
    const screen = width > 500 ? "desktop" : "phone";
    test(`${screen} ${colorScheme}: the tabs, by pointer and keyboard, fit the screen`, async ({ page }) => {
      await signIn(page, user.token, width);
      await page.emulateMedia({ colorScheme });
      await page.goto("/");
      const dialog = await openSettings(page);
      const fits = () =>
        dialog.evaluate((element) => {
          const box = element.getBoundingClientRect();
          return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight;
        });
      expect(await fits()).toBe(true);

      for (const [index, name] of ["Profile", "General", "Data"].entries()) {
        const tab = dialog.getByRole("tab", { name });
        if (index > 0) await page.keyboard.press(width > 500 ? "ArrowDown" : "ArrowRight");
        await expect(tab).toBeFocused();
        await expect(tab).toHaveAttribute("aria-selected", "true");
        await expect(dialog.getByRole("tabpanel")).toHaveAccessibleName(name);
        await page.screenshot({ path: test.info().outputPath(`${screen}-${colorScheme}-${name.toLowerCase()}.png`), animations: "disabled" });
      }
      await page.keyboard.press("Home");
      await expect(dialog.getByRole("tab", { name: "Profile" })).toBeFocused();
      await page.keyboard.press("ArrowUp");
      await expect(dialog.getByRole("tab", { name: "Data" })).toBeFocused();
      await dialog.getByRole("tab", { name: "General" }).click();
      await expect(dialog.getByRole("switch", { name: "Autocorrect" })).toBeVisible();

      // The cropper fits too, and Escape only ends it.
      await dialog.getByRole("tab", { name: "Profile" }).click();
      await dialog.getByLabel("Photo", { exact: true }).setInputFiles(await photo(page));
      const stage = dialog.getByRole("img", { name: /^Your photo/ });
      await expect(dialog.getByRole("button", { name: "Save photo" })).toBeEnabled();
      const [stageBox, dialogBox] = [(await stage.boundingBox())!, (await dialog.boundingBox())!];
      expect(stageBox.x >= dialogBox.x && stageBox.x + stageBox.width <= dialogBox.x + dialogBox.width).toBe(true);
      await page.screenshot({ path: test.info().outputPath(`${screen}-${colorScheme}-cropper.png`), animations: "disabled" });
      await page.keyboard.press("Escape");
      await expect(stage).toHaveCount(0);

      // The close button, and a click outside, close it too.
      await dialog.getByRole("button", { name: "Close" }).filter({ visible: true }).click();
      await expect(dialog).not.toBeVisible();
      await openSettings(page);
      await page.mouse.click(4, 4);
      await expect(dialog).not.toBeVisible();
    });
  }
}
