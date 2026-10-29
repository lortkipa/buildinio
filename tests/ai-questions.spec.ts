import { expect, test, type Page } from "@playwright/test";
import { clearProjects, db, ORIGIN, testUser } from "./seed";

// The AI asking questions (ask_user), with tests/fake-openai.mjs: "ask me" gets two,
// pick one and pick any, shown one at a time. The answers go back as the next prompt.

const user = testUser("Questions Test");

test.beforeEach(async ({ page, context }) => {
  clearProjects(user.id);
  await context.addCookies([{ name: "session", value: user.token, url: ORIGIN }]);
  await page.setViewportSize({ width: 1280, height: 800 });
});

async function ask(page: Page) {
  await page.goto("/");
  await page.locator("textarea:visible").fill("A cafe site, ask me first");
  await page.locator("textarea:visible").press("Control+Enter"); // Sends on phones too.
  await page.waitForURL("**/projects/*");
  const card = page.getByRole("region", { name: "Questions" });
  await expect(card).toBeVisible({ timeout: 15_000 });
  return { id: new URL(page.url()).pathname.split("/").at(-1)!, card };
}

function lastPrompt(id: string) {
  const database = db();
  const row = database
    .prepare("SELECT text FROM messages WHERE project_id = ? AND role = 'user' ORDER BY created_at DESC, rowid DESC")
    .get(id) as { text: string };
  database.close();
  return row.text;
}

test("questions are answered one at a time, with picks and an answer of your own", async ({ page }) => {
  const { id, card } = await ask(page);
  await expect(page.getByText("Before I build it, a couple of questions.")).toBeVisible();

  // Pick one: the app adds "Type your own" itself, so the AI's "Other" is gone.
  await expect(card.getByRole("heading", { name: "What should it look like?" })).toBeVisible();
  await expect(card.getByText("1 of 2")).toBeVisible();
  await expect(card.getByText("Pick one")).toBeVisible();
  await expect(card.getByRole("radio")).toHaveText(["Clean and minimal", "Bold and colorful", "Dark and moody", "Type your own…"]);
  await expect(card.getByRole("button", { name: "Next" })).toBeDisabled();
  await expect(card.getByRole("button", { name: "Back" })).toHaveCount(0); // Nothing before the first.
  await card.getByRole("radio", { name: "Bold and colorful" }).click();

  // Picking the one answer waits for Next.
  await expect(card.getByRole("radio", { name: "Bold and colorful" })).toHaveAttribute("aria-checked", "true");
  await expect(card.getByText("1 of 2")).toBeVisible();
  await card.getByRole("button", { name: "Next" }).click();
  await expect(card.getByRole("heading", { name: "Which pages do you need?" })).toBeVisible();
  await expect(card.getByText("2 of 2")).toBeVisible();
  await expect(card.getByText("Pick any")).toBeVisible();

  // Back keeps what was picked.
  await card.getByRole("button", { name: "Back" }).click();
  await expect(card.getByRole("radio", { name: "Bold and colorful" })).toHaveAttribute("aria-checked", "true");
  await card.getByRole("button", { name: "Next" }).click();

  await card.getByRole("checkbox", { name: "Home" }).click();
  await page.keyboard.press("4"); // Gallery, by its number.
  await expect(card.getByRole("checkbox", { name: "Gallery" })).toHaveAttribute("aria-checked", "true");
  await card.getByRole("checkbox", { name: "Type your own…" }).click();
  await card.getByRole("textbox", { name: "Your own answer" }).fill("  A   blog ");
  await page.screenshot({ path: test.info().outputPath("questions.png"), animations: "disabled" });
  await card.getByRole("button", { name: "Send" }).click();

  // Sent as the next prompt; the AI got its questions back with the chat.
  await expect(card).toHaveCount(0);
  const answers = "What should it look like?\n• Bold and colorful\n\nWhich pages do you need?\n• Home\n• Gallery\n• A blog";
  await expect.poll(() => lastPrompt(id)).toBe(answers);
  await expect(page.getByText("Thanks for your answers: Bold and colorful, Home, Gallery, A blog")).toBeVisible({
    timeout: 15_000,
  });

  // Answered questions stay answered after a reload.
  await page.reload();
  await expect(page.getByText("Thanks for your answers")).toBeVisible();
  await expect(page.getByRole("region", { name: "Questions" })).toHaveCount(0);
});

test("questions can be skipped, all of them too, or answered by typing a prompt", async ({ page }) => {
  const { id, card } = await ask(page);

  // Skipping one moves on; the last skip sends.
  await card.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(card.getByText("2 of 2")).toBeVisible();
  await card.getByRole("checkbox", { name: "Menu" }).click();
  await card.getByRole("button", { name: "Send" }).click();
  await expect
    .poll(() => lastPrompt(id))
    .toBe("What should it look like?\n• Skipped: you decide\n\nWhich pages do you need?\n• Menu");
  await expect(page.getByText("Thanks for your answers: Skipped: you decide, Menu")).toBeVisible({ timeout: 15_000 });

  // Skipping them all still sends the questions, each skipped.
  await page.locator("textarea:visible").fill("Now ask me again");
  await page.locator("textarea:visible").press("Enter");
  await expect(card).toBeVisible({ timeout: 15_000 });
  await card.getByRole("button", { name: "Skip", exact: true }).click();
  await card.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(card).toHaveCount(0);
  await expect
    .poll(() => lastPrompt(id))
    .toBe("What should it look like?\n• Skipped: you decide\n\nWhich pages do you need?\n• Skipped: you decide");
  await expect(page.getByText("Thanks for your answers: Skipped: you decide, Skipped: you decide")).toBeVisible({
    timeout: 15_000,
  });

  // A prompt of your own instead: the questions go away, for good.
  await page.locator("textarea:visible").fill("ask me once more");
  await page.locator("textarea:visible").press("Enter");
  await expect(card).toBeVisible({ timeout: 15_000 });
  await page.locator("textarea:visible").fill("Just make it blue");
  await page.locator("textarea:visible").press("Enter");
  await expect(card).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Just make it blue")).toBeVisible();
  await expect(page.getByRole("region", { name: "Questions" })).toHaveCount(0);
});

test("Stop on the answers puts them back in the prompt box, and the questions stay answered", async ({ page }) => {
  const { id, card } = await ask(page);
  await card.getByRole("radio", { name: "Type your own…" }).click();
  await card.getByRole("textbox", { name: "Your own answer" }).fill("hold on"); // The fake takes 10 s.
  await card.getByRole("button", { name: "Next" }).click();
  await card.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(card).toHaveCount(0);

  await page.getByRole("button", { name: "Stop", exact: true }).click();
  const answers = "What should it look like?\n• hold on\n\nWhich pages do you need?\n• Skipped: you decide";
  await expect(page.locator("textarea:visible")).toHaveValue(answers);
  await expect(page.getByText("Before I build it, a couple of questions.")).toBeVisible();
  await expect(card).toHaveCount(0);
  await expect.poll(() => lastPrompt(id)).toBe("A cafe site, ask me first");

  await page.reload();
  await expect(page.getByText("Before I build it, a couple of questions.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Questions" })).toHaveCount(0);
});

test.describe("on a phone", () => {
  test.use({ hasTouch: true, isMobile: true });

  test("an answer of your own and the buttons under it stay above the keyboard", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // Not the desktop size from beforeEach.
    const { card } = await ask(page);
    const prompt = page.locator("textarea:visible");
    await card.getByRole("radio", { name: "Type your own…" }).click();
    const field = card.getByRole("textbox", { name: "Your own answer" });
    await expect(field).toBeFocused();

    // The keyboard opens: the page shrinks to what's above it (resizes-content).
    await page.setViewportSize({ width: 390, height: 844 - 330 });
    await expect(prompt).toHaveCount(0); // Steps aside, or it would cover the card.
    const next = card.getByRole("button", { name: "Next" });
    await field.fill("Warm and cozy");
    for (const element of [field, next]) {
      await expect.poll(() => element.evaluate((e) => e.getBoundingClientRect().bottom)).toBeLessThanOrEqual(844 - 330);
      await expect.poll(() => element.evaluate((e) => e.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
    }
    await page.screenshot({ path: test.info().outputPath("keyboard.png") });

    // It closes: the prompt box is back.
    await page.setViewportSize({ width: 390, height: 844 });
    await field.blur();
    await expect(prompt).toHaveCount(1);
    await expect(next).toBeEnabled();
  });
});
