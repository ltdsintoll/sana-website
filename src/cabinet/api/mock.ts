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
//   partner...@...   -> already sees the cycle of a demo partner ("Anna")
//   locked...@...    -> email verify answers 429 too_many_attempts (lockout)
//   noconsent...@... -> has data but never accepted the GDPR consent (v1.3):
//                       writes answer 403 consent_required until accepted
//   reconsent...@... -> accepted an older policy version (v1.4): asked again

import type {
  CalendarDay,
  Consent,
  CycleResponse,
  CycleStatus,
  DayKind,
  DayLog,
  Episode,
  Me,
  NotificationSettings,
  OwnerPartnerLink,
  PartnerAdvice,
  PartnerDayType,
  PartnerPermissions,
  PartnerView,
  PushDevice,
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
  push?: Array<PushDevice & { endpoint: string }>;
};

type MockLink = {
  uuid: string;
  ownerId: string;
  label: string | null;
  createdAt: string;
  partnerUserId: string | null;
  acceptedAt: string | null;
  permissions: PartnerPermissions;
  nudges: number[];
};

type Db = {
  users: Record<string, MockUser>;
  session: string | null;
  polls: Record<string, { purpose: "login" | "link"; created: number; polls: number }>;
  links?: Record<string, MockLink>;
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
    gdprConsent: kind !== "new" && kind !== "noconsent",
    consent:
      kind === "reconsent"
        ? { ...consentState(true), version: "2026-04-01", currentVersion: CONSENT_VERSION, needsReconsent: true }
        : consentState(kind !== "new" && kind !== "noconsent"),
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
    notifications: {
      checkBag: true,
      remindMark: true,
      congratulate: true,
      pmsWarning: true,
      discreetMode: false,
      channelTelegram: true,
      channelWebPush: true,
      emailLateReminders: false,
    },
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

const CONSENT_VERSION = "2026-10-20";

function consentState(accepted: boolean): Consent {
  return { accepted, acceptedAt: accepted ? nowIso() : null, version: accepted ? CONSENT_VERSION : null, currentVersion: CONSENT_VERSION, needsReconsent: false, withdrawnAt: null };
}

/** v1.3 (contract 12): POST/PUT/PATCH that store health data need consent. */
function needsConsent(method: string, p: string): boolean {
  if (method !== "POST" && method !== "PUT" && method !== "PATCH") return false;
  return /^\/api\/v2\/(periods|days|onboarding|pregnancy|settings|partners)(\/|$)/.test(p) || /^\/api\/symptoms(\/|$)/.test(p);
}

function hasConsented(u: MockUser): boolean {
  return u.me.consent ? u.me.consent.accepted && !u.me.consent.needsReconsent : u.me.gdprConsent;
}

function kindFromEmail(email: string): string {
  const local = email.split("@")[0].toLowerCase();
  for (const k of ["new", "period", "late", "pregnant", "partner", "noconsent", "reconsent"]) if (local.startsWith(k)) return k;
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
  if (M === "GET /api/auth/config")
    return ok({ telegramBotUsername: "HerCycleBot", telegramWidgetEnabled: true, emailLoginEnabled: true, webPushEnabled: true, vapidPublicKey: DEMO_VAPID });
  if (M === "POST /api/auth/email/request" || M === "POST /api/auth/link/email/request") {
    if (M.includes("link") && !u) return err(401, "unauthorized");
    return ok({ ok: true, expiresInSec: 600, resendAfterSec: 30 });
  }
  if (M === "POST /api/auth/email/verify") {
    const email = String(b.email ?? "").toLowerCase();
    if (email.startsWith("locked")) return err(429, "too_many_attempts", "Too many wrong codes", { retryAfterSec: 1800 });
    if (b.code !== "123456") return err(400, "invalid_code", "Wrong code");
    let user = Object.values(db.users).find((x) => x.me.email === email);
    const created = !user;
    if (!user) {
      const kind = kindFromEmail(email);
      user = seed(kind === "partner" ? "new" : kind, email, null);
      db.users[user.me.id] = user;
      if (kind === "partner") seedPartnerOf(db, user);
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
    if (typeof b.pushEndpoint === "string") u.push = (u.push ?? []).filter((d) => d.endpoint !== b.pushEndpoint);
    db.session = null;
    return { status: 204 };
  }
  if (M === "POST /api/auth/logout-all") {
    u.push = [];
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
  if (M === "POST /api/gdpr/accept" || M === "POST /api/v2/consent") {
    if (M === "POST /api/v2/consent" && b.accepted !== true) return err(400, "validation_error", "accepted must be true");
    u.me.gdprConsent = true;
    u.me.consent = consentState(true);
    return ok(M === "POST /api/v2/consent" ? { consent: u.me.consent } : { ok: true, consent: u.me.consent });
  }
  if (M === "GET /api/v2/consent") return ok({ consent: u.me.consent ?? consentState(u.me.gdprConsent) });
  if (M === "POST /api/v2/consent/withdraw") {
    u.me.gdprConsent = false;
    u.me.consent = { ...(u.me.consent ?? consentState(false)), accepted: false, needsReconsent: false, withdrawnAt: nowIso() };
    return ok({ consent: u.me.consent });
  }
  if (M === "GET /api/v2/export") {
    return ok({
      format: "sana-export",
      formatVersion: 1,
      exportedAt: nowIso(),
      account: { id: u.me.id, email: u.me.email, telegram: u.me.telegram, timezone: u.me.timezone },
      consent: u.me.consent,
      periods: sorted(u).map((e) => ({ startYmd: e.startYmd, endYmd: e.endYmd, source: e.source })),
      dayLogs: Object.values(u.logs),
      symptoms: u.symptoms,
      pregnancies: u.pregnancies,
      notifications: u.notifications,
    });
  }
  if (needsConsent(method, p) && !hasConsented(u)) return err(403, "consent_required", "Accept the privacy policy first");
  if (M === "POST /api/gdpr/delete-account") {
    delete db.users[u.me.id];
    db.session = null;
    return { status: 204 };
  }
  if (M === "GET /api/notifications") return ok(notifications(u));
  if (M === "PUT /api/notifications") {
    if (b.emailLateReminders === true && !(u.me.email && u.me.emailVerified)) return err(409, "email_required", "Add and verify an email first");
    const { available: _a, isDefault: _d, ...patch } = b as Partial<NotificationSettings>;
    void _a;
    void _d;
    u.notifications = { ...u.notifications, ...patch };
    return ok(notifications(u));
  }

  const pushRes = routePush(u, M, p, b);
  if (pushRes) return pushRes;
  const partnerRes = routePartners(db, u, M, p, b, q);
  if (partnerRes) return partnerRes;
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
          // Like the server (cycle-core togglePeriodDay): a lone day near another start, else a period of the usual length.
          const near = u.episodes.some((e) => Math.abs(diffDays(e.startYmd, d)) < 15);
          const autoEnd = addDays(d, pl - 1);
          const end = near ? d : autoEnd >= t ? null : autoEnd;
          u.episodes.push({ id: id(), startYmd: d, endYmd: end, source: "user", reviewReason: null, updatedAt: nowIso() });
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

// ------------------------------------------------------------------ v1.2: notifications, push, partners

/** A syntactically valid P-256 public key (65 bytes, base64url). Demo only. */
const DEMO_VAPID = "BOl3wGiz8nB0tDZ6S0bbmnB1tQ2yE6E5mJ0Vf5bH6mH0f6x0f8m1kE2b8z1p4nq3l2bM9K4hY5i9D6pJ8n7cQ1A";

function notifications(u: MockUser): NotificationSettings {
  const n = u.notifications;
  return {
    channelTelegram: true,
    channelWebPush: true,
    emailLateReminders: false,
    ...n,
    available: {
      telegram: !!u.me.telegram,
      telegramBlocked: false,
      webPushEnabled: true,
      webPushDevices: (u.push ?? []).length,
      email: !!u.me.email && u.me.emailVerified,
    },
  };
}

function routePush(u: MockUser, M: string, p: string, b: Record<string, unknown>): Res | null {
  const list = () => (u.push ??= []);
  const pub = (d: PushDevice & { endpoint: string }, current = false): PushDevice => {
    const { endpoint: _e, ...rest } = d;
    void _e;
    return { ...rest, current };
  };
  if (M === "GET /api/v2/push/config") return ok({ webPushEnabled: true, vapidPublicKey: DEMO_VAPID });
  if (M === "GET /api/v2/push/subscriptions") return ok({ webPushEnabled: true, subscriptions: [...list()].reverse().map((d) => pub(d)) });
  if (M === "POST /api/v2/push/subscriptions") {
    const sub = b.subscription as { endpoint?: string } | undefined;
    const endpoint = String(sub?.endpoint ?? "");
    if (!endpoint.startsWith("https://fcm.googleapis.com/")) return err(400, "invalid_push_endpoint");
    const existing = list().find((d) => d.endpoint === endpoint);
    if (existing) {
      if (typeof b.deviceLabel === "string") existing.deviceLabel = b.deviceLabel;
      return ok({ subscription: pub(existing, true) });
    }
    const d = {
      id: crypto.randomUUID(),
      endpoint,
      deviceLabel: typeof b.deviceLabel === "string" ? b.deviceLabel : null,
      userAgent: navigator.userAgent.slice(0, 120),
      endpointHost: "fcm.googleapis.com",
      createdAt: nowIso(),
      lastSuccessAt: null,
      expirationTime: null,
      current: false,
    };
    list().push(d);
    if (list().length > 10) list().shift();
    return { status: 201, body: { subscription: pub(d, true) } };
  }
  const mDev = p.match(/^\/api\/v2\/push\/subscriptions\/([^/]+)$/);
  if (mDev && M.startsWith("DELETE ")) {
    const before = list().length;
    u.push = list().filter((d) => d.id !== decodeURIComponent(mDev[1]));
    return u.push.length === before ? err(404, "not_found") : { status: 204 };
  }
  if (M === "POST /api/v2/push/unsubscribe") {
    u.push = list().filter((d) => d.endpoint !== b.endpoint);
    return { status: 204 };
  }
  if (M === "POST /api/v2/push/test") {
    const n = b.subscriptionId ? list().filter((d) => d.id === b.subscriptionId).length : list().length;
    for (const d of list()) if (!b.subscriptionId || d.id === b.subscriptionId) d.lastSuccessAt = nowIso();
    return ok({ sent: n, removed: 0 });
  }
  return null;
}

const DEFAULT_PERMS: PartnerPermissions = {
  showPeriod: true,
  showFertile: false,
  showPms: true,
  viewPhase: true,
  showSexFreq: false,
  showSleep: false,
  showHeartRate: false,
  showMood: false,
  partnerNotifPms: true,
  partnerAdviceEnabled: true,
  partnerPhaseNotifications: true,
  partnerAdviceCategories: ["care", "activity", "food", "mood", "intimacy"],
};

function linkJson(db: Db, l: MockLink): OwnerPartnerLink {
  const p = l.partnerUserId ? db.users[l.partnerUserId] : undefined;
  const base = typeof location !== "undefined" ? location.origin : "https://sanacycle.com";
  return {
    partnerUuid: l.uuid,
    label: l.label,
    shareUrl: `https://t.me/HerCycleBot/calendar?startapp=partner_id_${l.uuid}`,
    webShareUrl: `${base}/app/partner/accept?invite=${l.uuid}`,
    accepted: !!l.partnerUserId,
    createdAt: l.createdAt,
    acceptedAt: l.acceptedAt,
    partner: p ? { firstName: p.me.telegram?.firstName ?? p.me.email?.split("@")[0] ?? null, photoUrl: null, username: p.me.telegram?.username ?? null } : null,
    permissions: l.permissions,
  };
}

function ownerName(o: MockUser): string {
  return o.me.telegram?.firstName ?? (o.me.email ? o.me.email.split("@")[0].replace(/^\w/, (c) => c.toUpperCase()) : "Sana");
}

function partnerView(db: Db, l: MockLink): PartnerView {
  const o = db.users[l.ownerId];
  const c = build(o);
  const pr = l.permissions;
  const s = c.status;
  const kindOf = (d: Ymd): PartnerDayType => {
    const k = c.calendar.days.find((x) => x.ymd === d)?.kind;
    if ((k === "period" || k === "period_predicted") && pr.showPeriod) return k;
    if ((k === "fertile" || k === "ovulation") && pr.showFertile) return "fertile";
    if (k === "pms" && pr.showPms) return "pms";
    return null;
  };
  const month = (m: string) => {
    const out: PartnerView["monthDays"] = [];
    for (let d = `${m}-01`; d.startsWith(m); d = addDays(d, 1)) out.push({ date: d, type: kindOf(d) });
    return out;
  };
  const t = c.today;
  const thisMonth = t.slice(0, 7);
  const prevMonth = addDays(`${thisMonth}-01`, -1).slice(0, 7);
  const tk = kindOf(t);
  const sharingPaused = !hasConsented(o) && !!o.me.consent?.withdrawnAt;
  if (sharingPaused) {
    return {
      sharingPaused: true,
      partnerConsent: { acceptedAt: nowIso(), version: CONSENT_VERSION, current: true },
      today: t,
      dayType: "nothing",
      daysUntilPeriod: null,
      cycleState: "hidden",
      lateDays: null,
      ongoingPeriod: null,
      ownerName: ownerName(o),
      ownerPhotoUrl: null,
      ownerIrregular: false,
      permissions: pr,
      sexDotsThisMonth: [],
      sexDotsLastMonth: [],
      monthDays: [],
      prevMonthDays: [],
    };
  }
  const paused = s.state === "pregnancy";
  const cycleState: PartnerView["cycleState"] = paused
    ? "paused"
    : !pr.showPeriod
      ? "hidden"
      : s.state === "pregnancy"
        ? "paused"
        : (s.state as PartnerView["cycleState"]);
  return {
    sharingPaused: false,
    partnerConsent: { acceptedAt: nowIso(), version: CONSENT_VERSION, current: true },
    today: t,
    dayType: paused ? "nothing" : tk === "period" ? "period" : tk === "fertile" ? "fertile" : tk === "pms" ? "pms" : s.state === "expected" || s.state === "period" ? "safe" : "nothing",
    daysUntilPeriod: pr.showPeriod && s.state === "expected" ? s.daysUntilExpected : null,
    cycleState,
    lateDays: pr.showPeriod && s.state === "late" ? s.lateDays : null,
    ongoingPeriod: pr.showPeriod && s.state === "period" ? { dayIndex: s.periodDay ?? 1, suggestedTotal: c.stats.periodLength } : null,
    ownerName: ownerName(o),
    ownerPhotoUrl: null,
    ownerIrregular: c.stats.irregular,
    permissions: pr,
    sexDotsThisMonth: [],
    sexDotsLastMonth: [],
    monthDays: paused ? [] : month(thisMonth),
    prevMonthDays: paused ? [] : month(prevMonth),
  };
}

const ADVICE: Record<string, Record<string, string>> = {
  en: {
    menstrual: "Offer a warm drink and take one chore off her list today.",
    follicular: "Energy is usually higher now: a good week for a plan together.",
    fertile: "A good day for a walk together or something new.",
    pms: "Be extra patient today, a small surprise goes a long way.",
    other: "Ask how she feels today and really listen.",
  },
  ru: {
    menstrual: "Предложите тёплый чай и возьмите на себя одно дело по дому.",
    follicular: "Сейчас обычно больше энергии: хорошая неделя для совместных планов.",
    fertile: "Хороший день для прогулки вдвоём или чего-то нового.",
    pms: "Сегодня особенно важно терпение. Маленький сюрприз очень кстати.",
    other: "Спросите, как она себя чувствует, и просто выслушайте.",
  },
  uk: {
    menstrual: "Запропонуйте теплий чай і візьміть на себе одну хатню справу.",
    follicular: "Зараз зазвичай більше енергії: гарний тиждень для спільних планів.",
    fertile: "Гарний день для прогулянки удвох чи чогось нового.",
    pms: "Сьогодні особливо важливе терпіння. Маленький сюрприз дуже доречний.",
    other: "Запитайте, як вона почувається, і просто вислухайте.",
  },
  es: {
    menstrual: "Ofrécele una bebida caliente y encárgate hoy de una tarea de casa.",
    follicular: "Ahora suele haber más energía: buena semana para hacer planes juntos.",
    fertile: "Buen día para un paseo juntos o algo nuevo.",
    pms: "Hoy ten paciencia extra; una pequeña sorpresa ayuda mucho.",
    other: "Pregúntale cómo se siente hoy y escucha de verdad.",
  },
};

function seedPartnerOf(db: Db, partner: MockUser) {
  const owner = seed("regular", "anna.demo@example.com", { id: "555000111", username: "anna_demo", firstName: "Anna", lastName: null, photoUrl: null });
  db.users[owner.me.id] = owner;
  const uuid = crypto.randomUUID();
  (db.links ??= {})[uuid] = {
    uuid,
    ownerId: owner.me.id,
    label: null,
    createdAt: nowIso(),
    partnerUserId: partner.me.id,
    acceptedAt: nowIso(),
    permissions: { ...DEFAULT_PERMS, showFertile: true },
    nudges: [],
  };
}

function routePartners(db: Db, u: MockUser, M: string, p: string, b: Record<string, unknown>, q: URLSearchParams): Res | null {
  const links = (db.links ??= {});
  const mine = () => Object.values(links).filter((l) => l.ownerId === u.me.id).sort((a, c) => (a.createdAt < c.createdAt ? -1 : 1));
  if (M === "GET /api/v2/partners") return ok({ links: mine().map((l) => linkJson(db, l)) });
  if (M === "POST /api/v2/partners") {
    if (mine().length >= 5) return err(409, "limit_reached", "Max 5 active invites");
    const label = typeof b.label === "string" ? b.label.trim().slice(0, 60) || null : null;
    const l: MockLink = { uuid: crypto.randomUUID(), ownerId: u.me.id, label, createdAt: nowIso(), partnerUserId: null, acceptedAt: null, permissions: { ...DEFAULT_PERMS }, nudges: [] };
    links[l.uuid] = l;
    return { status: 201, body: { link: linkJson(db, l) } };
  }
  const mOwn = p.match(/^\/api\/v2\/partners\/([^/]+)$/);
  if (mOwn) {
    const l = links[decodeURIComponent(mOwn[1])];
    if (!l || l.ownerId !== u.me.id) return err(404, "not_found");
    if (M.startsWith("PATCH ")) {
      if (b.label !== undefined) l.label = typeof b.label === "string" ? b.label.trim().slice(0, 60) || null : null;
      if (b.permissions && typeof b.permissions === "object") {
        for (const [k, v] of Object.entries(b.permissions as Record<string, unknown>)) {
          if (!(k in DEFAULT_PERMS) || typeof v !== "boolean" || k.startsWith("partnerAdvice") || k === "partnerPhaseNotifications") return err(400, "validation_error");
          (l.permissions as Record<string, unknown>)[k] = v;
        }
      }
      return ok({ link: linkJson(db, l) });
    }
    if (M.startsWith("DELETE ")) {
      delete links[l.uuid];
      return { status: 204 };
    }
  }
  if (M === "GET /api/v2/partner-of") {
    const of = Object.values(links).filter((l) => l.partnerUserId === u.me.id);
    return ok({ links: of.map((l) => ({ partnerUuid: l.uuid, ownerName: db.users[l.ownerId] ? ownerName(db.users[l.ownerId]) : null, ownerPhotoUrl: null, acceptedAt: l.acceptedAt })) });
  }
  const mOf = p.match(/^\/api\/v2\/partner-of\/([^/]+)(?:\/(accept|advice|prefs|nudge))?$/);
  if (!mOf) return null;
  const l = links[decodeURIComponent(mOf[1])];
  const sub = mOf[2];
  if (sub === "accept" && M.startsWith("POST ")) {
    if (!l || !db.users[l.ownerId]) return err(404, "not_found", "Invalid or revoked invite");
    if (l.ownerId === u.me.id) return err(400, "own_link", "Cannot accept your own link");
    if (l.partnerUserId && l.partnerUserId !== u.me.id) return err(409, "link_taken", "Invite already used");
    l.partnerUserId = u.me.id;
    l.acceptedAt ??= nowIso();
    return ok({ ok: true, view: partnerView(db, l) });
  }
  if (!l || l.partnerUserId !== u.me.id || !db.users[l.ownerId]) return err(403, "forbidden");
  if (!sub && M.startsWith("GET ")) return ok(partnerView(db, l));
  if (!sub && M.startsWith("DELETE ")) {
    delete links[l.uuid];
    return { status: 204 };
  }
  if (sub === "advice") {
    if (!l.permissions.viewPhase) return err(403, "phase_tips_disabled");
    if (!l.permissions.partnerAdviceEnabled) return ok({ hidden: true } satisfies PartnerAdvice);
    const v = partnerView(db, l);
    if (v.cycleState === "paused") return ok({ hidden: true } satisfies PartnerAdvice);
    const phase = v.dayType === "period" ? "menstrual" : v.dayType === "fertile" ? "fertile" : v.dayType === "pms" ? "pms" : "follicular";
    const lang = ADVICE[q.get("locale") ?? "en"] ?? ADVICE.en;
    const advice: PartnerAdvice = { hidden: false, phase, text: lang[phase] ?? lang.other, category: "care", fallback: false };
    return ok(advice);
  }
  if (sub === "prefs" && M.startsWith("PATCH ")) {
    for (const k of ["partnerAdviceEnabled", "partnerPhaseNotifications"] as const) if (typeof b[k] === "boolean") l.permissions[k] = b[k] as boolean;
    if (Array.isArray(b.partnerAdviceCategories)) l.permissions.partnerAdviceCategories = b.partnerAdviceCategories as PartnerPermissions["partnerAdviceCategories"];
    const { partnerAdviceEnabled, partnerPhaseNotifications, partnerAdviceCategories } = l.permissions;
    return ok({ partnerAdviceEnabled, partnerPhaseNotifications, partnerAdviceCategories });
  }
  if (sub === "nudge" && M.startsWith("POST ")) {
    const now = Date.now();
    l.nudges = l.nudges.filter((x) => now - x < 86_400_000);
    if (l.nudges.length >= 3) return err(429, "rate_limited", "Nudge limit reached", { retryAfterSec: Math.ceil((l.nudges[0] + 86_400_000 - now) / 1000) });
    l.nudges.push(now);
    return ok({ ok: true, remaining: 3 - l.nudges.length });
  }
  return null;
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
