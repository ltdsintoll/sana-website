import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { login, loginToToday } from "./helpers";

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
}

for (const scheme of ["light", "dark"] as const) {
  test(`axe: no serious violations on the cabinet screens (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
    await page.goto("/ru/app/login");
    await expect(page.getByRole("button", { name: "Войти через Telegram" })).toBeVisible();
    const found: Record<string, string[]> = { login: await axe(page) };
    await loginToToday(page);
    found.today = await axe(page);
    for (const [name, path, ready] of [
      ["calendar", "/ru/app/calendar", "[data-cal-grid]"],
      ["stats", "/ru/app/stats", "main ul, main section"],
      ["settings", "/ru/app/settings", "text=Уведомления на этом устройстве"],
      ["day", "/ru/app/day", "text=Спазмы"],
    ] as const) {
      await page.goto(path);
      await page.locator(ready).first().waitFor();
      await page.waitForTimeout(300);
      found[name] = await axe(page);
    }
    expect(found).toEqual({ login: [], today: [], calendar: [], stats: [], settings: [], day: [] });
  });
}

test("axe: partner view and onboarding", async ({ page }) => {
  await login(page, "partner@example.com");
  await page.waitForURL(/\/app\/onboarding/);
  const onboarding = await axe(page);
  await page.goto("/ru/app/partner");
  await expect(page.getByText("Совет на сегодня")).toBeVisible();
  expect({ onboarding, partner: await axe(page) }).toEqual({ onboarding: [], partner: [] });
});
