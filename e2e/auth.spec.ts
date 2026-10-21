import { expect, test } from "@playwright/test";
import { hero, login, loginToToday, logout, shot, watchErrors } from "./helpers";

test("anonymous visitor is sent to the login screen", async ({ page }) => {
  await page.goto("/ru/app");
  await page.waitForURL(/\/ru\/app\/login/);
  await expect(page.getByRole("button", { name: "Войти через Telegram" })).toBeVisible();
  await shot(page, "01-login");
});

test("email login lands on Today with the forecast", async ({ page }) => {
  const errors = watchErrors(page);
  await loginToToday(page);
  await expect(page.getByText("Следующие месячные").first()).toBeVisible();
  await expect(hero(page)).toContainText(/Через \d+ д/);
  await shot(page, "02-today-expected");
  expect(errors).toEqual([]);
});

test("verify lockout (429 too_many_attempts) tells how long to wait", async ({ page }) => {
  await login(page, "locked@example.com");
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Попробуйте через 30 мин.");
  await expect(page.getByRole("button", { name: "Войти", exact: true })).toBeDisabled();
});

test("Telegram deep-link login", async ({ page }) => {
  await page.goto("/ru/app/login");
  await page.getByRole("button", { name: "Войти через Telegram" }).click();
  const link = page.getByRole("link", { name: "Открыть Telegram" });
  await expect(link).toHaveAttribute("href", /^https:\/\/t\.me\//);
  await shot(page, "16-login-telegram-waiting");
  await page.waitForURL(/\/app\/today/, { timeout: 15_000 });
});

test("logout wipes the encrypted cache, queue and page cache", async ({ page }) => {
  await loginToToday(page);
  // Something is stored while signed in.
  await expect
    .poll(() => page.evaluate(() => new Promise<number>((r) => {
      const req = indexedDB.open("sana-cabinet");
      req.onsuccess = () => {
        const tx = req.result.transaction("kv", "readonly").objectStore("kv").count();
        tx.onsuccess = () => r(tx.result);
      };
    })))
    .toBeGreaterThan(1);
  await logout(page);
  const left = await page.evaluate(() => new Promise<number>((r) => {
    const req = indexedDB.open("sana-cabinet");
    req.onsuccess = () => {
      const tx = req.result.transaction("kv", "readonly").objectStore("kv").count();
      tx.onsuccess = () => r(tx.result);
    };
  }));
  expect(left).toBe(0);
  const shells = await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith("sana-shell-")).length);
  expect(shells).toBe(0);
  expect(await page.evaluate(() => sessionStorage.getItem("sana-selected-day"))).toBeNull();
});

test("another account on the same browser never sees the previous data", async ({ page }) => {
  await loginToToday(page, "anna@example.com");
  await logout(page);
  await login(page, "new@example.com");
  await page.waitForURL(/\/app\/onboarding/);
  await expect(page.getByRole("heading", { name: "Ваши данные остаются вашими" })).toBeVisible();
  // Straight to a tab: still onboarding, no cached cycle of the first account.
  await page.goto("/ru/app/stats");
  await page.waitForURL(/\/app\/onboarding/);
});

test("a logout in one tab signs out the other tabs", async ({ page, context }) => {
  await loginToToday(page);
  const other = await context.newPage();
  await other.goto("/ru/app/stats");
  await expect(other.getByRole("heading", { name: "История циклов" })).toBeVisible();
  await logout(page);
  await other.waitForURL(/\/app\/login/, { timeout: 10_000 });
});
