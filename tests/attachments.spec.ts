import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { clearProjects, db, ORIGIN, PROJECTS, seedProject, testUser } from "./seed";

// Files attached to prompts: the tiles over the text, the row that scrolls sideways, the
// picture full screen, and the files going to the AI and into the project.

const user = testUser("Attachments Test");
const stranger = testUser("Attachments Stranger");

const PDF = Buffer.from("%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n");
const NOTES = Buffer.from("Open 9 to 5, closed on Sundays.\n");

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeEach(async ({ context }) => {
  clearProjects(user.id);
  const database = db();
  database.prepare("DELETE FROM attachments WHERE user_id = ?").run(user.id);
  database.close();
  await context.addCookies([{ name: "session", value: user.token, url: ORIGIN }]);
});

/** A real picture, drawn by the browser: 480 × 320, a gradient. */
async function picture(page: Page, from = "#f97316") {
  const data = await page.evaluate((color) => {
    const canvas = document.createElement("canvas");
    canvas.width = 480;
    canvas.height = 320;
    const context = canvas.getContext("2d")!;
    const gradient = context.createLinearGradient(0, 0, 480, 320);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, "#8b5cf6");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 480, 320);
    return canvas.toDataURL("image/png").split(",")[1];
  }, from);
  return Buffer.from(data, "base64");
}

function fileInput(page: Page) {
  return page.locator("form:visible input[type=file]");
}

/** The prompt box's files, or a prompt's in the chat. */
function attached(scope: Page | Locator) {
  return scope.getByRole("list", { name: "Attached files" });
}

async function uploaded(page: Page, count: number) {
  await expect(attached(page.locator("form:visible")).getByRole("listitem")).toHaveCount(count);
  await expect(page.getByRole("status", { name: /^Uploading/ })).toHaveCount(0);
}

function looseFiles() {
  const database = db();
  const rows = database
    .prepare("SELECT name FROM attachments WHERE user_id = ? AND message_id IS NULL ORDER BY name")
    .all(user.id) as { name: string }[];
  database.close();
  return rows.map((row) => row.name);
}

test("files show over the text as same-size tiles, pictures as themselves, and come off with their X", async ({ page }) => {
  await page.goto("/");
  const png = await picture(page);
  await fileInput(page).setInputFiles([
    { name: "sunset.png", mimeType: "image/png", buffer: png },
    { name: "Menu.pdf", mimeType: "application/pdf", buffer: PDF },
    { name: "notes.txt", mimeType: "text/plain", buffer: NOTES },
  ]);
  await uploaded(page, 3);
  const box = page.locator("form:visible");
  const list = attached(box);

  // The picture itself, and documents with their extension.
  const image = list.getByRole("img", { name: "sunset.png" });
  await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBe(480);
  await expect(list.getByText("PDF", { exact: true })).toBeVisible();
  await expect(list.getByText("Menu", { exact: true })).toBeVisible();
  await expect(list.getByText("TXT", { exact: true })).toBeVisible();

  // All the same size, over the text.
  for (const item of await list.getByRole("listitem").all()) {
    const tile = await item.boundingBox();
    expect([tile?.width, tile?.height]).toEqual([96, 96]);
  }
  const textarea = box.locator("textarea");
  expect((await list.boundingBox())!.y + 96).toBeLessThanOrEqual((await textarea.boundingBox())!.y);
  await page.screenshot({ path: test.info().outputPath("tiles.png"), animations: "disabled" });

  // The X shows on hover with a mouse, at the top right.
  const remove = list.getByRole("button", { name: "Remove notes.txt" });
  const notes = list.getByRole("listitem").nth(2);
  await expect(remove).toHaveCSS("opacity", "0");
  await notes.hover();
  await expect(remove).toHaveCSS("opacity", "1");
  const [x, tile] = [await remove.boundingBox(), await notes.boundingBox()];
  expect(tile!.x + tile!.width - (x!.x + x!.width)).toBeLessThan(8);
  expect(x!.y - tile!.y).toBeLessThan(8);

  // Removing it keeps the text box's focus, and the file is gone from the server.
  await textarea.focus();
  await remove.click();
  await expect(list.getByRole("listitem")).toHaveCount(2);
  await expect(textarea).toBeFocused();
  await expect.poll(looseFiles).toEqual(["Menu.pdf", "sunset.png"]);

  // Files alone can be sent.
  await expect(box.getByRole("button", { name: "Start building" })).toBeEnabled();

  // In dark mode too.
  await page.emulateMedia({ colorScheme: "dark" });
  await list.getByRole("listitem").nth(1).hover();
  await page.screenshot({ path: test.info().outputPath("tiles-dark.png"), animations: "disabled" });
});

test("many files scroll sideways, fading out at the side there's more of", async ({ page }) => {
  await page.goto("/");
  await fileInput(page).setInputFiles(
    Array.from({ length: 10 }, (_, index) => ({ name: `page-${index + 1}.pdf`, mimeType: "application/pdf", buffer: PDF })),
  );
  await uploaded(page, 10);
  const row = page.locator("form:visible .fade-x");
  const edges = () => row.evaluate((element) => [element.dataset.left, element.dataset.right]);

  expect(await row.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  expect(await row.evaluate((element) => getComputedStyle(element).overflowX)).toBe("auto");
  await expect.poll(edges).toEqual(["true", "false"]);
  await page.screenshot({ path: test.info().outputPath("row-start.png"), animations: "disabled" });

  await row.evaluate((element) => element.scrollTo({ left: (element.scrollWidth - element.clientWidth) / 2 }));
  await expect.poll(edges).toEqual(["false", "false"]);
  await page.screenshot({ path: test.info().outputPath("row-middle.png"), animations: "disabled" });

  await row.evaluate((element) => element.scrollTo({ left: element.scrollWidth }));
  await expect.poll(edges).toEqual(["false", "true"]);

  // A mouse wheel scrolls it sideways, and the page stays where it is.
  await row.evaluate((element) => element.scrollTo({ left: 0 }));
  await expect.poll(edges).toEqual(["true", "false"]);
  await row.hover();
  await page.mouse.wheel(0, 120);
  await expect.poll(() => row.evaluate((element) => element.scrollLeft)).toBeGreaterThan(60);
  expect(await page.evaluate(() => window.scrollY)).toBe(0);
  await page.mouse.wheel(0, 2000);
  await expect.poll(edges).toEqual(["false", "true"]);
  await page.mouse.wheel(0, -2000);
  await expect.poll(edges).toEqual(["true", "false"]);
});

test("too many files, or too big a file, is turned down with a toast", async ({ page }) => {
  await page.goto("/");
  await fileInput(page).setInputFiles(
    Array.from({ length: 11 }, (_, index) => ({ name: `note-${index + 1}.txt`, mimeType: "text/plain", buffer: NOTES })),
  );
  await expect(page.getByText("You can attach up to 10 files at once.")).toBeVisible();
  await uploaded(page, 10);

  await page.reload();
  await fileInput(page).setInputFiles([
    { name: "huge.zip", mimeType: "application/zip", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) },
  ]);
  await expect(page.getByText("huge.zip is bigger than 10 MB.")).toBeVisible();
  await expect(attached(page.locator("form:visible"))).toHaveCount(0);
});

test("pasted and dropped files are attached too", async ({ page }) => {
  await page.goto("/");
  const png = await picture(page);
  const textarea = page.locator("textarea:visible");
  await textarea.evaluate((element, base64) => {
    const data = new DataTransfer();
    data.items.add(new File([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], "pasted.png", { type: "image/png" }));
    element.dispatchEvent(new ClipboardEvent("paste", { clipboardData: data, bubbles: true, cancelable: true }));
  }, png.toString("base64"));
  await uploaded(page, 1);

  await textarea.evaluate((element) => {
    const data = new DataTransfer();
    data.items.add(new File(["a,b\n1,2\n"], "prices.csv", { type: "text/csv" }));
    for (const type of ["dragenter", "dragover", "drop"]) {
      element.dispatchEvent(new DragEvent(type, { dataTransfer: data, bubbles: true, cancelable: true }));
    }
  });
  await uploaded(page, 2);
  await expect(attached(page.locator("form:visible")).getByText("CSV", { exact: true })).toBeVisible();
});

/** Opens the picture full screen and returns the viewer. */
async function view(scope: Locator, name: string) {
  await scope.getByRole("button", { name: `View ${name}` }).click();
  const viewer = scope.page().getByRole("dialog", { name });
  await expect(viewer.getByRole("img", { name })).toBeVisible();
  return viewer;
}

test("a picture opens full screen, and the X, a click outside it or Escape closes it", async ({ page }) => {
  await page.goto("/");
  await fileInput(page).setInputFiles([{ name: "sunset.png", mimeType: "image/png", buffer: await picture(page) }]);
  await uploaded(page, 1);
  const box = page.locator("form:visible");

  // Over the whole screen, with the X at its top right.
  let viewer = await view(box, "sunset.png");
  const shown = await viewer.boundingBox();
  expect([shown?.width, shown?.height]).toEqual([1280, 800]);
  const close = viewer.getByRole("button", { name: "Close" });
  const x = (await close.boundingBox())!;
  expect(1280 - (x.x + x.width)).toBeLessThan(24);
  expect(x.y).toBeLessThan(24);
  // The picture is as big as it fits, keeping its shape.
  const image = (await viewer.getByRole("img").boundingBox())!;
  expect(image.width / image.height).toBeCloseTo(1.5, 1);
  expect(image.height).toBeGreaterThan(500);
  await page.screenshot({ path: test.info().outputPath("viewer.png"), animations: "disabled" });
  await close.click();
  await expect(viewer).toHaveCount(0);

  // Clicking the picture itself leaves it open; clicking beside it closes it.
  viewer = await view(box, "sunset.png");
  await viewer.getByRole("img").click();
  await expect(viewer).toBeVisible();
  await page.mouse.click(30, 400);
  await expect(viewer).toHaveCount(0);

  // In the prompt box, the focus goes back to the text, to carry on typing.
  await box.locator("textarea").focus();
  viewer = await view(box, "sunset.png");
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(box.locator("textarea")).toBeFocused();
});

function sentFiles(id: string) {
  const database = db();
  const rows = database
    .prepare(
      `SELECT a.id, a.name, a.content_type AS type FROM attachments a JOIN messages m ON m.id = a.message_id
       WHERE m.project_id = ? ORDER BY a.position`,
    )
    .all(id) as { id: string; name: string; type: string }[];
  database.close();
  return rows;
}

test("sent files go to the AI and into the project, show over the prompt, and only to their owner", async ({
  page,
  playwright,
}) => {
  await page.goto("/");
  const png = await picture(page);
  await fileInput(page).setInputFiles([
    { name: "sunset.png", mimeType: "image/png", buffer: png },
    { name: "Menu.pdf", mimeType: "application/pdf", buffer: PDF },
    { name: "notes.txt", mimeType: "text/plain", buffer: NOTES },
  ]);
  await uploaded(page, 3);
  const textarea = page.locator("textarea:visible");
  await textarea.fill("Here is what I attached");
  await textarea.press("Enter");
  await page.waitForURL("**/projects/*");
  const id = new URL(page.url()).pathname.split("/").at(-1)!;

  // The AI saw the picture and the PDF, and knows where each file is.
  await expect(
    page.getByText("Pictures: 1. PDFs: 1. Files: attachments/sunset.png, attachments/Menu.pdf, attachments/notes.txt."),
  ).toBeVisible({ timeout: 15_000 });
  expect(readFileSync(path.join(PROJECTS, id, "attachments", "sunset.png")).equals(png)).toBe(true);
  expect(readFileSync(path.join(PROJECTS, id, "attachments", "Menu.pdf")).equals(PDF)).toBe(true);
  expect(readFileSync(path.join(PROJECTS, id, "attachments", "notes.txt"), "utf8")).toBe(NOTES.toString());
  expect(sentFiles(id).map(({ name, type }) => [name, type])).toEqual([
    ["sunset.png", "image/png"],
    ["Menu.pdf", "application/pdf"],
    ["notes.txt", "text/plain"],
  ]);

  // Over the prompt in the chat; the prompt box is empty again.
  const chat = page.locator("main");
  const sent = attached(chat).first();
  await expect(sent.getByRole("listitem")).toHaveCount(3);
  await expect(attached(page.locator("form:visible"))).toHaveCount(0);
  await expect(chat.getByText("Here is what I attached")).toBeVisible();
  expect((await sent.boundingBox())!.y).toBeLessThan((await chat.getByText("Here is what I attached").boundingBox())!.y);
  await expect(sent.getByRole("link", { name: "Download Menu.pdf" })).toHaveAttribute("download", "Menu.pdf");
  await page.screenshot({ path: test.info().outputPath("sent.png"), animations: "disabled" });

  // The picture opens full screen from the chat too, and it's all still there after a reload.
  let viewer = await view(sent, "sunset.png");
  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await page.reload();
  await expect(attached(page.locator("main")).first().getByRole("listitem")).toHaveCount(3);
  viewer = await view(attached(page.locator("main")).first(), "sunset.png");
  await viewer.getByRole("button", { name: "Close" }).click();

  // Served to its owner only: pictures in place, anything else as a download.
  const [image, pdf] = sentFiles(id);
  const own = await page.request.get(`/api/attachments/${image.id}`);
  expect(own.status()).toBe(200);
  expect(own.headers()["content-type"]).toBe("image/png");
  expect(own.headers()["content-disposition"]).toMatch(/^inline/);
  expect((await page.request.get(`/api/attachments/${pdf.id}`)).headers()["content-disposition"]).toMatch(/^attachment/);
  const other = await playwright.request.newContext({
    baseURL: ORIGIN,
    extraHTTPHeaders: { cookie: `session=${stranger.token}` },
  });
  expect((await other.get(`/api/attachments/${image.id}`)).status()).toBe(404);
  await other.dispose();

  // Deleting the project deletes them.
  await page.locator("header").getByRole("button", { name: "Options for Test Kitchen", exact: true }).click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Delete “Test Kitchen”?", exact: true })
    .getByRole("button", { name: "Delete project", exact: true })
    .click();
  await expect.poll(() => sentFiles(id)).toEqual([]);
  await expect.poll(() => existsSync(path.join(PROJECTS, id))).toBe(false);
});

test("Stop gives the files back to the prompt box, to send again", async ({ page }) => {
  const id = seedProject(user.id, { name: "Photo Wall" });
  await page.goto(`/projects/${id}`);
  const png = await picture(page);
  await fileInput(page).setInputFiles([{ name: "sunset.png", mimeType: "image/png", buffer: png }]);
  await uploaded(page, 1);
  const prompt = "A page for my photos, slowly";
  const textarea = page.locator("textarea:visible");
  await textarea.fill(prompt);
  await textarea.press("Enter");
  await expect(page.getByRole("link", { name: "Moon Garden", exact: true })).toBeVisible({ timeout: 15_000 });
  expect(existsSync(path.join(PROJECTS, id, "attachments", "sunset.png"))).toBe(true);

  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(textarea).toHaveValue(prompt);
  const list = attached(page.locator("form:visible"));
  await expect(list.getByRole("img", { name: "sunset.png" })).toBeVisible();
  await expect(page.getByRole("list", { name: "Attached files" })).toHaveCount(1); // Not in the chat anymore.
  expect(sentFiles(id)).toEqual([]);
  expect(looseFiles()).toEqual(["sunset.png"]);

  // Sent again, with other words.
  await textarea.fill("Look at what I attached");
  await textarea.press("Enter");
  await expect(page.getByText("Pictures: 1. PDFs: 0. Files: attachments/sunset.png.")).toBeVisible({ timeout: 15_000 });
  expect(sentFiles(id).map((file) => file.name)).toEqual(["sunset.png"]);
});

test.describe("touch", () => {
  test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

  test("the X always shows, and the row fits the phone", async ({ page }) => {
    await page.goto("/");
    await fileInput(page).setInputFiles([
      { name: "sunset.png", mimeType: "image/png", buffer: await picture(page) },
      { name: "Menu.pdf", mimeType: "application/pdf", buffer: PDF },
      { name: "prices.xlsx", mimeType: "application/octet-stream", buffer: NOTES },
      { name: "logo.svg", mimeType: "image/svg+xml", buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="5" fill="#14b8a6"/></svg>') },
      { name: "song.mp3", mimeType: "audio/mpeg", buffer: NOTES },
    ]);
    await uploaded(page, 5);
    const list = attached(page.locator("form:visible"));
    await expect(list.getByRole("button", { name: "Remove Menu.pdf" })).toHaveCSS("opacity", "1");
    await expect(list.getByRole("img", { name: "logo.svg" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
    await page.screenshot({ path: test.info().outputPath("phone.png"), animations: "disabled" });

    await list.getByRole("button", { name: "Remove Menu.pdf" }).tap();
    await expect(list.getByRole("listitem")).toHaveCount(4);
  });
});
