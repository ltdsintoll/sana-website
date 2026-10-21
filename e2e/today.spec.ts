import { expect, test } from "@playwright/test";
import { hero, loginToToday, shot, toast, todayYmd } from "./helpers";

test("one-tap period start with undo", async ({ page }) => {
  await loginToToday(page);
  await page.getByRole("button", { name: "Месячные начались", exact: true }).click();
  await expect(toast(page)).toContainText("Месячные начались сегодня");
  await expect(hero(page)).toContainText("День 1");
  await shot(page, "03-today-started-undo-toast");
  await page.getByRole("button", { name: "Отменить" }).click();
  await expect(toast(page)).toContainText("Отменено");
  await expect(hero(page)).toContainText(/Через \d+ д/);
});

test("start 10 days ago asks (409 needs_confirmation) and can be saved as spotting", async ({ page }) => {
  await loginToToday(page);
  await page.getByRole("button", { name: "Начались в другой день" }).click();
  await page.getByRole("dialog").locator('input[type="date"]').fill(await todayYmd(page, -10));
  await page.getByRole("dialog").getByRole("button", { name: "Выбрать" }).click();
  await expect(page.getByRole("heading", { name: "Это новые месячные?" })).toBeVisible();
  await shot(page, "03b-needs-confirmation");
  await page.getByRole("button", { name: /Мажущие выделения/ }).click();
  await expect(toast(page)).toContainText("Отмечены мажущие выделения");
  await expect(hero(page)).toContainText(/Через \d+ д/);
});

test("states: late, period, pregnancy", async ({ page }) => {
  await loginToToday(page, "late@example.com");
  await expect(page.getByText(/Задержка \d+ д/).first()).toBeVisible();
  await shot(page, "12-today-late");
  await page.goto("/ru/app/logout");
  await page.waitForURL(/login/);
  await loginToToday(page, "period@example.com");
  await expect(page.getByText("День 2")).toBeVisible();
  await expect(page.getByRole("button", { name: "Месячные закончились" })).toHaveCount(1);
  await shot(page, "13-today-period");
  await page.goto("/ru/app/logout");
  await page.waitForURL(/login/);
  await loginToToday(page, "pregnant@example.com");
  await expect(page.getByText(/нед\./).first()).toBeVisible();
});

test("new account: consent and onboarding create the first period", async ({ page }) => {
  await page.goto("/ru/app/login");
  await page.getByLabel("Email").fill("new@example.com");
  await page.getByRole("button", { name: "Получить код" }).click();
  await page.getByLabel("Код из письма").fill("123456");
  await page.waitForURL(/\/app\/onboarding/);
  await shot(page, "15-onboarding-consent");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Продолжить" }).click();
  await page.getByRole("button", { name: "Вчера" }).click();
  await page.getByRole("button", { name: "Далее" }).click();
  await expect(page.getByRole("button", { name: "На день больше" })).toBeVisible();
  await page.getByRole("button", { name: "Далее" }).click();
  await page.getByRole("button", { name: "Готово" }).click();
  await page.waitForURL(/\/app\/today/);
  await expect(page.getByText("День 2")).toBeVisible();
});

test("irregular cycle: a band of days, never 'expected today'; steady cycles keep the exact day", async ({ page }) => {
  await loginToToday(page, "irregular@example.com");
  // Cycles of 24-35 days, last start 20 days ago: the next one in 4-15 days.
  await expect(hero(page)).toContainText("Через 4–15 дней");
  await expect(hero(page)).toContainText(/Между .+ и .+/);
  await expect(page.locator("[data-irregular-note]")).toContainText("Цикл нерегулярный");
  await expect(page.getByText("Ожидаются сегодня")).toHaveCount(0);
  await shot(page, "14-today-irregular-range");
  await page.goto("/en/app/today");
  await expect(hero(page)).toContainText("In 4–15 days");
  await page.goto("/ru/app/logout");
  await page.waitForURL(/login/);
  await loginToToday(page, "steady@example.com");
  await expect(hero(page)).toContainText(/Через \d+ д/);
  await expect(hero(page)).not.toContainText(/Примерно|–|Между/);
  await expect(page.locator("[data-irregular-note]")).toHaveCount(0);
});
