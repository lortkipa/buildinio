import { expect, test } from "@playwright/test";
import { clearProjects, db, ORIGIN, seedProject, testUser } from "./seed";

const user = testUser("Header Test");
const projectName = "A very long project name that cannot fit a phone header";
let projectId = "";
let otherId = "";

test.beforeEach(async ({ context }) => {
  clearProjects(user.id);
  otherId = seedProject(user.id, { name: "Other app", createdAt: Date.now() - 1000 });
  projectId = seedProject(user.id, {
    name: projectName,
    messages: Array.from({ length: 20 }, (_, index) => ({
      role: "assistant" as const,
      text: `Message ${index}: Here is the app we built for you.`,
    })),
  });
  await context.addCookies([{ name: "session", value: user.token, url: ORIGIN }]);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`mobile ${colorScheme}: title edits, preview toggles, and deletion asks first`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme });
    await page.goto(`/projects/${projectId}`);
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
    // It slides the preview over the chat, whose back button closes it again.
    const sheet = page.getByRole("dialog", { name: "Preview", exact: true });
    await expect(sheet).toBeVisible();
    await page.mouse.move(0, 100);
    await expect.poll(() => preview.evaluate((element) => {
      const style = getComputedStyle(element);
      return [style.backgroundColor, style.color];
    })).toEqual(previewColors);
    await expect(sheet.getByRole("button", { name: "Close preview" })).toBeFocused();
    await sheet.getByRole("button", { name: "Close preview" }).click();
    await expect(sheet).not.toBeVisible();
    await expect(preview).toHaveAttribute("aria-pressed", "false");
    await expect(preview).toBeFocused();
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
    await page.screenshot({ path: test.info().outputPath(`project-menu-${colorScheme}.png`), animations: "disabled" });
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
    // Gone from the server too.
    await expect.poll(() => {
      const database = db();
      const ids = database.prepare("SELECT id FROM projects WHERE user_id = ?").all(user.id) as { id: string }[];
      database.close();
      return ids.map(({ id }) => id);
    }).toEqual([otherId]);
  });
}

test("the phone preview closes on navigation and the title menu works across screen sizes", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto(`/projects/${otherId}`);
  const header = page.locator("header");
  const preview = header.getByRole("button", { name: "Toggle preview" });
  await header.getByRole("button", { name: "Open sidebar" }).click();
  await page.getByRole("dialog", { name: "Sidebar", exact: true }).getByRole("link", { name: projectName, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}$`));
  await preview.click();
  // Going back to the other project closes it.
  const sheet = page.getByRole("dialog", { name: "Preview", exact: true });
  await expect(sheet).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`/projects/${otherId}$`));
  await expect(sheet).not.toBeVisible();
  await expect(preview).toHaveAttribute("aria-pressed", "false");
  await expect(header.getByRole("button", { name: "Options for Other app", exact: true })).toBeVisible();
  // On wider screens the button toggles the panel next to the chat instead.
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(preview).toBeVisible();
  await expect(preview).toHaveAttribute("aria-pressed", "false");
  const title = header.getByRole("button", { name: "Options for Other app", exact: true });
  await expect(title).toBeVisible();
  await title.hover();
  await header.screenshot({ path: test.info().outputPath("desktop-title-hover.png"), animations: "disabled" });
  await title.click();
  await page.screenshot({ path: test.info().outputPath("desktop-project-menu.png"), animations: "disabled" });
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
