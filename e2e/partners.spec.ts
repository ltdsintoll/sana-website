import { expect, test, type Page } from "@playwright/test";
import { login, loginToToday, logout, shot, toast } from "./helpers";

async function createInvite(page: Page, label: string): Promise<string> {
  await page.goto("/ru/app/settings");
  await page.getByRole("button", { name: "Пригласить партнёра" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Имя (видите только вы)").fill(label);
  await dialog.getByRole("button", { name: "Создать ссылку" }).click();
  await expect(page.getByRole("dialog", { name: "Ссылка готова" })).toBeVisible();
  const url = (await page.locator("[data-invite-url]").innerText()).trim();
  expect(url).toMatch(/\/app\/partner\/accept\?invite=[0-9a-f-]{36}$/);
  await shot(page, "24-partner-invite-link");
  await page.getByRole("dialog").getByRole("button", { name: "Закрыть" }).click();
  return url;
}

test("owner invites, partner signs up and accepts, nudges, owner manages access", async ({ page }) => {
  await loginToToday(page, "anna@example.com");
  const url = await createInvite(page, "Саша");
  await expect(page.getByText("Приглашение ещё не принято")).toBeVisible();

  // Opening your own invite is refused.
  await page.goto(new URL(url).pathname + new URL(url).search);
  await page.getByRole("button", { name: "Принять приглашение" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toContainText("Это ваше собственное приглашение");

  // The partner: a new account, signs in on the invite page.
  await logout(page);
  await page.goto(new URL(url).pathname + new URL(url).search);
  await expect(page.getByText("Вас пригласили видеть цикл партнёрши")).toBeVisible();
  // The invite id is removed from the address bar right away.
  expect(page.url()).not.toContain("invite=");
  await page.getByLabel("Email").fill("newsasha@example.com");
  await page.getByRole("button", { name: "Получить код" }).click();
  await page.getByLabel("Код из письма").fill("123456");
  await expect(page.getByRole("heading", { name: "Приглашение партнёра" })).toBeVisible();
  const accept = page.getByRole("button", { name: "Принять приглашение" });
  await expect(accept).toBeDisabled(); // consent first (new account)
  await page.getByRole("checkbox").check();
  await shot(page, "25-partner-accept");
  await accept.click();
  await page.waitForURL(/\/app\/partner$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Anna");
  await expect(page.getByRole("heading", { name: "Совет на сегодня" })).toBeVisible();
  await shot(page, "26-partner-view");

  // Nudges: 3 per day.
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: "Обнимаю" }).click();
    await expect(toast(page)).toContainText("Отправлено");
  }
  await expect(page.getByText("На сегодня всё", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Обнимаю" })).toBeDisabled();

  // A partner-only account is not pushed into the cycle questions.
  await page.goto("/ru/app/today");
  await expect(page).toHaveURL(/\/app\/today/);
  await expect(page.getByRole("heading", { name: "С вами делятся" })).toBeVisible();

  // Owner: the partner is listed, permissions can be changed, access revoked.
  await logout(page);
  await login(page, "anna@example.com");
  await page.waitForURL(/\/app\/today/);
  await page.goto("/ru/app/settings");
  await expect(page.getByText("Видит ваш цикл")).toBeVisible();
  await page.getByRole("button", { name: /Видит ваш цикл/ }).click();
  const editor = page.getByRole("dialog");
  const fertile = editor.getByRole("switch", { name: "Фертильное окно" });
  await expect(fertile).not.toBeChecked();
  await editor.getByText("Фертильное окно").click();
  await expect(fertile).toBeChecked();
  await shot(page, "27-partner-permissions");
  await editor.getByRole("button", { name: "Закрыть доступ" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Подтвердить" }).click();
  await expect(toast(page)).toContainText("Готово");
  await expect(page.getByText("Видит ваш цикл")).toHaveCount(0);
});

test("demo partner account sees a shared cycle", async ({ page }) => {
  await login(page, "partner@example.com");
  await page.waitForURL(/\/app\/onboarding/);
  await page.goto("/ru/app/settings").catch(() => undefined);
  // Through the list on the settings screen (after consent) or directly:
  await page.goto("/ru/app/partner");
  await expect(page.getByRole("heading", { name: "Совет на сегодня" })).toBeVisible();
  await expect(page.locator("section[aria-live=polite]").first()).toContainText(/Месячные|Задержка|Сегодня/);
});

test("invalid invite link", async ({ page }) => {
  await page.goto("/ru/app/partner/accept?invite=not-a-uuid");
  await expect(page.getByText("Ссылка-приглашение неполная или неверная.")).toBeVisible();
});
