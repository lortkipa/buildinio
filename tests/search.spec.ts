import { expect, test, type Locator, type Page } from "@playwright/test";
import { clearProjects, ORIGIN, seedProject, testUser } from "./seed";

const user = testUser("Search Test");
let garden = "";
let recipes = "";
let budget = "";

test.beforeEach(async ({ context }) => {
  clearProjects(user.id);
  const now = Date.now();
  // Oldest first. Every chat ends in an answer, so none of them is waiting for the AI.
  garden = seedProject(user.id, {
    name: "Moon Garden",
    icon: "leaf",
    color: "green",
    createdAt: now - 3000,
    messages: [
      { role: "user", text: "Build a planting calendar" },
      { role: "assistant", text: "Done. It has a **watering** schedule for `tomatoes` and a [moon chart](https://example.com)." },
    ],
  });
  recipes = seedProject(user.id, {
    name: "Recipe Box",
    icon: "utensils",
    color: "orange",
    createdAt: now - 2000,
    messages: [
      { role: "user", text: "An app for my grandmother's soup recipes" },
      { role: "assistant", text: "Here it is." },
    ],
  });
  budget = seedProject(user.id, {
    name: "Budget Tracker",
    icon: "briefcase",
    color: "violet",
    createdAt: now - 1000,
    messages: [
      { role: "user", text: "Track what I spend on lunch box deliveries" },
      {
        role: "assistant",
        text: "Here's the plan for your budget tracker. First we set up categories for rent, food and transport, then add a monthly chart, and finally an export to a spreadsheet you can share with your accountant.",
      },
    ],
  });
  await context.addCookies([{ name: "session", value: user.token, url: ORIGIN }]);
});

async function openSearch(page: Page, scope: Page | Locator = page) {
  await scope.getByRole("button", { name: "Search", exact: true }).filter({ visible: true }).click();
  const dialog = page.getByRole("dialog", { name: "Search", exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

/** The projects found: each one's name, and the bit of its chat under it (if any). */
function rows(dialog: Locator) {
  return dialog.getByRole("list", { name: "Projects" }).getByRole("listitem");
}

function fits(element: Locator) {
  return element.evaluate((el) => {
    const box = el.getBoundingClientRect();
    return box.left >= 0 && box.top >= 0 && box.right <= innerWidth && box.bottom <= innerHeight;
  });
}

test("desktop: finds projects by name and by what was said in their chats", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  const dialog = await openSearch(page);
  const input = dialog.getByRole("textbox", { name: "Search projects and chats" });
  await expect(input).toBeFocused();
  expect(await fits(dialog)).toBe(true);

  // Before anything's typed: every project, newest first, with its icon on its color.
  await expect(rows(dialog).getByRole("link")).toHaveText(["Budget Tracker", "Recipe Box", "Moon Garden"]);
  const tile = rows(dialog).first().locator("span[style]").first();
  await expect(tile).toHaveCSS("background-color", "rgb(139, 92, 246)");
  await expect(tile.locator("svg")).toHaveClass(/lucide-briefcase/);
  await expect(dialog.getByRole("status")).toHaveText("");
  await page.screenshot({ path: test.info().outputPath("all.png"), animations: "disabled" });

  // By name: nothing shows under it, and the name isn't marked.
  await input.fill("garden");
  await expect(rows(dialog).getByRole("link")).toHaveText(["Moon Garden"]);
  await expect(rows(dialog).locator("mark")).toHaveCount(0);
  const plainHeight = (await rows(dialog).first().boundingBox())!.height;
  await expect(dialog.getByRole("status")).toHaveText("1 project found");

  // By chat, every word in one message: the bit of it shows under the name, Markdown and all gone.
  await input.fill("Tomatoes  watering");
  await expect(rows(dialog)).toHaveCount(1);
  const found = rows(dialog).first();
  await expect(found.getByRole("link")).toHaveText(/^Moon GardenDone\. It has a watering schedule for tomatoes and a moon chart\.$/);
  await expect(found.locator("mark")).toHaveText(["watering", "tomatoes"]);
  // As tall as a row without it.
  expect((await found.boundingBox())!.height).toBe(plainHeight);
  // Its options button stays in the middle of the row.
  const [dots, box] = [(await found.getByRole("button", { name: "Options for Moon Garden" }).boundingBox())!, (await found.boundingBox())!];
  expect(Math.abs(dots.y + dots.height / 2 - (box.y + box.height / 2))).toBeLessThan(1);
  await page.screenshot({ path: test.info().outputPath("by-chat.png"), animations: "disabled" });

  // Your own messages too, whatever the case.
  await input.fill("GRANDMOTHER");
  await expect(rows(dialog).getByRole("link")).toHaveText(["Recipe Box" + "An app for my grandmother's soup recipes"]);
  await expect(rows(dialog).locator("mark")).toHaveText(["grandmother"]);

  // Far into a long message, it starts just before the match, which is on screen.
  await input.fill("spreadsheet");
  const snippet = rows(dialog).first().locator(".fade-end").last();
  await expect(snippet).toHaveText(/^…[^…]*spreadsheet you can share/);
  const [mark, line] = [(await snippet.locator("mark").boundingBox())!, (await snippet.boundingBox())!];
  expect(mark.x + mark.width).toBeLessThan(line.x + line.width - 32); // Clear of the fade.

  // Found by name comes first, even when an older project. Only the chat is marked.
  await input.fill("box");
  await expect(rows(dialog).getByRole("link")).toHaveText(["Recipe Box", /^Budget Tracker.*lunch box/]);
  await expect(rows(dialog).locator("mark")).toHaveText(["box"]);
  await expect(dialog.getByRole("status")).toHaveText("2 projects found");

  await input.fill("zebra");
  await expect(rows(dialog)).toHaveCount(0);
  await expect(dialog).toContainText("Nothing matches “zebra”.");
  await expect(dialog.getByRole("status")).toHaveText("0 projects found");

  // Escape closes it, and the focus goes back to Search.
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Search", exact: true }).filter({ visible: true })).toBeFocused();

  // A project found opens it.
  await openSearch(page);
  await input.fill("watering");
  await rows(dialog).getByRole("link").click();
  await page.waitForURL(`**/projects/${garden}`);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("header").getByRole("button", { name: "Options for Moon Garden", exact: true })).toBeVisible();
});

test("desktop: Ctrl+K, the keyboard, and editing and deleting from the results", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`/projects/${budget}`);
  await expect(page.locator("header").getByRole("button", { name: "Options for Budget Tracker", exact: true })).toBeVisible();
  const dialog = page.getByRole("dialog", { name: "Search", exact: true });
  const input = dialog.getByRole("textbox", { name: "Search projects and chats" });

  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  await expect(input).toBeFocused();
  // The open project is marked.
  await expect(rows(dialog).first().getByRole("link")).toHaveAttribute("aria-current", "page");

  // Up and down move between the box and the projects.
  const links = rows(dialog).getByRole("link");
  await page.keyboard.press("ArrowDown");
  await expect(links.nth(0)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(links.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await page.keyboard.press("ArrowUp");
  await expect(input).toBeFocused();

  // The options button shows on hover, top right; its menu opens in the search, and
  // Escape closes just the menu.
  const options = dialog.getByRole("button", { name: "Options for Recipe Box", exact: true });
  await expect(options).toHaveCSS("opacity", "0");
  await rows(dialog).nth(1).hover();
  await expect(options).toHaveCSS("opacity", "1");
  const [button, row] = [(await options.boundingBox())!, (await rows(dialog).nth(1).boundingBox())!];
  expect(button.x + button.width).toBeGreaterThan(row.x + row.width - 16);
  await options.click();
  const menu = dialog.getByRole("menu", { name: "Project" });
  await expect(menu).toBeVisible();
  await expect.poll(() => menu.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
  })).toBe(true);
  await page.screenshot({ path: test.info().outputPath("menu.png"), animations: "disabled" });
  await page.keyboard.press("Escape");
  await expect(menu).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(options).toBeFocused();

  // Edit: the new name shows in the results and the sidebar.
  await options.click();
  await menu.getByRole("menuitem", { name: "Edit" }).click();
  const edit = page.getByRole("dialog", { name: "Edit project" });
  await edit.getByRole("textbox", { name: "Name" }).fill("Soup Book");
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(edit).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await expect(links).toHaveText(["Budget Tracker", "Soup Book", "Moon Garden"]);
  await expect(page.locator("aside").getByRole("link", { name: "Soup Book" })).toBeAttached();

  // Right-click opens the menu too. Delete asks first; the search stays open.
  await rows(dialog).nth(2).getByRole("link").click({ button: "right" });
  await menu.getByRole("menuitem", { name: "Delete" }).click();
  const confirm = page.getByRole("dialog", { name: "Delete “Moon Garden”?" });
  await confirm.getByRole("button", { name: "Delete project" }).click();
  await expect(page.getByText("Project deleted.")).toBeVisible();
  await expect(links).toHaveText(["Budget Tracker", "Soup Book"]);
  await expect(dialog).toBeVisible();

  // Enter opens the first project found.
  await input.fill("soup");
  await input.press("Enter");
  await page.waitForURL(`**/projects/${recipes}`);
  await expect(dialog).toHaveCount(0);

  // Ctrl+K doesn't open it over another dialog. Deleting the open project goes to New.
  await page.keyboard.press("Control+k");
  await rows(dialog).first().hover();
  await dialog.getByRole("button", { name: "Options for Soup Book", exact: true }).click();
  await menu.getByRole("menuitem", { name: "Delete" }).click();
  await page.keyboard.press("Control+k");
  await expect(page.getByRole("dialog", { name: "Search", exact: true })).toHaveCount(1);
  await page.getByRole("dialog", { name: "Delete “Soup Book”?" }).getByRole("button", { name: "Delete project" }).click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect(dialog).toHaveCount(0);
});

for (const colorScheme of ["light", "dark"] as const) {
  test(`phone ${colorScheme}: search from the sidebar fits the screen and opens a project`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    await page.getByRole("button", { name: "Open sidebar" }).click();
    const sidebar = page.getByRole("dialog", { name: "Sidebar", exact: true });
    const dialog = await openSearch(page, sidebar);
    expect(await fits(dialog)).toBe(true);
    // At the top, under the keyboard's way.
    expect((await dialog.boundingBox())!.y).toBeLessThan(16);

    await dialog.getByRole("textbox").fill("watering");
    const snippet = rows(dialog).first().locator(".fade-end").last();
    const [mark, line] = [(await snippet.locator("mark").boundingBox())!, (await snippet.boundingBox())!];
    expect(mark.x + mark.width).toBeLessThan(line.x + line.width - 32);
    await page.screenshot({ path: test.info().outputPath(`phone-${colorScheme}.png`), animations: "disabled" });

    // A click outside closes only the search.
    await page.mouse.click(195, 800);
    await expect(dialog).toHaveCount(0);
    await expect(sidebar).toBeVisible();

    // A project found opens it, and the sidebar goes too.
    await openSearch(page, sidebar);
    await dialog.getByRole("textbox").fill("lunch");
    await rows(dialog).getByRole("link").click();
    await page.waitForURL(`**/projects/${budget}`);
    await expect(dialog).toHaveCount(0);
    await expect(sidebar).not.toBeVisible();
  });
}
