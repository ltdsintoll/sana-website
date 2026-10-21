import { expect, test, type Page } from "@playwright/test";
import { login, loginToToday, logout } from "./helpers";

// Unsent changes (offline queue) must survive a change of the account id:
// a merge done on another device keeps them for the survivor, another account
// signing in parks them until their own account is back (never sent to it).

type MockEpisode = { startYmd: string; endYmd: string | null };
type MockDb = {
  session: string | null;
  users: Record<string, { me: { id: string; email: string | null; mergedAccountIds?: string[] }; episodes: MockEpisode[] }>;
};

type MockApi = { simulateMergeElsewhere: () => string | null; expireSession: () => void };

async function mockDb(page: Page): Promise<MockDb> {
  return page.evaluate(() => JSON.parse(localStorage.getItem("sana-mock-db") ?? "{}") as MockDb);
}

function hasPeriodOn(eps: MockEpisode[], ymd: string, today: string): boolean {
  return eps.some((e) => e.startYmd <= ymd && (e.endYmd ?? today) >= ymd);
}

/** Offline: marks the day two days before today in the calendar; returns its date. */
async function queueDayOffline(page: Page): Promise<string> {
  await page.goto("/ru/app/calendar");
  const grid = page.locator("[data-cal-grid]");
  await expect(grid).toBeVisible();
  // The service worker controls the page, so it can be reopened offline.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await expect(grid).toBeVisible();
  await page.context().setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("offline")));
  await page.getByRole("button", { name: "Отметить месячные" }).click();
  const cells = grid.locator("button");
  const idx = await cells.evaluateAll((els) => els.findIndex((e) => e.getAttribute("aria-current") === "date"));
  expect(idx).toBeGreaterThan(1);
  await cells.nth(idx - 2).click();
  await expect(page.getByText(/Нет сети · ждут: 1/)).toBeVisible();
  const ymd = await page.evaluate(() => {
    const d = new Date(Date.now() - 2 * 86400000);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(d);
  });
  return ymd;
}

async function today(page: Page): Promise<string> {
  return page.evaluate(() => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Moscow" }).format(new Date()));
}

test("queued change survives an account merge done on another device", async ({ page, context }) => {
  await loginToToday(page, "merge-q@example.com");
  const day = await queueDayOffline(page);
  const before = await mockDb(page);
  const oldId = before.session!;
  expect(hasPeriodOn(before.users[oldId]!.episodes, day, await today(page))).toBe(false);

  // Meanwhile the account is merged elsewhere. The app is closed and opened
  // again (cold start: the session check runs before the queue is sent).
  const newId = await page.evaluate(() => (window as unknown as { __sanaMock: MockApi }).__sanaMock.simulateMergeElsewhere());
  expect(newId).toBeTruthy();
  await page.close();
  await context.setOffline(false);
  const app = await context.newPage();
  await app.goto("/ru/app/calendar");
  await expect(app.locator("[data-cal-grid]")).toBeVisible();

  await expect.poll(async () => {
    const db = await mockDb(app);
    return hasPeriodOn(db.users[newId!]?.episodes ?? [], day, await today(app));
  }, { timeout: 15_000 }).toBe(true);
  await expect(app.getByText(/ждут: \d/)).toHaveCount(0);
});

test("queued change of one account is never sent with another account and comes back with its owner", async ({ page, context }) => {
  await loginToToday(page, "owner-q@example.com");
  const day = await queueDayOffline(page);
  const ownerId = (await mockDb(page)).session!;

  // The session ends on the server while offline; someone else signs in on this device.
  await page.evaluate(() => (window as unknown as { __sanaMock: MockApi }).__sanaMock.expireSession());
  await context.setOffline(false);
  await page.goto("/ru/app/today");
  await page.waitForURL(/\/app\/login/);
  await login(page, "other-q@example.com");
  await page.waitForURL(/\/app\/(today|onboarding|consent)/);
  await page.waitForTimeout(1500);
  const mid = await mockDb(page);
  const otherId = mid.session!;
  expect(otherId).not.toBe(ownerId);
  expect(hasPeriodOn(mid.users[otherId]!.episodes, day, await today(page))).toBe(false);
  expect(hasPeriodOn(mid.users[ownerId]!.episodes, day, await today(page))).toBe(false);

  // The owner signs in again: her change is sent to her account.
  await logout(page);
  await loginToToday(page, "owner-q@example.com");
  await expect.poll(async () => {
    const db = await mockDb(page);
    return hasPeriodOn(db.users[ownerId]?.episodes ?? [], day, await today(page));
  }, { timeout: 15_000 }).toBe(true);
  const end = await mockDb(page);
  expect(hasPeriodOn(end.users[otherId]!.episodes, day, await today(page))).toBe(false);
});
