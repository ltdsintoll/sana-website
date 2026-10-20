import { expect, test, type Page } from "@playwright/test";
import { login, loginToToday, shot, toast } from "./helpers";

type MockDb = { session: string; users: Record<string, { me: { gdprConsent: boolean; consent?: { accepted: boolean; version: string | null } } }> };

/** Consent state of the signed-in demo account, as the demo server sees it. */
async function serverConsent(page: Page) {
  return page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("sana-mock-db") ?? "{}") as MockDb;
    return db.users[db.session]?.me.consent ?? null;
  });
}

/** Simulates consent withdrawn elsewhere: the server now answers 403 consent_required to writes. */
async function revokeOnServer(page: Page) {
  await page.evaluate(() => {
    const db = JSON.parse(localStorage.getItem("sana-mock-db") ?? "{}") as MockDb;
    const me = db.users[db.session].me;
    me.gdprConsent = false;
    me.consent = { ...(me.consent ?? { version: null }), accepted: false } as never;
    localStorage.setItem("sana-mock-db", JSON.stringify(db));
  });
}

async function markYesterday(page: Page) {
  const cells = page.locator("[data-cal-grid] button");
  const idx = await cells.evaluateAll((els) => els.findIndex((e) => e.getAttribute("aria-current") === "date"));
  test.skip(idx < 1, "first day of the month");
  const cell = cells.nth(idx - 1);
  await cell.click();
  return cell;
}

test("account with data but no consent sees the consent screen first (v1.3)", async ({ page }) => {
  await login(page, "noconsent@example.com");
  await page.waitForURL(/\/app\/onboarding/);
  await expect(page.getByRole("heading", { name: "Ваши данные остаются вашими" })).toBeVisible();
  // Data screens are not reachable before consent.
  await page.goto("/ru/app/calendar");
  await page.waitForURL(/\/app\/onboarding/);
  const next = page.getByRole("button", { name: "Продолжить" });
  await expect(next).toBeDisabled();
  await page.getByRole("checkbox").check();
  await next.click();
  // The account already has data: straight to Today, no cycle questions.
  await page.waitForURL(/\/app\/today/);
  expect(await serverConsent(page)).toMatchObject({ accepted: true, version: "2026-10-20" });
});

test("403 consent_required on a write: consent screen, then the write is sent again", async ({ page }) => {
  await loginToToday(page);
  // Client-side navigation: a full reload would re-read the session, and after
  // the revoke below that already shows the onboarding consent step instead.
  await page.getByRole("link", { name: "Календарь" }).click();
  await expect(page.locator("[data-cal-grid]")).toBeVisible();
  await revokeOnServer(page);

  await page.getByRole("button", { name: "Отметить месячные" }).click();
  const cell = await markYesterday(page);
  const gate = page.getByRole("dialog", { name: "Чтобы сохранить, нужно ваше согласие" });
  await expect(gate).toBeVisible();
  await shot(page, "30-consent-gate");

  // "Not now": nothing is saved.
  await gate.getByRole("button", { name: "Не сейчас" }).last().click();
  await expect(gate).toHaveCount(0);
  await expect(toast(page)).toContainText("сначала нужно согласие");
  expect(await cell.getAttribute("aria-label")).not.toMatch(/: Месячные$/);

  // Second try: agree, and the same write goes through.
  await cell.click();
  await expect(gate).toBeVisible();
  const agree = gate.getByRole("button", { name: "Согласиться и сохранить" });
  await expect(agree).toBeDisabled();
  await gate.getByRole("checkbox").check();
  await agree.click();
  await expect(gate).toHaveCount(0);
  await expect(cell).toHaveAttribute("aria-label", /: Месячные$/);
  expect(await serverConsent(page)).toMatchObject({ accepted: true });
});

test("offline queue replay hits consent_required: kept, then replayed after consent", async ({ page, context }) => {
  await loginToToday(page);
  // Client-side navigation: a full reload would re-read the session, and after
  // the revoke below that already shows the onboarding consent step instead.
  await page.getByRole("link", { name: "Календарь" }).click();
  await expect(page.locator("[data-cal-grid]")).toBeVisible();

  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.getByRole("button", { name: "Отметить месячные" }).click();
  const cell = await markYesterday(page);
  await expect(page.getByText(/Нет сети · ждут: 1/)).toBeVisible();
  await revokeOnServer(page);

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  const gate = page.getByRole("dialog", { name: "Чтобы сохранить, нужно ваше согласие" });
  await expect(gate).toBeVisible();
  // The queued change is still there (not dropped as a refused 4xx).
  await expect(page.getByText(/не удалось применить/)).toHaveCount(0);

  await gate.getByRole("checkbox").check();
  await gate.getByRole("button", { name: "Согласиться и сохранить" }).click();
  await expect(gate).toHaveCount(0);
  await expect(cell).toHaveAttribute("aria-label", /: Месячные$/);
  await expect(page.getByText(/Нет сети/)).toHaveCount(0);
  expect(await serverConsent(page)).toMatchObject({ accepted: true });
});
