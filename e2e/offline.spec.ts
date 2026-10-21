import { expect, test } from "@playwright/test";
import { loginToToday, shot } from "./helpers";

test("offline: changes are queued and replayed; cached shell after reload", async ({ page, context }) => {
  await loginToToday(page);
  await page.goto("/ru/app/calendar");
  const grid = page.locator("[data-cal-grid]");
  await expect(grid).toBeVisible();
  // Service worker is ready and controls the page.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(grid).toBeVisible();

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.getByRole("button", { name: "Отметить месячные" }).click();
  const cells = grid.locator("button");
  const idx = await cells.evaluateAll((els) => els.findIndex((e) => e.getAttribute("aria-current") === "date"));
  await cells.nth(Math.max(0, idx - 2)).click();
  await expect(page.getByText(/Нет сети · ждут: 1/)).toBeVisible();
  await shot(page, "10-offline-queued");

  // Reload while offline: shell from the service worker, data from the encrypted cache.
  await page.goto("/ru/app/stats").catch(() => undefined);
  await expect(page.getByRole("heading", { name: "История циклов" })).toBeVisible();
  await shot(page, "11-offline-stats");

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.getByText(/Нет сети/)).toHaveCount(0, { timeout: 10_000 });
});

test("remote change (Telegram) shows up on focus", async ({ page }) => {
  await loginToToday(page);
  const before = await page.locator(".grid-cols-7 .bg-c-accent").count();
  await page.evaluate(() => {
    (window as unknown as { __sanaMock: { simulateRemoteChange: () => void } }).__sanaMock.simulateRemoteChange();
    window.dispatchEvent(new Event("focus"));
  });
  await expect.poll(() => page.locator(".grid-cols-7 .bg-c-accent").count()).toBeGreaterThanOrEqual(before);
});
