import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Marketing pages: WCAG AA (axe) and SEO links for every locale.
// Accept-Language en: with ru-RU the locale detection would redirect "/" to "/ru".
test.use({ locale: "en-US" });

const SITE = "https://sanacycle.com";
const LOCALES = ["en", "ru", "uk", "es"] as const;
const PATHS = ["", "/privacy", "/terms"] as const;
const url = (locale: string, path: string) => `${locale === "en" ? "" : `/${locale}`}${path}` || "/";
/** The canonical form used in metadata and the sitemap (the root has no trailing slash). */
const abs = (locale: string, path: string) => `${SITE}${locale === "en" ? "" : `/${locale}`}${path}`;

async function axe(page: Page) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return r.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")}`);
}

/** Scroll through the page so the scroll-triggered sections are rendered. */
async function revealAll(page: Page) {
  const height = await page.evaluate(() => document.body.scrollHeight);
  for (let y = 0; y < height; y += 500) await page.evaluate((top) => window.scrollTo(0, top), y);
  await page.waitForTimeout(900);
}

for (const scheme of ["light", "dark"] as const) {
  test(`axe: landing pages have no serious violations (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    const found: Record<string, string[]> = {};
    for (const locale of LOCALES) {
      for (const path of PATHS) {
        await page.goto(url(locale, path));
        await revealAll(page);
        found[url(locale, path)] = await axe(page);
      }
    }
    expect(found).toEqual(Object.fromEntries(Object.keys(found).map((k) => [k, []])));
  });
}

test("axe: landing menus and form states", async ({ page }) => {
  await page.goto("/ru");
  await page.getByRole("button", { name: "Русский" }).click();
  await expect(page.getByRole("button", { name: "Русский" }).first()).toHaveAttribute("aria-expanded", "true");
  const menu = await axe(page);
  await page.keyboard.press("Escape");

  const faq = page.locator("button[aria-controls^='faq-']").nth(1);
  await faq.click();
  await expect(faq).toHaveAttribute("aria-expanded", "true");
  await page.getByLabel("Электронная почта").fill("test@example.com");
  await page.getByRole("button", { name: "Уведомить меня" }).click();
  await expect(page.locator("form [role=alert]")).toContainText("политику");
  await revealAll(page);
  expect({ menu, form: await axe(page) }).toEqual({ menu: [], form: [] });
});

test("SEO: self-referencing canonical and hreflang alternates on every landing page", async ({ page, request }) => {
  for (const locale of LOCALES) {
    for (const path of PATHS) {
      const res = await page.goto(url(locale, path));
      // hreflang only from the page itself (on the canonical domain), not from a Link header.
      expect(res?.headers().link ?? "").not.toContain('rel="alternate"');
      await expect(page.locator("link[rel=canonical]")).toHaveAttribute("href", abs(locale, path));
      const alternates = await page
        .locator("link[rel=alternate][hreflang]")
        .evaluateAll((els) => Object.fromEntries(els.map((e) => [e.getAttribute("hreflang"), e.getAttribute("href")])));
      const expected = Object.fromEntries(LOCALES.map((l) => [l, abs(l, path)]));
      expect(alternates).toEqual({ ...expected, "x-default": expected.en });
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
    }
  }

  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const locale of LOCALES) {
    for (const path of PATHS) expect(sitemap).toContain(`<loc>${abs(locale, path)}</loc>`);
  }
  expect(sitemap).not.toContain("/app");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
});
