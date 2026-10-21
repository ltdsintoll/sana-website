import { expect, test } from "@playwright/test";
import { login, loginToToday, shot, toast } from "./helpers";

test("link Telegram via the bot deep link", async ({ page }) => {
  await loginToToday(page);
  await page.goto("/ru/app/settings");
  await expect(page.getByText("Привязать").first()).toBeVisible();
  await shot(page, "09-settings");
  await page.getByRole("button", { name: "Привязать" }).first().click();
  await page.getByRole("button", { name: "Подтвердить в Telegram-боте" }).click();
  await expect(page.getByRole("link", { name: "Открыть Telegram" })).toBeVisible();
  await expect(page.getByText("Telegram привязан")).toBeVisible({ timeout: 15_000 });
});

test("link an email that has its own account: merge confirmation", async ({ page }) => {
  await page.goto("/ru/app/login");
  await page.getByRole("button", { name: "Войти через Telegram" }).click();
  await page.waitForURL(/\/app\/today/, { timeout: 15_000 });
  await page.goto("/ru/app/settings");
  await page.getByRole("button", { name: "Привязать" }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Email").fill("merge-old@example.com");
  await dialog.getByRole("button", { name: "Получить код" }).click();
  await dialog.getByLabel("Код из письма").fill("123456");
  await expect(page.getByRole("heading", { name: "Объединить аккаунты?" })).toBeVisible();
  await shot(page, "19-merge-confirm");
  await page.getByRole("button", { name: "Объединить", exact: true }).click();
  await expect(page.getByText("Email привязан")).toBeVisible();
  await expect(page.getByText("merge-old@example.com")).toBeVisible();
});

test("Web Push: turn on, device list, test notification, turn off", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await loginToToday(page);
  await page.goto("/ru/app/settings");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.getByRole("button", { name: "Включить напоминания" }).click();
  await expect(toast(page)).toContainText("Напоминания включены на этом устройстве");
  await expect(page.getByText("Устройства с уведомлениями")).toBeVisible();
  await expect(page.getByText("это устройство")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Уведомления в браузере" })).toBeChecked();
  await shot(page, "23-settings-push-on");

  await page.getByRole("button", { name: "Проверить" }).click();
  await expect(toast(page)).toContainText("Тестовое уведомление отправлено");
  await expect
    .poll(() => page.evaluate(async () => (await (await navigator.serviceWorker.ready).getNotifications()).map((n) => `${n.title}|${n.tag}|${n.body}`)))
    .toContainEqual(expect.stringMatching(/^Sana\|sana-test\|Уведомления включены/));

  // Re-sent on every start, still one device.
  await page.reload();
  await expect(page.getByText("это устройство")).toBeVisible();
  await expect(page.locator("li", { hasText: "это устройство" })).toHaveCount(1);

  await page.getByRole("button", { name: "Выключить на этом устройстве" }).click();
  await expect(toast(page)).toContainText("Напоминания выключены");
  await expect(page.getByText("Устройства с уведомлениями")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Включить напоминания" })).toBeVisible();
});

test("service worker shows a server push with actions (contract 8 payload)", async ({ page, context }) => {
  await context.grantPermissions(["notifications"]);
  await loginToToday(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  const cdp = await context.newCDPSession(page);
  const regs: Array<{ registrationId: string; scopeURL: string }> = [];
  cdp.on("ServiceWorker.workerRegistrationUpdated", (e) => regs.push(...e.registrations));
  await cdp.send("ServiceWorker.enable");
  await expect.poll(() => regs.find((r) => r.scopeURL.endsWith("/ru/app"))).toBeTruthy();
  const reg = regs.find((r) => r.scopeURL.endsWith("/ru/app"))!;
  const payload = {
    v: 1,
    kind: "period_late_d1",
    title: "Sana",
    body: "Месячные задерживаются на 1 день. Начались?",
    url: "https://evil.example/phish",
    tag: "sana-cycle",
    actions: [
      { action: "period_started_today", title: "Да, сегодня" },
      { action: "period_started_yesterday", title: "Да, вчера" },
      { action: "javascript:alert(1)", title: "x" },
    ],
    ts: Date.now(),
  };
  await cdp.send("ServiceWorker.deliverPushMessage", { origin: new URL(page.url()).origin, registrationId: reg.registrationId, data: JSON.stringify(payload) });
  const shown = await expect
    .poll(() =>
      page.evaluate(async () =>
        (await (await navigator.serviceWorker.ready).getNotifications({ tag: "sana-cycle" })).map((n) => ({
          body: n.body,
          url: (n.data as { url: string }).url,
          actions: (n.data as { actions: Array<{ action: string }> }).actions.map((a) => a.action),
        })),
      ),
    )
    .toEqual([
      {
        body: "Месячные задерживаются на 1 день. Начались?",
        // Foreign URLs are never opened: falls back to the cabinet.
        url: expect.stringMatching(/^http:\/\/localhost:\d+\/ru\/app$/),
        actions: ["period_started_today", "period_started_yesterday"],
      },
    ]);
  void shown;
});

test("notification channels: email fallback needs a verified email", async ({ page }) => {
  // Telegram-only account (deep-link login): email switch disabled.
  await page.goto("/ru/app/login");
  await page.getByRole("button", { name: "Войти через Telegram" }).click();
  await page.waitForURL(/\/app\/today/, { timeout: 15_000 });
  await page.goto("/ru/app/settings");
  const email = page.getByRole("switch", { name: "Письмо, если месячные задерживаются" });
  await expect(email).toBeDisabled();
  await expect(page.getByText("Добавьте и подтвердите email выше")).toBeVisible();
  await expect(page.getByRole("switch", { name: "Telegram" })).toBeChecked();

  // Email account: opt-in works and is saved.
  await page.goto("/ru/app/logout");
  await page.waitForURL(/login/);
  await login(page, "anna@example.com");
  await page.waitForURL(/\/app\/today/);
  await page.goto("/ru/app/settings");
  const email2 = page.getByRole("switch", { name: "Письмо, если месячные задерживаются" });
  await expect(email2).toBeEnabled();
  await page.getByText("Письмо, если месячные задерживаются").click();
  await expect(email2).toBeChecked();
  // The demo backend lives in the page: wait until it has saved before reloading.
  await expect.poll(() => page.evaluate(() => localStorage.getItem("sana-mock-db")?.includes('"emailLateReminders":true'))).toBe(true);
  await page.reload();
  await expect(page.getByRole("switch", { name: "Письмо, если месячные задерживаются" })).toBeChecked();
  await expect(page.getByText("Чтобы получать напоминания и в Telegram")).toBeVisible();
});
