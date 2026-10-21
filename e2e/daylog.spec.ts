import { expect, test } from "@playwright/test";
import { loginToToday, shot } from "./helpers";

test("day log: chips, flow, water; no date in the URL", async ({ page }) => {
  await loginToToday(page);
  await page.getByRole("button", { name: /Как вы сегодня/ }).click();
  await page.waitForURL(/\/app\/day$/);
  expect(page.url()).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  await page.getByRole("button", { name: "Спазмы" }).click();
  await page.getByRole("button", { name: "Обильные", exact: true }).click();
  await page.getByRole("button", { name: "На 250 мл больше" }).click();
  await page.getByRole("button", { name: "На 250 мл больше" }).click();
  await expect(page.getByText("500 мл")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Спазмы" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Следующий день" })).toBeDisabled();
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "07-day-log");
  // Survives a reload (server + encrypted cache).
  await page.reload();
  await expect(page.getByRole("button", { name: "Спазмы" })).toHaveAttribute("aria-pressed", "true");
});
