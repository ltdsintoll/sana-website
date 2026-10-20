import type {
  AuthConfig,
  Consent,
  CycleResponse,
  Flow,
  Me,
  NotificationSettings,
  NudgeKind,
  OwnerPartnerLink,
  OwnerPermission,
  PartnerAdvice,
  PartnerOfLink,
  PartnerPrefs,
  PartnerView,
  PushDevice,
  PushSubscriptionJSONBody,
  Symptom,
  TelegramPoll,
  TelegramStart,
  TelegramWidgetUser,
  Ymd,
} from "./types";

/**
 * Base URL of the Sana API. `""` means same origin (Next rewrites proxy /api/*).
 * When the variable is not set at all, the cabinet runs on built-in demo
 * fixtures (see ./mock.ts) so it can be explored without the backend.
 */
const RAW_BASE = process.env.NEXT_PUBLIC_API_BASE_URL;
export const API_BASE = (RAW_BASE ?? "").replace(/\/+$/, "");
export const IS_MOCK =
  process.env.NEXT_PUBLIC_API_MOCK === "1" || RAW_BASE === undefined;

export class ApiError extends Error {
  status: number;
  code: string;
  details: Record<string, unknown> | undefined;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  get retryAfterSec(): number | undefined {
    const v = this.details?.retryAfterSec;
    return typeof v === "number" ? v : undefined;
  }
}

/** The request never reached the server (offline, DNS, CORS failure...). */
export class NetworkError extends Error {}

export type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  ifNoneMatch?: string | null;
  signal?: AbortSignal;
  /**
   * v1.3: do not wait for the consent screen on 403 consent_required (the
   * offline queue handles that itself and keeps the command).
   */
  noConsentGate?: boolean;
};

export type RawResponse<T> = { status: number; data: T | null; etag: string | null };

export function browserTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

let mockModule: Promise<typeof import("./mock")> | null = null;

/**
 * v1.3 (contract 12): health-data writes answer 403 consent_required until the
 * account accepted the consent. The store registers a handler that shows the
 * consent screen and resolves `true` once it was accepted (then the write is
 * sent again) or `false` (signed out: the original error is thrown).
 */
type ConsentHandler = () => Promise<boolean>;
let consentHandler: ConsentHandler | null = null;
export function setConsentHandler(fn: ConsentHandler | null) {
  consentHandler = fn;
}

export function isConsentRequired(e: unknown): e is ApiError {
  return e instanceof ApiError && e.status === 403 && e.code === "consent_required";
}

export async function rawRequest<T>(path: string, opts: RequestOptions = {}): Promise<RawResponse<T>> {
  try {
    return await sendRequest<T>(path, opts);
  } catch (e) {
    // Reads and DELETEs never need consent; a write is retried once after it.
    const method = opts.method ?? "GET";
    if (!isConsentRequired(e) || opts.noConsentGate || method === "GET" || method === "DELETE" || !consentHandler) throw e;
    if (!(await consentHandler())) throw e;
    return sendRequest<T>(path, { ...opts, noConsentGate: true });
  }
}

async function sendRequest<T>(path: string, opts: RequestOptions): Promise<RawResponse<T>> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  const tz = browserTimeZone();
  if (tz) headers["X-Timezone"] = tz;
  if (opts.ifNoneMatch) headers["If-None-Match"] = opts.ifNoneMatch;

  let status: number;
  let etag: string | null;
  let payload: unknown = null;

  if (IS_MOCK) {
    mockModule ??= import("./mock");
    const mock = await mockModule;
    const r = await mock.handle(method, path, opts.body, headers);
    status = r.status;
    etag = r.etag ?? null;
    payload = r.body ?? null;
  } else {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        credentials: "include",
        cache: "no-store",
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal,
      });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      throw new NetworkError("network");
    }
    status = res.status;
    etag = res.headers.get("ETag");
    if (status !== 204 && status !== 304) {
      const text = await res.text();
      if (text) {
        try {
          payload = JSON.parse(text);
        } catch {
          payload = null;
        }
      }
    }
  }

  if (status >= 400) {
    const p = (payload ?? {}) as { error?: string; message?: string; details?: Record<string, unknown> };
    throw new ApiError(status, p.error ?? `http_${status}`, p.message ?? "", p.details);
  }
  return { status, data: (payload as T) ?? null, etag };
}

async function req<T>(path: string, opts?: RequestOptions): Promise<T> {
  const r = await rawRequest<T>(path, opts);
  return r.data as T;
}

const enc = encodeURIComponent;

export const api = {
  // --- auth
  authConfig: () => req<AuthConfig>("/api/auth/config"),
  session: () => req<{ user: Me }>("/api/auth/session"),
  emailRequest: (email: string, locale: string) =>
    req<{ ok: true; expiresInSec: number; resendAfterSec: number }>("/api/auth/email/request", {
      method: "POST",
      body: { email, locale },
    }),
  emailVerify: (email: string, code: string) =>
    req<{ user: Me; created: boolean }>("/api/auth/email/verify", {
      method: "POST",
      body: { email, code },
    }),
  telegramWidget: (data: TelegramWidgetUser) =>
    req<{ user: Me; created: boolean }>("/api/auth/telegram/widget", { method: "POST", body: data }),
  telegramStart: (purpose: "login" | "link") =>
    req<TelegramStart>("/api/auth/telegram/start", { method: "POST", body: { purpose } }),
  telegramPoll: (pollToken: string, merge = false) =>
    req<TelegramPoll>("/api/auth/telegram/poll", { method: "POST", body: { pollToken, merge } }),
  linkEmailRequest: (email: string, locale: string) =>
    req<{ ok: true; expiresInSec: number; resendAfterSec: number }>("/api/auth/link/email/request", {
      method: "POST",
      body: { email, locale },
    }),
  linkEmailVerify: (email: string, code: string, merge = false) =>
    req<{ user: Me; merged: boolean }>("/api/auth/link/email/verify", {
      method: "POST",
      body: { email, code, merge },
    }),
  linkTelegramWidget: (data: TelegramWidgetUser, merge = false) =>
    req<{ user: Me; merged: boolean }>("/api/auth/link/telegram/widget", {
      method: "POST",
      body: { ...data, merge },
    }),
  /** v1.2: pass this browser's push endpoint so the server forgets the device. */
  logout: (pushEndpoint?: string | null) =>
    req<null>("/api/auth/logout", { method: "POST", body: pushEndpoint ? { pushEndpoint } : undefined }),
  logoutAll: () => req<null>("/api/auth/logout-all", { method: "POST" }),

  // --- profile
  patchMe: (body: { timezone?: string; languageCode?: string }) =>
    req<{ user: Me }>("/api/v2/me", { method: "PATCH", body }),
  /** v1.3: the server sets the version; clients only send `accepted: true`. */
  consent: () => req<{ consent: Consent }>("/api/v2/consent"),
  acceptConsent: () => req<{ consent: Consent }>("/api/v2/consent", { method: "POST", body: { accepted: true } }),
  deleteAccount: () => req<null>("/api/gdpr/delete-account", { method: "POST" }),
  notifications: () => req<NotificationSettings | null>("/api/notifications"),
  updateNotifications: (body: Partial<NotificationSettings>) =>
    req<NotificationSettings>("/api/notifications", { method: "PUT", body }),

  // --- cycle
  cycle: (range: { from: Ymd; to: Ymd } | null, etag?: string | null) =>
    rawRequest<CycleResponse>(`/api/v2/cycle${rangeQuery(range)}`, { ifNoneMatch: etag }),
  syncVersion: () => req<{ version: number; updatedAt: string; today?: Ymd }>("/api/v2/sync/version"),

  // --- symptoms (legacy shape)
  symptoms: (date: Ymd) => req<{ symptoms: Symptom[] }>(`/api/symptoms?date=${enc(date)}`),

  // --- v1.2 Web Push (contract 8)
  pushConfig: () => req<{ webPushEnabled: boolean; vapidPublicKey: string | null }>("/api/v2/push/config"),
  pushSubscribe: (subscription: PushSubscriptionJSONBody, deviceLabel?: string) =>
    req<{ subscription: PushDevice }>("/api/v2/push/subscriptions", {
      method: "POST",
      body: deviceLabel ? { subscription, deviceLabel } : { subscription },
    }),
  pushDevices: () => req<{ webPushEnabled: boolean; subscriptions: PushDevice[] }>("/api/v2/push/subscriptions"),
  pushDelete: (id: string) => req<null>(`/api/v2/push/subscriptions/${enc(id)}`, { method: "DELETE" }),
  pushUnsubscribe: (endpoint: string) => req<null>("/api/v2/push/unsubscribe", { method: "POST", body: { endpoint } }),
  pushTest: (subscriptionId?: string) =>
    req<{ sent: number; removed: number }>("/api/v2/push/test", { method: "POST", body: subscriptionId ? { subscriptionId } : {} }),

  // --- v1.2 partners, owner side (contract 10)
  partners: () => req<{ links: OwnerPartnerLink[] }>("/api/v2/partners"),
  createPartner: (label?: string) =>
    req<{ link: OwnerPartnerLink }>("/api/v2/partners", { method: "POST", body: label ? { label } : {} }),
  updatePartner: (uuid: string, body: { label?: string | null; permissions?: Partial<Record<OwnerPermission, boolean>> }) =>
    req<{ link: OwnerPartnerLink }>(`/api/v2/partners/${enc(uuid)}`, { method: "PATCH", body }),
  revokePartner: (uuid: string) => req<null>(`/api/v2/partners/${enc(uuid)}`, { method: "DELETE" }),

  // --- v1.2 partners, partner side
  partnerOf: () => req<{ links: PartnerOfLink[] }>("/api/v2/partner-of"),
  acceptInvite: (uuid: string) =>
    req<{ ok: true; view: PartnerView }>(`/api/v2/partner-of/${enc(uuid)}/accept`, { method: "POST" }),
  partnerView: (uuid: string) => req<PartnerView>(`/api/v2/partner-of/${enc(uuid)}`),
  leavePartner: (uuid: string) => req<null>(`/api/v2/partner-of/${enc(uuid)}`, { method: "DELETE" }),
  partnerAdvice: (uuid: string, locale: string) =>
    req<PartnerAdvice>(`/api/v2/partner-of/${enc(uuid)}/advice?locale=${enc(locale)}`),
  partnerPrefs: (uuid: string, body: Partial<PartnerPrefs>) =>
    req<PartnerPrefs>(`/api/v2/partner-of/${enc(uuid)}/prefs`, { method: "PATCH", body }),
  nudge: (uuid: string, kind: NudgeKind) =>
    req<{ ok: true; remaining: number }>(`/api/v2/partner-of/${enc(uuid)}/nudge`, { method: "POST", body: { kind } }),
};

/** Partner invite ids are UUIDs; anything else never reaches the API. */
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

export function rangeQuery(range: { from: Ymd; to: Ymd } | null): string {
  return range ? `?from=${enc(range.from)}&to=${enc(range.to)}` : "";
}

/**
 * Commands are the cycle mutations from the contract (4.3-4.5). They are plain
 * data so they can be queued while offline and replayed in order later.
 */
export type Command =
  | { type: "periodStart"; date: Ymd; as?: "continuation" | "spotting" | "new_cycle" }
  | { type: "periodEnd"; date: Ymd }
  | { type: "periodPatch"; id: string; startYmd?: Ymd; endYmd?: Ymd | null }
  | { type: "periodDelete"; id: string }
  | { type: "dayPeriod"; ymd: Ymd; isPeriod: boolean }
  | {
      type: "dayLog";
      ymd: Ymd;
      patch: { flow?: Flow | null; pain?: number | null; hasSex?: boolean; sexNote?: string | null };
    }
  | { type: "dayClear"; ymd: Ymd }
  | {
      type: "settings";
      patch: { cycleLength?: number | null; periodLength?: number | null; forceCycleLength?: boolean; isIrregular?: boolean };
    }
  | { type: "onboarding"; lastPeriodStartYmd: Ymd | null; periodLength: number | null; cycleLength: number | null }
  | { type: "pregnancyStart"; startYmd?: Ymd; dueYmd?: Ymd }
  | { type: "pregnancyEnd"; endYmd?: Ymd; outcome?: "birth" | "loss" | "other" }
  | { type: "symptomUpsert"; date: Ymd; category: string; key: string; value: string | null; tempId?: string }
  | { type: "symptomDelete"; id: string };

/** Commands whose response is the full cycle state (4.2 body). */
export function returnsCycle(cmd: Command): boolean {
  return cmd.type !== "symptomUpsert" && cmd.type !== "symptomDelete";
}

export function commandRequest(cmd: Command, range: { from: Ymd; to: Ymd } | null): { path: string; opts: RequestOptions } {
  const q = rangeQuery(range);
  switch (cmd.type) {
    case "periodStart":
      return { path: `/api/v2/periods/start${q}`, opts: { method: "POST", body: cmd.as ? { date: cmd.date, as: cmd.as } : { date: cmd.date } } };
    case "periodEnd":
      return { path: `/api/v2/periods/end${q}`, opts: { method: "POST", body: { date: cmd.date } } };
    case "periodPatch": {
      const body: Record<string, unknown> = {};
      if (cmd.startYmd !== undefined) body.startYmd = cmd.startYmd;
      if (cmd.endYmd !== undefined) body.endYmd = cmd.endYmd;
      return { path: `/api/v2/periods/${enc(cmd.id)}${q}`, opts: { method: "PATCH", body } };
    }
    case "periodDelete":
      return { path: `/api/v2/periods/${enc(cmd.id)}${q}`, opts: { method: "DELETE" } };
    case "dayPeriod":
      return { path: `/api/v2/days/${enc(cmd.ymd)}/period${q}`, opts: { method: "PUT", body: { isPeriod: cmd.isPeriod } } };
    case "dayLog":
      return { path: `/api/v2/days/${enc(cmd.ymd)}${q}`, opts: { method: "PUT", body: cmd.patch } };
    case "dayClear":
      return { path: `/api/v2/days/${enc(cmd.ymd)}${q}`, opts: { method: "DELETE" } };
    case "settings":
      return { path: `/api/v2/settings${q}`, opts: { method: "PUT", body: cmd.patch } };
    case "onboarding":
      return {
        path: `/api/v2/onboarding${q}`,
        opts: {
          method: "POST",
          body: { lastPeriodStartYmd: cmd.lastPeriodStartYmd, periodLength: cmd.periodLength, cycleLength: cmd.cycleLength },
        },
      };
    case "pregnancyStart": {
      const body: Record<string, unknown> = {};
      if (cmd.startYmd) body.startYmd = cmd.startYmd;
      if (cmd.dueYmd) body.dueYmd = cmd.dueYmd;
      return { path: `/api/v2/pregnancy${q}`, opts: { method: "POST", body } };
    }
    case "pregnancyEnd": {
      const body: Record<string, unknown> = {};
      if (cmd.endYmd) body.endYmd = cmd.endYmd;
      if (cmd.outcome) body.outcome = cmd.outcome;
      return { path: `/api/v2/pregnancy/end${q}`, opts: { method: "POST", body } };
    }
    case "symptomUpsert":
      return {
        path: "/api/symptoms",
        opts: { method: "POST", body: { date: cmd.date, category: cmd.category, key: cmd.key, value: cmd.value } },
      };
    case "symptomDelete":
      return { path: `/api/symptoms/${enc(cmd.id)}`, opts: { method: "DELETE" } };
  }
}
