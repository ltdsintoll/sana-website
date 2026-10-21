import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

/** Log in with the demo backend (any email, code 123456). */
export async function login(page: Page, email: string, locale = "ru") {
  const prefix = locale === "en" ? "" : `/${locale}`;
  await page.goto(`${prefix}/app/login`);
  await page.getByLabel(locale === "en" ? "Email" : "Email").fill(email);
  await page.getByRole("button", { name: locale === "en" ? "Get a code" : "Получить код" }).click();
  await page.getByLabel(locale === "en" ? "Code from the email" : "Код из письма").fill("123456");
}

export async function loginToToday(page: Page, email = "anna@example.com") {
  await login(page, email);
  await page.waitForURL(/\/app\/today/);
  await expect(page.locator("section[aria-live=polite]").first()).toBeVisible();
}

export async function logout(page: Page) {
  await page.goto("/ru/app/logout");
  await page.waitForURL(/\/app\/login/);
}

/** Today as YYYY-MM-DD in the test time zone (Europe/Moscow). */
export async function todayYmd(page: Page, offsetDays = 0): Promise<string> {
  return page.evaluate((o) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date(Date.now() + o * 86400000)), offsetDays);
}

export function hero(page: Page) {
  return page.locator("section[aria-live=polite]").first();
}

/** Toast live region (stays mounted). */
export function toast(page: Page) {
  return page.locator('[role="status"][aria-live="polite"][aria-atomic="true"]');
}

/** Saves a review screenshot when E2E_SCREENSHOTS is set. */
export async function shot(page: Page, name: string) {
  const dir = process.env.E2E_SCREENSHOTS;
  if (!dir) return;
  fs.mkdirSync(dir, { recursive: true });
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(dir, `${name}.png`) });
}

/** Collects page errors and console errors (except expected offline noise). */
export function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() !== "error") return;
    const text = m.text();
    if (/ERR_INTERNET_DISCONNECTED|Failed to fetch|net::ERR_FAILED|status of 40[134]|status of 429/.test(text)) return;
    errors.push(text);
  });
  return errors;
}
