import { expect, test, type Locator } from "@playwright/test";
import { clearProjects, ORIGIN, seedProject, testUser } from "./seed";

// Lists in the prompt box as they're typed, and in the user's messages once sent.

const user = testUser("Lists Test");

test.beforeEach(async ({ page, context }) => {
  clearProjects(user.id);
  await context.addCookies([{ name: "session", value: user.token, url: ORIGIN }]);
  await page.setViewportSize({ width: 1280, height: 900 });
});

/** The text box's text, with "|" where the cursor is. */
function withCaret(box: Locator) {
  return box.evaluate((el: HTMLTextAreaElement) => el.value.slice(0, el.selectionStart) + "|" + el.value.slice(el.selectionEnd));
}

test("bullets and numbers carry on, nest and end as they're typed, and show as lists once sent", async ({ page }) => {
  const id = seedProject(user.id, { name: "Lists", messages: [] });
  await page.goto(`/projects/${id}`);
  const box = page.getByRole("textbox", { name: "Ask for changes" });
  await box.click();

  // "- " turns into a bullet; Undo takes that back.
  await box.pressSequentially("Pages?");
  await box.press("Shift+Enter");
  await box.pressSequentially("- ");
  expect(await withCaret(box)).toBe("Pages?\n• |");
  await box.press("Control+z");
  await expect(box).toHaveValue("Pages?\n- ");
  await box.press("Control+Shift+z");
  await expect(box).toHaveValue("Pages?\n• ");
  await box.press("End");

  // Enter starts the next item, Tab moves it in, Shift+Tab out, Enter on an empty one ends the list.
  await box.pressSequentially("Home");
  await box.press("Enter");
  await box.press("Tab");
  await box.pressSequentially("Hero");
  await box.press("Enter");
  await box.press("Shift+Tab");
  await box.pressSequentially("Menu");
  await box.press("Enter");
  await box.press("Enter");
  expect(await withCaret(box)).toBe("Pages?\n• Home\n  • Hero\n• Menu\n|");

  // Numbers count up, and again when an item goes in between.
  await box.pressSequentially("1. Fast");
  await box.press("Enter");
  await box.pressSequentially("Simple");
  await box.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(el.value.indexOf("Fast") + 4, el.value.indexOf("Fast") + 4));
  await box.press("Enter");
  await box.pressSequentially("Cheap");
  expect(await withCaret(box)).toBe("Pages?\n• Home\n  • Hero\n• Menu\n1. Fast\n2. Cheap|\n3. Simple");

  // Shift+Enter breaks the line inside an item; Backspace after a number takes it away.
  await box.press("Shift+Enter");
  await box.pressSequentially("and safe");
  await box.press("End");
  await box.press("ArrowDown");
  await box.press("End");
  await box.press("Enter");
  expect(await withCaret(box)).toBe("Pages?\n• Home\n  • Hero\n• Menu\n1. Fast\n2. Cheap\n   and safe\n3. Simple\n4. |");
  await box.press("Backspace");
  expect(await withCaret(box)).toBe("Pages?\n• Home\n  • Hero\n• Menu\n1. Fast\n2. Cheap\n   and safe\n3. Simple\n|");
  await box.press("Backspace");

  // Enter in a list never sends; outside one it does.
  await box.press("Enter");
  await expect(box).toHaveValue(/4\. $/);
  await box.press("Enter");
  await box.press("Enter");
  await expect(box).toHaveValue("");

  const message = page.locator("main:visible").locator("div.justify-end").first();
  const bullets = message.locator("ul").first();
  await expect(message.locator("p")).toHaveText("Pages?");
  await expect(bullets.locator(":scope > li")).toHaveCount(2);
  await expect(bullets.locator("ul > li")).toHaveText(["Hero"]);
  await expect(bullets.locator("ul")).toHaveCSS("list-style-type", "circle");
  await expect(message.locator("ol > li")).toHaveText(["Fast", "Cheap\nand safe", "Simple"]);
  await expect(message).not.toContainText("•");
  await page.screenshot({ path: test.info().outputPath("sent.png"), animations: "disabled" });
});

test("Ctrl+Enter sends from inside a list, leaving off the empty item", async ({ page }) => {
  const id = seedProject(user.id, { name: "Lists", messages: [] });
  await page.goto(`/projects/${id}`);
  const box = page.getByRole("textbox", { name: "Ask for changes" });
  await box.click();
  await box.pressSequentially("- Dark mode?");
  await box.press("Enter");
  await box.press("Control+Enter");
  await expect(box).toHaveValue("");
  await expect(page.locator("main:visible").locator("ul > li")).toHaveText(["Dark mode?"]);
});

test("lists typed or pasted any common way show as lists, and web addresses as links", async ({ page }) => {
  const id = seedProject(user.id, {
    name: "Lists",
    messages: [
      {
        role: "user",
        text: "Like https://example.com/menu, but:\n\n- bigger photos\n* a map\n  1) where we are\n  2) when we're open\n\nThanks",
      },
      { role: "assistant", text: "Sure." },
    ],
  });
  await page.goto(`/projects/${id}`);
  const message = page.locator("main:visible").locator("div.justify-end").first();
  await expect(message.getByRole("link", { name: "https://example.com/menu" })).toHaveAttribute("target", "_blank");
  await expect(message.locator("ul > li")).toHaveCount(2);
  await expect(message.locator("ul ol > li")).toHaveText(["where we are", "when we're open"]);
  await expect(message.locator("p")).toHaveText(["Like https://example.com/menu, but:", "Thanks"]);
});
