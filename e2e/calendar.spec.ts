import { expect, test } from "@playwright/test";
import { loginToToday, shot, toast } from "./helpers";

test("calendar: day sheet, read-only future, one-tap edit with undo", async ({ page }) => {
  await loginToToday(page);
  await page.getByRole("link", { name: "Календарь" }).click();
  await page.waitForURL(/\/app\/calendar/);
  const grid = page.locator("[data-cal-grid]");
  await expect(grid).toBeVisible();
  await shot(page, "04-calendar");

  await page.locator('[aria-current="date"]').click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("switch", { name: "Месячные в этот день" })).toHaveCount(1);
  await shot(page, "05-calendar-day-sheet");
  await dialog.getByRole("button", { name: "Закрыть" }).click();

  await page.getByRole("button", { name: "Следующий месяц" }).click();
  await grid.locator("button").nth(10).click();
  await expect(dialog).toContainText("Будущие дни отметить нельзя");
  await expect(dialog.getByRole("switch")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByRole("button", { name: "К сегодняшнему дню" }).click();

  await page.getByRole("button", { name: "Отметить месячные" }).click();
  const cells = grid.locator("button");
  const idx = await cells.evaluateAll((els) => els.findIndex((e) => e.getAttribute("aria-current") === "date"));
  test.skip(idx < 1, "first day of the month");
  await cells.nth(idx - 1).click();
  await expect(toast(page)).toContainText("месячные отмечены");
  await shot(page, "06-calendar-edit-mode");
  // A lone past day starts a period that is still going today: both days are marked.
  await expect(cells.nth(idx - 1)).toHaveAttribute("aria-label", /: Месячные$/);
  await expect(cells.nth(idx)).toHaveAttribute("aria-label", /: Месячные$/);
  await page.getByRole("button", { name: "Отменить" }).click();
  await expect(toast(page)).toContainText("Отменено");
  // Undo removes the whole new period, not just the tapped day.
  await expect(cells.nth(idx - 1)).not.toHaveAttribute("aria-label", /: Месячные$/);
  await expect(cells.nth(idx)).not.toHaveAttribute("aria-label", /: Месячные$/);
});

test("long period guard asks before a period longer than 10 days (contract 11)", async ({ page }) => {
  await loginToToday(page);
  await page.goto("/ru/app/calendar");
  await page.getByRole("button", { name: "Предыдущий месяц" }).click();
  await page.getByRole("button", { name: "Отметить месячные" }).click();
  const cells = page.locator("[data-cal-grid] button");
  const dialog = page.getByRole("dialog");
  let asked = false;
  for (let i = 0; i < 25 && !asked; i++) {
    const cell = cells.nth(i);
    // Days already logged as period count towards the run: leave them as they are.
    if ((await cell.getAttribute("aria-label"))?.endsWith(": Месячные")) continue;
    await cell.click();
    await expect(async () => {
      const marked = (await cell.getAttribute("aria-label"))?.endsWith(": Месячные");
      expect(marked || (await dialog.isVisible())).toBe(true);
    }).toPass();
    if (await dialog.isVisible()) asked = true;
  }
  expect(asked).toBe(true);
  await expect(dialog).toContainText(/Месячные уже \d+ (день|дня|дней) подряд/);
  await shot(page, "22-long-period-guard");
  await dialog.getByRole("button", { name: "Отмена" }).click();
  await expect(dialog).toHaveCount(0);
});

test("sheet keeps keyboard focus inside", async ({ page }) => {
  await loginToToday(page);
  await page.goto("/ru/app/calendar");
  await page.locator('[aria-current="date"]').click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
});
