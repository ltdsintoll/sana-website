// Demo backend used when NEXT_PUBLIC_API_BASE_URL is not configured (or
// NEXT_PUBLIC_API_MOCK=1). It answers the same routes and shapes as the real
// API contract so the cabinet can be explored and tested without hercycle.
//
// IMPORTANT: the "cycle math" below is a crude stand-in that only exists to
// produce plausible fixtures. The real cabinet renders server-computed values.
//
// Demo accounts (code is always 123456):
//   any@email        -> history of 5 cycles, period expected in a few days
//   new@...          -> fresh account: consent + onboarding
//   period@...       -> period ongoing (day 2)
//   late@...         -> period late by 4 days
//   pregnant@...     -> pregnancy mode
//   merge...@...     -> linking Telegram answers 409 merge_required first

import type {
  CalendarDay,
  CycleResponse,
  CycleStatus,
  DayKind,
  DayLog,
  Episode,
  Me,
  NotificationSettings,
  Pregnancy,
  Symptom,
  Ymd,
} from "./types";
import { addDays, diffDays, localToday } from "../lib/dates";

type MockUser = {
  me: Me;
  version: number;
  updatedAt: string;
  settings: { cycleLength: number | null; periodLength: number | null; forceCycleLength: boolean; isIrregular: boolean; prevMode: "BASIC" | "ADVANCED" };
  episodes: Episode[];
  logs: Record<Ymd, Omit<DayLog, "hasWellbeingMarks" | "hasActivityMarks">>;
  symptoms: Symptom[];
  pregnancies: Pregnancy[];
  notifications: NotificationSettings;
};

type Db = {
  users: Record<string, MockUser>;
  session: string | null;
  polls: Record<string, { purpose: "login" | "link"; created: number; polls: number }>;
};

const LS_KEY = "sana-mock-db";
const ACTIVITY_CATS = new Set(["activity", "sex_activity", "libido"]);

function load(): Db {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw) as Db;
  } catch {
    /* ignore */
  }
  return { users: {}, session: null, polls: {} };
}

function save(db: Db) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(db));
  } catch {
    /* ignore */
  }
}

function id(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const nowIso = () => new Date().toISOString();

type Res = { status: number; body?: unknown; etag?: string };
const ok = (body: unknown, etag?: string): Res => ({ status: 200, body, etag });
const err = (status: number, error: string, message = "", details?: unknown): Res => ({
  status,
  body: { error, message, details },
});

function today(u: MockUser): Ymd {
  return localToday(u.me.timezone);
}

function seed(kind: string, email: string | null, telegram: Me["telegram"]): MockUser {
  const t = localToday();
  const me: Me = {
    id: id(),
    email,
    emailVerified: !!email,
    telegram,
    languageCode: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    gdprConsent: kind !== "new",
    mode: kind === "pregnant" ? "PREGNANCY" : "BASIC",
    hasProfile: kind !== "new",
    createdAt: addDays(t, -200) + "T10:00:00.000Z",
  };
  const u: MockUser = {
    me,
    version: 1,
    updatedAt: nowIso(),
    settings: { cycleLength: 28, periodLength: 5, forceCycleLength: false, isIrregular: false, prevMode: "BASIC" },
    episodes: [],
    logs: {},
    symptoms: [],
    pregnancies: [],
    notifications: { checkBag: true, remindMark: true, congratulate: true, pmsWarning: true, discreetMode: false },
  };
  if (kind === "new") {
    u.settings.cycleLength = null;
    u.settings.periodLength = null;
    return u;
  }
  // Last start relative to today per demo scenario.
  const lastStartOffset = kind === "period" ? -1 : kind === "late" ? -33 : kind === "pregnant" ? -60 : -24;
  const lengths = [29, 27, 30, 28, 29];
  let start = addDays(t, lastStartOffset);
  const starts: Ymd[] = [start];
  for (const L of lengths) {
    start = addDays(start, -L);
    starts.push(start);
  }
  starts.reverse();
  starts.forEach((s, i) => {
    const last = i === starts.length - 1;
    const ongoing = last && kind === "period";
    u.episodes.push({
      id: id(),
      startYmd: s,
      endYmd: ongoing ? null : addDays(s, i % 2 ? 4 : 5),
      source: "user",
      reviewReason: null,
      updatedAt: nowIso(),
    });
    u.logs[s] = { ymd: s, flow: "heavy", pain: 4, hasSex: false, sexNote: null, updatedAt: nowIso() };
    u.logs[addDays(s, 1)] = { ymd: addDays(s, 1), flow: "normal", pain: 2, hasSex: false, sexNote: null, updatedAt: nowIso() };
  });
  const y = addDays(t, -2);
  u.symptoms.push(
    { id: id(), date: y, category: "mood", key: "anxiety", value: "1", createdAt: nowIso(), updatedAt: nowIso() },
    { id: id(), date: y, category: "activity", key: "yoga", value: "1", createdAt: nowIso(), updatedAt: nowIso() },
  );
  if (kind === "pregnant") {
    u.pregnancies.push({ id: id(), startYmd: starts[starts.length - 1], dueYmd: addDays(starts[starts.length - 1], 280), endYmd: null, outcome: null });
  }
  return u;
}

function kindFromEmail(email: string): string {
  const local = email.split("@")[0].toLowerCase();
  for (const k of ["new", "period", "late", "pregnant"]) if (local.startsWith(k)) return k;
  return "regular";
}

function bump(u: MockUser) {
  u.version += 1;
  u.updatedAt = nowIso();
}

// ------------------------------------------------------------------ fake cycle math

function effEnd(e: Episode, P: number): Ymd {
  return e.endYmd ?? addDays(e.startYmd, P - 1);
}

function sorted(u: MockUser): Episode[] {
  return [...u.episodes].sort((a, b) => (a.startYmd < b.startYmd ? -1 : 1));
}

function closeExpired(u: MockUser, P: number) {
  const t = today(u);
  for (const e of u.episodes) {
    if (!e.endYmd && addDays(e.startYmd, P - 1) < t) {
      e.endYmd = addDays(e.startYmd, P - 1);
      e.source = "auto_closed";
    }
  }
}

function normalize(u: MockUser, P: number) {
  const list = sorted(u);
  const out: Episode[] = [];
  for (const e of list) {
    const prev = out[out.length - 1];
    if (prev && e.startYmd <= addDays(effEnd(prev, P), 1)) {
      const pe = effEnd(prev, P);
      const ee = effEnd(e, P);
      prev.endYmd = prev.endYmd === null || e.endYmd === null ? (ee > pe ? e.endYmd : prev.endYmd) : ee > pe ? ee : pe;
      prev.updatedAt = nowIso();
    } else out.push(e);
  }
  u.episodes = out;
}

function computeStats(u: MockUser) {
  const list = sorted(u);
  const history: CycleResponse["stats"]["history"] = [];
  for (let i = list.length - 2; i >= 0; i--) {
    const len = diffDays(list[i + 1].startYmd, list[i].startYmd);
    const pd = diffDays(effEnd(list[i], u.settings.periodLength ?? 5), list[i].startYmd) + 1;
    const excludedReason = len < 15 ? "too_short" : len > 90 ? "too_long" : null;
    history.push({ startYmd: list[i].startYmd, endYmd: addDays(list[i + 1].startYmd, -1), lengthDays: len, periodDays: pd, excluded: !!excludedReason, excludedReason });
  }
  const valid = history.filter((h) => !h.excluded).slice(0, 6);
  const avg = valid.length ? Math.round(valid.reduce((s, h) => s + h.lengthDays, 0) / valid.length) : null;
  const avgP = valid.length ? Math.round(valid.reduce((s, h) => s + h.periodDays, 0) / valid.length) : null;
  let C: number;
  let src: CycleResponse["stats"]["cycleLengthSource"];
  if (u.settings.forceCycleLength && u.settings.cycleLength) {
    C = u.settings.cycleLength;
    src = "forced";
  } else if (valid.length >= 2 && avg) {
    C = avg;
    src = "history";
  } else if (valid.length === 1 && avg && u.settings.cycleLength) {
    C = Math.round((avg + u.settings.cycleLength) / 2);
    src = "blended";
  } else if (u.settings.cycleLength) {
    C = u.settings.cycleLength;
    src = "prior";
  } else {
    C = 28;
    src = "default";
  }
  const P = valid.length >= 2 && avgP ? avgP : u.settings.periodLength ?? 5;
  const lens = valid.map((h) => h.lengthDays);
  const min = lens.length ? Math.min(...lens) : null;
  const max = lens.length ? Math.max(...lens) : null;
  return {
    cycleLength: C,
    cycleLengthSource: src,
    periodLength: P,
    periodLengthSource: (valid.length >= 2 ? "history" : u.settings.periodLength ? "prior" : "default") as CycleResponse["stats"]["periodLengthSource"],
    cyclesCount: valid.length,
    cycleLengthMin: min,
    cycleLengthMax: max,
    irregular: u.settings.isIrregular || (min !== null && max !== null && max - min > 7),
    history,
  };
}

function build(u: MockUser, from?: Ymd | null, to?: Ymd | null): CycleResponse {
  const stats = computeStats(u);
  const C = stats.cycleLength;
  const P = stats.periodLength;
  closeExpired(u, P);
  const t = today(u);
  const eps = sorted(u);
  const last = eps[eps.length - 1];
  const preg = u.pregnancies.find((p) => !p.endYmd) ?? null;

  const status: CycleStatus = {
    today: t,
    state: "no_data",
    phase: "unknown",
    cycleDay: null,
    periodDay: null,
    lastPeriodStartYmd: last?.startYmd ?? null,
    ongoingEpisodeId: null,
    expectedStartYmd: null,
    expectedWindow: null,
    daysUntilExpected: null,
    lateDays: null,
    fertileWindow: null,
    ovulationYmd: null,
    pmsWindow: null,
    confidence: stats.cyclesCount >= 3 ? "high" : stats.cyclesCount >= 1 ? "medium" : last ? "low" : "none",
    pregnancy: null,
  };
  let next: Ymd | null = null;
  if (preg) {
    const d = diffDays(t, preg.startYmd);
    status.state = "pregnancy";
    status.phase = "pregnancy";
    status.pregnancy = { startYmd: preg.startYmd, dueYmd: preg.dueYmd, week: Math.floor(d / 7), day: d % 7 };
  } else if (last) {
    status.cycleDay = diffDays(t, last.startYmd) + 1;
    next = addDays(last.startYmd, C);
    const lastEnd = effEnd(last, P);
    const ov = addDays(next, -14);
    if (t >= last.startYmd && t <= lastEnd && (last.endYmd === null || t <= last.endYmd)) {
      status.state = "period";
      status.phase = "menstrual";
      status.periodDay = diffDays(t, last.startYmd) + 1;
      status.ongoingEpisodeId = last.endYmd === null ? last.id : null;
    } else if (t <= next) {
      status.state = "expected";
      status.daysUntilExpected = diffDays(next, t);
    } else if (diffDays(t, last.startYmd) > 1.8 * C) {
      status.state = "stale";
      status.lateDays = diffDays(t, next);
      next = null;
    } else {
      status.state = "late";
      status.phase = "late";
      status.lateDays = diffDays(t, next);
    }
    if (next) {
      status.expectedStartYmd = next;
      const widen = stats.irregular ? 3 : 0;
      status.expectedWindow =
        status.state === "late"
          ? { startYmd: t, endYmd: addDays(t, P - 1) }
          : { startYmd: addDays(next, -widen), endYmd: addDays(next, P - 1 + widen) };
    }
    if (status.state === "expected" || status.state === "period") {
      status.ovulationYmd = ov;
      status.fertileWindow = { startYmd: addDays(ov, -5), endYmd: addDays(ov, 1) };
      status.pmsWindow = { startYmd: addDays(next!, -5), endYmd: addDays(next!, -1) };
      if (status.state === "expected") {
        if (t === ov) status.phase = "ovulation";
        else if (t >= status.fertileWindow.startYmd && t <= status.fertileWindow.endYmd) status.phase = "fertile";
        else if (t >= status.pmsWindow.startYmd) status.phase = "pms";
        else if (t < status.fertileWindow.startYmd) status.phase = "follicular";
        else status.phase = "luteal";
      }
    }
  }

  const range = { from: from ?? addDays(t.slice(0, 8) + "01", -92).slice(0, 8) + "01", to: to ?? addDays(t, 200) };
  const kinds = new Map<Ymd, { kind: DayKind; predicted: boolean }>();
  const put = (d: Ymd, kind: DayKind, predicted: boolean, force = false) => {
    if (force || !kinds.has(d)) kinds.set(d, { kind, predicted });
  };
  for (const e of eps) {
    const end = e.endYmd ?? (addDays(e.startYmd, P - 1) < t ? addDays(e.startYmd, P - 1) : t);
    for (let d = e.startYmd; d <= end; d = addDays(d, 1)) put(d, "period", false, true);
    if (!e.endYmd) for (let d = addDays(t, 1); d <= addDays(e.startYmd, P - 1); d = addDays(d, 1)) put(d, "period_predicted", true);
  }
  for (const l of Object.values(u.logs)) if (l.flow === "spotting") put(l.ymd, "spotting", false);
  if (preg) {
    for (let d = preg.startYmd; d <= range.to; d = addDays(d, 1)) put(d, "pregnancy", true);
  } else if (next && (status.state === "expected" || status.state === "period")) {
    for (let k = 0; k < 8; k++) {
      const s = addDays(next, k * C);
      if (s > range.to) break;
      const ov = addDays(s, -14);
      put(ov, "ovulation", true);
      for (let d = addDays(ov, -5); d <= addDays(ov, 1); d = addDays(d, 1)) put(d, "fertile", true);
      for (let d = addDays(s, -5); d < s; d = addDays(d, 1)) put(d, "pms", true);
      for (let i = 0; i < P; i++) {
        const d = addDays(s, i);
        const ex = kinds.get(d);
        if (!ex || ex.predicted) kinds.set(d, { kind: "period_predicted", predicted: true });
      }
    }
  }
  const days: CalendarDay[] = [];
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    const k = kinds.get(d);
    days.push({ ymd: d, kind: k?.kind ?? "none", predicted: k?.predicted ?? false });
  }

  const dates = new Set<Ymd>([...Object.keys(u.logs), ...u.symptoms.map((s) => s.date)]);
  const dayLogs: DayLog[] = [...dates].sort().map((d) => {
    const l = u.logs[d];
    const syms = u.symptoms.filter((s) => s.date === d && s.value);
    return {
      ymd: d,
      flow: l?.flow ?? null,
      pain: l?.pain ?? null,
      hasSex: l?.hasSex ?? false,
      sexNote: l?.sexNote ?? null,
      hasWellbeingMarks: syms.some((s) => !ACTIVITY_CATS.has(s.category)),
      hasActivityMarks: syms.some((s) => ACTIVITY_CATS.has(s.category)) || !!l?.hasSex,
      updatedAt: l?.updatedAt ?? null,
    };
  });

  return {
    version: u.version,
    updatedAt: u.updatedAt,
    today: t,
    settings: { ...u.settings, mode: u.me.mode, timezone: u.me.timezone } as CycleResponse["settings"],
    episodes: eps,
    dayLogs,
    pregnancies: u.pregnancies,
    status,
    stats,
    calendar: { from: range.from, to: range.to, days },
  };
}

// ------------------------------------------------------------------ router

function parse(path: string): { p: string; q: URLSearchParams } {
  const [p, qs] = path.split("?");
  return { p, q: new URLSearchParams(qs ?? "") };
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function handle(method: string, path: string, body: unknown, headers: Record<string, string>): Promise<Res> {
  await delay(120);
  const db = load();
  const res = route(db, method, path, (body ?? {}) as Record<string, unknown>, headers);
  save(db);
  return res;
}

function route(db: Db, method: string, path: string, b: Record<string, unknown>, headers: Record<string, string>): Res {
  const { p, q } = parse(path);
  const u = db.session ? db.users[db.session] : undefined;
  const M = `${method} ${p}`;
  if (u && headers["X-Timezone"] && u.me.timezone !== headers["X-Timezone"]) u.me.timezone = headers["X-Timezone"];

  // --- auth without session
  if (M === "GET /api/auth/config") return ok({ telegramBotUsername: "HerCycleBot", telegramWidgetEnabled: true, emailLoginEnabled: true });
  if (M === "POST /api/auth/email/request" || M === "POST /api/auth/link/email/request") {
    if (M.includes("link") && !u) return err(401, "unauthorized");
    return ok({ ok: true, expiresInSec: 600, resendAfterSec: 30 });
  }
  if (M === "POST /api/auth/email/verify") {
    const email = String(b.email ?? "").toLowerCase();
    if (b.code !== "123456") return err(400, "invalid_code", "Wrong code");
    let user = Object.values(db.users).find((x) => x.me.email === email);
    const created = !user;
    if (!user) {
      user = seed(kindFromEmail(email), email, null);
      db.users[user.me.id] = user;
    }
    db.session = user.me.id;
    return ok({ user: user.me, created });
  }
  if (M === "POST /api/auth/telegram/widget") {
    let user = Object.values(db.users).find((x) => x.me.telegram?.id === String(b.id));
    const created = !user;
    if (!user) {
      user = seed("regular", null, { id: String(b.id), username: (b.username as string) ?? null, firstName: (b.first_name as string) ?? "Anna", lastName: null, photoUrl: null });
      db.users[user.me.id] = user;
    }
    db.session = user.me.id;
    return ok({ user: user.me, created });
  }
  if (M === "POST /api/auth/telegram/start") {
    const purpose = b.purpose === "link" ? "link" : "login";
    if (purpose === "link" && !u) return err(401, "unauthorized");
    const token = id();
    db.polls[token] = { purpose, created: Date.now(), polls: 0 };
    return ok({ pollToken: token, botUrl: `https://t.me/HerCycleBot?start=${purpose}_${token}`, expiresAt: new Date(Date.now() + 600_000).toISOString(), pollIntervalMs: 1500 });
  }
  if (M === "POST /api/auth/telegram/poll") {
    const pl = db.polls[String(b.pollToken)];
    if (!pl) return ok({ status: "expired" });
    pl.polls += 1;
    if (Date.now() - pl.created < 2500) return ok({ status: "pending" });
    if (pl.purpose === "login") {
      let user = Object.values(db.users).find((x) => x.me.telegram?.id === "100200300");
      if (!user) {
        user = seed("regular", null, { id: "100200300", username: "anna", firstName: "Anna", lastName: null, photoUrl: null });
        db.users[user.me.id] = user;
      }
      db.session = user.me.id;
      delete db.polls[String(b.pollToken)];
      return ok({ status: "confirmed", user: user.me });
    }
    if (!u) return err(401, "unauthorized");
    if (u.me.email?.startsWith("merge") && !b.merge)
      return err(409, "merge_required", "Telegram already has an account", { other: { hasTelegram: true, hasEmail: false, periods: 7, createdAt: "2026-04-18T10:00:00.000Z" } });
    u.me.telegram = { id: "900800700", username: "anna_tg", firstName: "Anna", lastName: null, photoUrl: null };
    bump(u);
    delete db.polls[String(b.pollToken)];
    return ok({ status: "confirmed", user: u.me });
  }

  if (!u) return err(401, "unauthorized", "No session");

  if (M === "GET /api/auth/session") return ok({ user: u.me });
  if (M === "POST /api/auth/logout") {
    db.session = null;
    return { status: 204 };
  }
  if (M === "POST /api/auth/logout-all") {
    db.session = null;
    return { status: 204 };
  }
  if (M === "POST /api/auth/link/email/verify") {
    if (b.code !== "123456") return err(400, "invalid_code");
    const email = String(b.email).toLowerCase();
    if (email.startsWith("merge") && !b.merge)
      return err(409, "merge_required", "Email already has an account", { other: { hasTelegram: false, hasEmail: true, periods: 3, createdAt: "2026-09-01T10:00:00.000Z" } });
    u.me.email = email;
    u.me.emailVerified = true;
    bump(u);
    return ok({ user: u.me, merged: !!b.merge });
  }
  if (M === "POST /api/auth/link/telegram/widget") {
    u.me.telegram = { id: String(b.id), username: (b.username as string) ?? null, firstName: (b.first_name as string) ?? null, lastName: null, photoUrl: null };
    bump(u);
    return ok({ user: u.me, merged: false });
  }
  if (M === "PATCH /api/v2/me") {
    if (typeof b.languageCode === "string") u.me.languageCode = b.languageCode;
    if (typeof b.timezone === "string") u.me.timezone = b.timezone;
    return ok({ user: u.me });
  }
  if (M === "POST /api/gdpr/accept") {
    u.me.gdprConsent = true;
    return ok({ ok: true });
  }
  if (M === "POST /api/gdpr/delete-account") {
    delete db.users[u.me.id];
    db.session = null;
    return { status: 204 };
  }
  if (M === "GET /api/notifications") return ok(u.notifications);
  if (M === "PUT /api/notifications") {
    u.notifications = { ...u.notifications, ...(b as Partial<NotificationSettings>) };
    return ok(u.notifications);
  }
  if (M === "GET /api/v2/sync/version") return ok({ version: u.version, updatedAt: u.updatedAt });

  const from = q.get("from");
  const to = q.get("to");
  const state = () => build(u, from, to);
  const t = today(u);
  const P = () => computeStats(u).periodLength;

  if (M === "GET /api/v2/cycle") {
    const s = state();
    const etag = `"v${s.version}-${s.today}"`;
    if (headers["If-None-Match"] === etag) return { status: 304, etag };
    return ok(s, etag);
  }
  if (M === "GET /api/v2/cycle/status") {
    const s = state();
    return ok({ version: s.version, today: s.today, status: s.status, stats: s.stats });
  }

  if (M === "POST /api/v2/periods/start") {
    const date = String(b.date);
    if (date > t) return err(422, "future_date", "Date is in the future");
    const eps = sorted(u);
    const near = eps.find((e) => date >= addDays(e.startYmd, -2) && date <= addDays(effEnd(e, P()), 2));
    if (near) {
      if (date < near.startYmd) near.startYmd = date;
      near.updatedAt = nowIso();
    } else {
      const prev = [...eps].reverse().find((e) => e.startYmd < date);
      if (prev && diffDays(date, prev.startYmd) < 15 && !b.as)
        return err(409, "needs_confirmation", "Too close to the previous start", { previousStartYmd: prev.startYmd, options: ["continuation", "spotting", "new_cycle"] });
      if (b.as === "continuation" && prev) prev.endYmd = date;
      else if (b.as === "spotting") u.logs[date] = { ...(u.logs[date] ?? { ymd: date, pain: null, hasSex: false, sexNote: null }), flow: "spotting", updatedAt: nowIso() };
      else {
        for (const e of eps) if (!e.endYmd && e.startYmd < date) e.endYmd = addDays(date, -1) < effEnd(e, P()) ? addDays(date, -1) : effEnd(e, P());
        u.episodes.push({ id: id(), startYmd: date, endYmd: date < addDays(t, -(P() - 1)) ? addDays(date, P() - 1) : null, source: "user", reviewReason: null, updatedAt: nowIso() });
      }
    }
    normalize(u, P());
    bump(u);
    return ok(state());
  }
  if (M === "POST /api/v2/periods/end") {
    const date = String(b.date);
    if (date > t) return err(422, "future_date");
    const e = [...sorted(u)].reverse().find((x) => x.startYmd <= date);
    if (!e) return err(404, "not_found");
    e.endYmd = date;
    e.updatedAt = nowIso();
    bump(u);
    return ok(state());
  }
  const mPeriod = p.match(/^\/api\/v2\/periods\/([^/]+)$/);
  if (mPeriod && method === "PATCH") {
    const e = u.episodes.find((x) => x.id === decodeURIComponent(mPeriod[1]));
    if (!e) return err(404, "not_found");
    if (typeof b.startYmd === "string") e.startYmd = b.startYmd;
    if (b.endYmd !== undefined) e.endYmd = b.endYmd as Ymd | null;
    if ((e.endYmd && e.endYmd > t) || e.startYmd > t) return err(422, "future_date");
    e.updatedAt = nowIso();
    normalize(u, P());
    bump(u);
    return ok(state());
  }
  if (mPeriod && method === "DELETE") {
    u.episodes = u.episodes.filter((x) => x.id !== decodeURIComponent(mPeriod[1]));
    bump(u);
    return ok(state());
  }
  const mDayPeriod = p.match(/^\/api\/v2\/days\/(\d{4}-\d{2}-\d{2})\/period$/);
  if (mDayPeriod && method === "PUT") {
    const d = mDayPeriod[1];
    if (d > t) return err(422, "future_date");
    const pl = P();
    const inside = u.episodes.find((e) => d >= e.startYmd && d <= (e.endYmd ?? (addDays(e.startYmd, pl - 1) < t ? addDays(e.startYmd, pl - 1) : t)));
    if (b.isPeriod) {
      if (!inside) {
        const adj = u.episodes.find((e) => e.endYmd && addDays(e.endYmd, 1) === d) ?? u.episodes.find((e) => addDays(e.startYmd, -1) === d);
        if (adj) {
          if (adj.endYmd && addDays(adj.endYmd, 1) === d) adj.endYmd = d;
          else adj.startYmd = d;
          adj.updatedAt = nowIso();
        } else {
          u.episodes.push({ id: id(), startYmd: d, endYmd: d === t ? null : d, source: "user", reviewReason: null, updatedAt: nowIso() });
        }
      }
    } else if (inside) {
      const end = inside.endYmd ?? t;
      if (inside.startYmd === d && end === d) u.episodes = u.episodes.filter((e) => e !== inside);
      else if (inside.startYmd === d) inside.startYmd = addDays(d, 1);
      else if (end === d || !inside.endYmd) inside.endYmd = addDays(d, -1);
      else {
        u.episodes.push({ id: id(), startYmd: addDays(d, 1), endYmd: inside.endYmd, source: "user", reviewReason: null, updatedAt: nowIso() });
        inside.endYmd = addDays(d, -1);
      }
      inside.updatedAt = nowIso();
    }
    normalize(u, pl);
    bump(u);
    return ok(state());
  }
  const mDay = p.match(/^\/api\/v2\/days\/(\d{4}-\d{2}-\d{2})$/);
  if (mDay && method === "PUT") {
    const d = mDay[1];
    if (d > t) return err(422, "future_date");
    const cur = u.logs[d] ?? { ymd: d, flow: null, pain: null, hasSex: false, sexNote: null, updatedAt: null };
    u.logs[d] = { ...cur, ...(b as object), ymd: d, updatedAt: nowIso() };
    bump(u);
    return ok(state());
  }
  if (mDay && method === "DELETE") {
    delete u.logs[mDay[1]];
    bump(u);
    return ok(state());
  }
  if (M === "PUT /api/v2/settings") {
    u.settings = { ...u.settings, ...(b as object) };
    bump(u);
    return ok(state());
  }
  if (M === "POST /api/v2/onboarding") {
    if (typeof b.cycleLength === "number") u.settings.cycleLength = b.cycleLength;
    if (typeof b.periodLength === "number") u.settings.periodLength = b.periodLength;
    if (typeof b.lastPeriodStartYmd === "string") {
      if (b.lastPeriodStartYmd > t) return err(422, "future_date");
      const pl = u.settings.periodLength ?? 5;
      const s = b.lastPeriodStartYmd;
      u.episodes.push({ id: id(), startYmd: s, endYmd: addDays(s, pl - 1) < t ? addDays(s, pl - 1) : null, source: "user", reviewReason: null, updatedAt: nowIso() });
    }
    u.me.hasProfile = true;
    bump(u);
    return ok(state());
  }
  if (M === "POST /api/v2/pregnancy") {
    const last = sorted(u).pop();
    const start = (b.startYmd as string) ?? last?.startYmd ?? t;
    u.pregnancies.push({ id: id(), startYmd: start, dueYmd: (b.dueYmd as string) ?? addDays(start, 280), endYmd: null, outcome: null });
    if (u.me.mode !== "PREGNANCY") u.settings.prevMode = u.me.mode;
    u.me.mode = "PREGNANCY";
    bump(u);
    return ok(state());
  }
  if (M === "POST /api/v2/pregnancy/end") {
    const pr = u.pregnancies.find((x) => !x.endYmd);
    if (pr) {
      pr.endYmd = (b.endYmd as string) ?? t;
      pr.outcome = (b.outcome as string) ?? null;
    }
    u.me.mode = u.settings.prevMode;
    bump(u);
    return ok(state());
  }

  if (M === "GET /api/symptoms") return ok({ symptoms: u.symptoms.filter((s) => s.date === q.get("date")) });
  if (M === "GET /api/symptoms/range")
    return ok({ symptoms: u.symptoms.filter((s) => s.date >= (q.get("from") ?? "") && s.date <= (q.get("to") ?? "")) });
  if (M === "POST /api/symptoms") {
    const date = String(b.date);
    let s = u.symptoms.find((x) => x.date === date && x.category === b.category && x.key === b.key);
    if (s) {
      s.value = (b.value as string | null) ?? null;
      s.updatedAt = nowIso();
    } else {
      s = { id: id(), date, category: String(b.category), key: String(b.key), value: (b.value as string | null) ?? null, createdAt: nowIso(), updatedAt: nowIso() };
      u.symptoms.push(s);
    }
    bump(u);
    return ok({ symptom: s });
  }
  const mSym = p.match(/^\/api\/symptoms\/([^/]+)$/);
  if (mSym && method === "DELETE") {
    u.symptoms = u.symptoms.filter((s) => s.id !== decodeURIComponent(mSym[1]));
    bump(u);
    return ok({ ok: true });
  }
  return err(404, "not_found", `${M} is not mocked`);
}

/** Lets demo/tests simulate a change made in Telegram (bumps dataVersion). */
export function simulateRemoteChange(): void {
  const db = load();
  const u = db.session ? db.users[db.session] : undefined;
  if (!u) return;
  const d = addDays(localToday(u.me.timezone), -1);
  u.symptoms.push({ id: id(), date: d, category: "other", key: "stress", value: "1", createdAt: nowIso(), updatedAt: nowIso() });
  bump(u);
  save(db);
}
