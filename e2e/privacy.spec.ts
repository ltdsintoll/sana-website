import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { login, loginToToday, shot, toast } from "./helpers";

test("download my data, withdraw consent (data stays, writes ask again), give it again (v1.4)", async ({ page }) => {
  await loginToToday(page);
  await page.getByRole("link", { name: "Настройки" }).click();
  await page.waitForURL(/\/app\/settings/);
  const card = page.locator("[data-my-data]");
  await expect(card).toContainText("Дано");

  const [download] = await Promise.all([page.waitForEvent("download"), card.getByRole("button", { name: "Скачать мои данные (JSON)" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^sana-export-\d{4}-\d{2}-\d{2}\.json$/);
  const file = JSON.parse(fs.readFileSync((await download.path())!, "utf8"));
  expect(file.format).toBe("sana-export");
  expect(file.periods.length).toBeGreaterThan(3);

  await card.getByRole("button", { name: "Отозвать согласие" }).click();
  const sheet = page.getByRole("dialog", { name: "Отозвать согласие?" });
  await expect(sheet).toContainText("Уже сохранённые данные останутся");
  await expect(sheet.getByRole("button", { name: "Сначала скачать мои данные" })).toBeVisible();
  await shot(page, "30-withdraw-sheet");
  await sheet.getByRole("button", { name: "Отозвать согласие" }).click();
  await expect(toast(page)).toContainText("Согласие отозвано");
  await expect(card).toContainText("Отозвано");

  // The cabinet stays readable with a banner; history is still there.
  await page.getByRole("link", { name: "Календарь" }).click();
  await expect(page.locator("[data-consent-banner]")).toContainText("Вы отозвали согласие");
  await expect(page.locator("[data-cal-grid] button[aria-label$=': Месячные']").first()).toBeVisible();
  await shot(page, "31-withdrawn-banner");

  // A reload keeps her in the cabinet (no onboarding).
  await page.reload();
  await expect(page.locator("[data-consent-banner]")).toBeVisible();
  expect(page.url()).toMatch(/\/app\/calendar/);

  // A write asks for consent first; accepting saves it.
  await page.getByRole("button", { name: "Отметить месячные" }).click();
  const cells = page.locator("[data-cal-grid] button");
  const idx = await cells.evaluateAll((els) => els.findIndex((e) => e.getAttribute("aria-current") === "date"));
  test.skip(idx < 1, "first day of the month");
  await cells.nth(idx - 1).click();
  const gate = page.getByRole("dialog", { name: "Дать согласие снова?" });
  await expect(gate).toBeVisible();
  await gate.getByRole("checkbox").check();
  await gate.getByRole("button", { name: "Согласиться и сохранить" }).click();
  await expect(page.locator("[data-consent-banner]")).toHaveCount(0);
  await expect(cells.nth(idx - 1)).toHaveAttribute("aria-label", /: Месячные$/);
});

test("a new policy version asks once, the cabinet stays usable until then (v1.4)", async ({ page }) => {
  await login(page, "reconsent@example.com");
  await page.waitForURL(/\/app\/today/);
  const gate = page.getByRole("dialog", { name: "Мы обновили политику конфиденциальности" });
  await expect(gate).toBeVisible();
  await shot(page, "32-reconsent");
  await gate.getByRole("button", { name: "Не сейчас" }).first().click();
  await expect(page.locator("[data-consent-banner]")).toContainText("Мы обновили политику");
  await page.locator("[data-consent-banner]").getByRole("button", { name: "Дать согласие" }).click();
  await gate.getByRole("checkbox").check();
  await gate.getByRole("button", { name: "Согласиться и сохранить" }).click();
  await expect(page.locator("[data-consent-banner]")).toHaveCount(0);
});
