import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { clearProjects, ORIGIN, seedProject, testUser } from "./seed";

// How the AI's Markdown looks in the chat: tests/markdown-sample.md has a bit of everything.

const user = testUser("Markdown Test");
const SAMPLE = readFileSync("tests/markdown-sample.md", "utf8");
const PROMPT = "Show me everything Markdown can do"; // The fake AI answers it with the sample.

test.beforeEach(async ({ context }) => {
  clearProjects(user.id);
  await context.addCookies([{ name: "session", value: user.token, url: ORIGIN }]);
});

/** The whole chat, with the viewport made as tall as it, so the header and prompt box stay in place. */
async function screenshot(page: Page, name: string) {
  const { width } = page.viewportSize()!;
  await page.setViewportSize({ width, height: await page.evaluate(() => document.documentElement.scrollHeight) });
  await page.screenshot({ path: test.info().outputPath(name), animations: "disabled" });
  await page.setViewportSize({ width, height: width < 768 ? 844 : 900 });
}

/** Everything in the sample shows as what it is, with no Markdown left over. */
async function expectRendered(page: Page) {
  const answer = page.locator("main:visible");
  await expect(answer.getByRole("heading", { level: 1, name: "Everything an answer can show" })).toBeVisible();
  await expect(answer.getByRole("heading", { level: 2, name: "A table" })).toBeVisible();
  await expect(answer.getByRole("heading", { level: 4, name: "A smaller heading" })).toBeVisible();
  await expect(answer.locator("strong", { hasText: "bold" }).first()).toBeVisible();
  await expect(answer.locator("em", { hasText: "italic" })).toBeVisible();
  await expect(answer.locator("del", { hasText: "struck out" })).toBeVisible();
  await expect(answer.getByRole("link", { name: "links" })).toHaveAttribute("target", "_blank");
  await expect(answer.locator("ol > li")).toHaveCount(3);
  await expect(answer.getByRole("checkbox")).toHaveCount(2);
  await expect(answer.getByRole("checkbox", { checked: true })).toHaveCount(1);
  await expect(answer.locator("blockquote")).toContainText("Good design");

  const table = answer.getByRole("table");
  await expect(table.getByRole("columnheader")).toHaveText(["Plan", "Price", "Projects", "Support"]);
  await expect(table.getByRole("row")).toHaveCount(4);
  await expect(table.getByRole("cell", { name: "$12" })).toHaveCSS("text-align", "right");

  // Each code block says its language and is colored by it.
  for (const label of ["TSX", "Python", "CSS", "Bash", "SQL", "JSON", "Diff"]) {
    await expect(answer.getByText(label, { exact: true })).toBeVisible();
  }
  const tsx = answer.locator("pre").first();
  await expect(tsx.locator(".hljs-keyword").first()).toHaveText("import");
  await expect(tsx.locator(".hljs-comment")).toHaveText("// A counter that starts at zero.");
  await expect(answer.locator("pre .hljs-keyword").first()).not.toHaveCSS("color", await tsx.evaluate((pre) => getComputedStyle(pre).color));
  await expect(answer.getByRole("button", { name: "Copy code" })).toHaveCount(7);

  await expect(answer.getByText("**", { exact: false })).toHaveCount(0);
  await expect(answer.getByText("| Plan")).toHaveCount(0);
  await expect(answer.getByText("```")).toHaveCount(0);
}

test("an answer's Markdown shows as headings, lists, tables and colored code", async ({ page }) => {
  const id = seedProject(user.id, {
    name: "Markdown",
    icon: "sparkles",
    color: "violet",
    messages: [
      { role: "user", text: PROMPT },
      { role: "assistant", text: SAMPLE },
    ],
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/projects/${id}`);
  await expectRendered(page);
  await screenshot(page, "desktop-light.png");

  // Copying a block copies just its code.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy code" }).nth(3).click();
  await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("npm install && npm run build # Builds into dist/");

  await page.emulateMedia({ colorScheme: "dark" });
  await screenshot(page, "desktop-dark.png");

  // On a phone, wide tables and code scroll sideways instead of the page.
  await page.emulateMedia({ colorScheme: "light" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const wide = page.locator("main:visible [data-scroll-x]").first();
  expect(await wide.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
  await screenshot(page, "phone-light.png");
  await page.emulateMedia({ colorScheme: "dark" });
  await screenshot(page, "phone-dark.png");
});

test("Markdown streaming in from the AI ends up the same", async ({ page }) => {
  test.setTimeout(120_000); // The sample takes a while to type out.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await page.locator("textarea:visible").fill(PROMPT);
  await page.locator("textarea:visible").press("Enter");
  await page.waitForURL("**/projects/*");

  // Halfway in, half-typed Markdown doesn't show as symbols.
  await expect(page.getByRole("heading", { level: 2, name: "Lists" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("main:visible").getByText("**")).toHaveCount(0);

  await expect(page.getByText("That's all of it.")).toBeVisible({ timeout: 90_000 });
  await expect(page.getByRole("button", { name: "Good answer" })).toBeVisible({ timeout: 10_000 });
  await expectRendered(page);
});
