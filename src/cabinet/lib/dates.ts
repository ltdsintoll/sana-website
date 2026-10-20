// Calendar-day helpers for display only (YMD strings, UTC math so no DST drift).
// No cycle calculations live here: all predictions come from the API.

import type { Ymd } from "../api/types";

export function parseYmd(ymd: Ymd): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

export function toYmd(d: Date): Ymd {
  return d.toISOString().slice(0, 10);
}

export function addDays(ymd: Ymd, n: number): Ymd {
  const d = parseYmd(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return toYmd(d);
}

export function diffDays(a: Ymd, b: Ymd): number {
  return Math.round((parseYmd(a).getTime() - parseYmd(b).getTime()) / 86400000);
}

export function isYmd(s: unknown): s is Ymd {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

/** Today in the given IANA zone (falls back to the browser zone). */
export function localToday(timeZone?: string | null): Ymd {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone ?? undefined,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
}

export type MonthKey = { y: number; m: number }; // m: 0..11

export function monthOf(ymd: Ymd): MonthKey {
  const d = parseYmd(ymd);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
}

export function shiftMonth(k: MonthKey, n: number): MonthKey {
  const t = k.y * 12 + k.m + n;
  return { y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 };
}

export function monthStart(k: MonthKey): Ymd {
  return toYmd(new Date(Date.UTC(k.y, k.m, 1)));
}

export function monthEnd(k: MonthKey): Ymd {
  return toYmd(new Date(Date.UTC(k.y, k.m + 1, 0)));
}

/** Monday-first for most locales, Sunday-first for English (US habit). */
export function weekStartsOn(locale: string): 0 | 1 {
  return locale === "en" ? 0 : 1;
}

/** 6x7 grid of YMDs (null outside the month) for a month view. */
export function monthGrid(k: MonthKey, firstDow: 0 | 1): Array<Ymd | null> {
  const start = parseYmd(monthStart(k));
  const lead = (start.getUTCDay() - firstDow + 7) % 7;
  const days = parseYmd(monthEnd(k)).getUTCDate();
  const cells: Array<Ymd | null> = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(toYmd(new Date(Date.UTC(k.y, k.m, d))));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function weekdayLabels(locale: string, firstDow: 0 | 1): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  // 2024-01-07 is a Sunday.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 7 + firstDow + i))));
}

export function fmtDate(ymd: Ymd, locale: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }): string {
  return new Intl.DateTimeFormat(locale, { ...opts, timeZone: "UTC" }).format(parseYmd(ymd));
}

export function fmtMonth(k: MonthKey, locale: string): string {
  const s = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(k.y, k.m, 1)),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fmtRange(a: Ymd, b: Ymd, locale: string): string {
  if (a === b) return fmtDate(a, locale);
  try {
    const f = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", timeZone: "UTC" });
    return f.formatRange(parseYmd(a), parseYmd(b));
  } catch {
    return `${fmtDate(a, locale, { day: "numeric", month: "short" })} – ${fmtDate(b, locale, { day: "numeric", month: "short" })}`;
  }
}

/** Default API window: 1st of the month 3 months ago .. end of the month 6 months ahead. */
export function defaultRange(today: Ymd): { from: Ymd; to: Ymd } {
  const k = monthOf(today);
  return { from: monthStart(shiftMonth(k, -3)), to: monthEnd(shiftMonth(k, 6)) };
}
