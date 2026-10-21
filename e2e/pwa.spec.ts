import { expect, test } from "@playwright/test";
import { loginToToday, watchErrors } from "./helpers";

test("manifest: scope, start URL, icons incl. maskable", async ({ request }) => {
  const r = await request.get("/app.webmanifest?locale=ru");
  expect(r.headers()["content-type"]).toContain("application/manifest+json");
  const m = await r.json();
  expect(m).toMatchObject({ scope: "/ru/app", start_url: "/ru/app/today?source=pwa", display: "standalone", lang: "ru" });
  const purposes = m.icons.map((i: { purpose: string }) => i.purpose);
  expect(purposes).toContain("maskable");
  for (const i of m.icons) {
    const img = await request.get(i.src);
    expect(img.status()).toBe(200);
    expect(img.headers()["content-type"]).toBe("image/png");
  }
});

test("head: manifest, apple-touch-icon, iOS launch images, theme colour, noindex", async ({ page, request }) => {
  await page.goto("/ru/app/login");
  const head = page.locator("head");
  await expect(head.locator('link[rel="manifest"]')).toHaveAttribute("href", "/app.webmanifest?locale=ru");
  await expect(head.locator('link[rel="apple-touch-icon"]').first()).toHaveAttribute("href", /apple-icon/);
  await expect(head.locator('meta[name="apple-mobile-web-app-capable"], meta[name="mobile-web-app-capable"]').first()).toHaveAttribute("content", "yes");
  await expect(head.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
  const splash = await head.locator('link[rel="apple-touch-startup-image"]').evaluateAll((els) => els.map((e) => (e as HTMLLinkElement).getAttribute("href")!));
  expect(splash.length).toBeGreaterThanOrEqual(8);
  const one = await request.get(splash[0]);
  expect(one.status()).toBe(200);
  expect(await head.locator('meta[name="theme-color"]').count()).toBe(2);
});

test("security headers and nonce CSP on cabinet pages; no CSP violations", async ({ page, request }) => {
  const r = await request.get("/ru/app/login");
  const h = r.headers();
  const csp = h["content-security-policy"];
  expect(csp).toMatch(/script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'none'");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("same-origin");
  expect(h["x-robots-tag"]).toContain("noindex");
  const nonce = csp.match(/'nonce-([^']+)'/)![1];
  const html = await r.text();
  // Every script tag carries the nonce.
  const scripts = html.match(/<script\b[^>]*>/g) ?? [];
  expect(scripts.length).toBeGreaterThan(0);
  for (const s of scripts) expect(s).toContain(`nonce="${nonce}"`);
  // A fresh nonce per request.
  const again = (await request.get("/ru/app/login")).headers()["content-security-policy"];
  expect(again).not.toBe(csp);
  // No analytics on the cabinet.
  expect(html).not.toMatch(/googletagmanager|gtag\(/);

  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy/i.test(m.text())) violations.push(m.text());
  });
  const errors = watchErrors(page);
  await loginToToday(page);
  await page.goto("/ru/app/calendar");
  await page.goto("/ru/app/settings");
  await expect(page.getByRole("heading", { name: "Уведомления на этом устройстве" })).toBeVisible();
  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});

test("service worker: scope per locale, shell cache without API responses", async ({ page }) => {
  await loginToToday(page);
  const sw = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    const urls: string[] = [];
    for (const k of keys) for (const r of await (await caches.open(k)).keys()) urls.push(new URL(r.url).pathname);
    return { scope: reg.scope, keys, urls };
  });
  expect(sw.scope).toMatch(/\/ru\/app$/);
  expect(sw.keys.some((k) => k.startsWith("sana-shell-"))).toBe(true);
  expect(sw.urls.filter((u) => u.startsWith("/api/"))).toEqual([]);
});

test("email unsubscribe page: GET only asks, POST without API configured is a no-op", async ({ request }) => {
  const u = "123e4567-e89b-12d3-a456-426614174000";
  const t = "A".repeat(32);
  const get = await request.get(`/api/email/unsubscribe?u=${u}&t=${t}`, { headers: { "Accept-Language": "ru" } });
  expect(get.status()).toBe(200);
  const html = await get.text();
  expect(html).toContain("Отключить письма-напоминания Sana?");
  expect(html).toContain('method="post"');
  expect(get.headers()["content-security-policy"]).toContain("default-src 'none'");
  const bad = await request.get(`/api/email/unsubscribe?u=x&t=y`);
  expect(bad.status()).toBe(400);
  const post = await request.post(`/api/email/unsubscribe?u=${u}&t=${t}`, { headers: { "Accept-Language": "en" } });
  expect(await post.text()).toContain("Demo mode");
});

test("landing page is untouched by the cabinet", async ({ request }) => {
  const html = await (await request.get("/ru")).text();
  expect(html).toContain("Sana");
  expect(html).toContain("t.me/sanacyclebot");
});

test("favicon, apple-touch-icon and share image are served (not rewritten to /<locale>/...)", async ({ request }) => {
  for (const path of ["/icon", "/apple-icon", "/opengraph-image", "/pwa-icon/badge-96.png"]) {
    const r = await request.get(path, { maxRedirects: 0 });
    expect(r.status(), path).toBe(200);
    expect(r.headers()["content-type"], path).toBe("image/png");
  }
});
