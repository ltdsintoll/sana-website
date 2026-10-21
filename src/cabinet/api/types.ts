// Types of the Sana API v1 contract (see hercycle PR "cycle-core-web-api").
// The website renders what the server computes; it does not do cycle math.

export type Ymd = string;

export type Mode = "BASIC" | "ADVANCED" | "PREGNANCY";

export type Me = {
  id: string;
  email: string | null;
  emailVerified: boolean;
  telegram: {
    id: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    photoUrl: string | null;
  } | null;
  languageCode: string | null;
  timezone: string | null;
  /** Equals `consent.accepted` (kept for older clients). */
  gdprConsent: boolean;
  /** v1.3: state of the GDPR consent (section 12). */
  consent?: Consent;
  mode: Mode;
  hasProfile: boolean;
  createdAt: string;
  /**
   * v1.5: ids of accounts that were merged into this one. A device that still
   * caches one of them (e.g. with changes queued offline) is the same person.
   */
  mergedAccountIds?: string[];
};

/** v1.3 (section 12): the server rejects health-data writes until `accepted`. */
export type Consent = {
  accepted: boolean;
  acceptedAt: string | null;
  /** `null` for consents given before versions were recorded. */
  version: string | null;
  currentVersion: string | null;
  /** v1.4: accepted an older text; writes answer consent_required until the current one is accepted. */
  needsReconsent?: boolean;
  /** v1.4: when consent was withdrawn (null when never withdrawn or accepted again since). */
  withdrawnAt?: string | null;
};

/** Has this account a current GDPR consent? (v1.3 `consent`, else `gdprConsent`). */
export function hasConsent(me: Pick<Me, "gdprConsent" | "consent"> | null | undefined): boolean {
  if (!me) return false;
  return me.consent ? me.consent.accepted === true && me.consent.needsReconsent !== true : me.gdprConsent === true;
}

/**
 * v1.4: "none" never consented (onboarding asks), "withdrawn" chose to withdraw (the cabinet stays
 * readable with a banner), "reconsent" a newer policy text waits to be accepted.
 */
export type ConsentStatus = "ok" | "none" | "withdrawn" | "reconsent";
export function consentStatus(me: Pick<Me, "gdprConsent" | "consent"> | null | undefined): ConsentStatus {
  if (!me) return "none";
  if (hasConsent(me)) return "ok";
  if (me.consent?.accepted && me.consent.needsReconsent) return "reconsent";
  if (me.consent?.withdrawnAt) return "withdrawn";
  return "none";
}

export type AuthConfig = {
  telegramBotUsername: string;
  telegramWidgetEnabled: boolean;
  emailLoginEnabled: boolean;
  /** v1.2: Web Push configured on the server (VAPID). */
  webPushEnabled?: boolean;
  vapidPublicKey?: string | null;
};

export type Episode = {
  id: string;
  startYmd: Ymd;
  endYmd: Ymd | null;
  source: "user" | "auto_closed" | "import" | "bot";
  reviewReason: string | null;
  /** v1.1: user confirmed a start < 15 days after the previous one. */
  confirmedNewCycle?: boolean;
  updatedAt: string;
};

export type Flow = "spotting" | "light" | "normal" | "heavy";

export type DayLog = {
  ymd: Ymd;
  flow: Flow | null;
  pain: number | null;
  hasSex: boolean;
  sexNote: string | null;
  hasWellbeingMarks: boolean;
  hasActivityMarks: boolean;
  updatedAt: string | null;
};

export type Pregnancy = {
  id: string;
  startYmd: Ymd;
  dueYmd: Ymd | null;
  endYmd: Ymd | null;
  outcome: string | null;
};

export type CycleSettings = {
  cycleLength: number | null;
  periodLength: number | null;
  forceCycleLength: boolean;
  isIrregular: boolean;
  mode: Mode;
  timezone: string | null;
};

export type Range = { startYmd: Ymd; endYmd: Ymd };

export type CycleState =
  | "no_data"
  | "period"
  | "expected"
  | "late"
  | "stale"
  | "pregnancy";

export type Phase =
  | "menstrual"
  | "follicular"
  | "fertile"
  | "ovulation"
  | "luteal"
  | "pms"
  | "late"
  | "unknown"
  | "pregnancy";

export type CycleStatus = {
  today: Ymd;
  state: CycleState;
  phase: Phase;
  cycleDay: number | null;
  periodDay: number | null;
  lastPeriodStartYmd: Ymd | null;
  ongoingEpisodeId: string | null;
  expectedStartYmd: Ymd | null;
  expectedWindow: Range | null;
  daysUntilExpected: number | null;
  lateDays: number | null;
  fertileWindow: Range | null;
  ovulationYmd: Ymd | null;
  pmsWindow: Range | null;
  confidence: "high" | "medium" | "low" | "none";
  pregnancy: { startYmd: Ymd; dueYmd: Ymd | null; week: number; day: number } | null;
};

export type CycleStats = {
  cycleLength: number;
  cycleLengthSource: "history" | "blended" | "prior" | "default" | "forced";
  periodLength: number;
  periodLengthSource: "history" | "prior" | "default";
  cyclesCount: number;
  cycleLengthMin: number | null;
  cycleLengthMax: number | null;
  irregular: boolean;
  history: Array<{
    startYmd: Ymd;
    endYmd: Ymd;
    lengthDays: number;
    periodDays: number;
    excluded: boolean;
    excludedReason: "too_short" | "too_long" | "outlier" | "pregnancy" | null;
  }>;
};

export type DayKind =
  | "period"
  | "period_predicted"
  | "spotting"
  | "ovulation"
  | "fertile"
  | "pms"
  | "pregnancy"
  | "none";

export type CalendarDay = { ymd: Ymd; kind: DayKind; predicted: boolean };

export type CycleResponse = {
  version: number;
  updatedAt: string;
  today: Ymd;
  settings: CycleSettings;
  episodes: Episode[];
  dayLogs: DayLog[];
  pregnancies: Pregnancy[];
  status: CycleStatus;
  stats: CycleStats;
  calendar: { from: Ymd; to: Ymd; days: CalendarDay[] };
};

export type Symptom = {
  id: string;
  date: Ymd;
  category: string;
  key: string;
  value: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationSettings = {
  checkBag: boolean;
  remindMark: boolean;
  congratulate: boolean;
  pmsWarning: boolean;
  discreetMode: boolean;
  customTextPeriodComing?: string | null;
  customTextPeriodStarted?: string | null;
  customTextFertile?: string | null;
  customTextPms?: string | null;
  /** v1.1: true when the user never saved notification settings. */
  isDefault?: boolean;
  /** v1.2 channel switches. */
  channelTelegram?: boolean;
  channelWebPush?: boolean;
  /** v1.2: opt-in email when the period is late (needs a verified email). */
  emailLateReminders?: boolean;
  /** v1.2: what can deliver for this account right now. */
  available?: NotificationAvailability;
};

export type NotificationAvailability = {
  telegram: boolean;
  telegramBlocked: boolean;
  webPushEnabled: boolean;
  webPushDevices: number;
  email: boolean;
};

// ------------------------------------------------------------------ v1.2 Web Push (contract 8)

export type PushSubscriptionJSONBody = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

export type PushDevice = {
  id: string;
  deviceLabel: string | null;
  userAgent: string | null;
  endpointHost: string | null;
  createdAt: string;
  lastSuccessAt: string | null;
  expirationTime: string | null;
  current: boolean;
};

// ------------------------------------------------------------------ v1.2 Partners (contract 10)

export const OWNER_PERMISSIONS = [
  "showPeriod",
  "showFertile",
  "showPms",
  "viewPhase",
  "showSexFreq",
  "showSleep",
  "showHeartRate",
  "showMood",
  "partnerNotifPms",
] as const;
export type OwnerPermission = (typeof OWNER_PERMISSIONS)[number];

export const ADVICE_CATEGORIES = ["care", "activity", "food", "mood", "intimacy"] as const;
export type AdviceCategory = (typeof ADVICE_CATEGORIES)[number];

export type PartnerPermissions = Record<OwnerPermission, boolean> & {
  partnerAdviceEnabled: boolean;
  partnerPhaseNotifications: boolean;
  partnerAdviceCategories: AdviceCategory[];
};

export type OwnerPartnerLink = {
  partnerUuid: string;
  label: string | null;
  shareUrl: string;
  webShareUrl: string;
  accepted: boolean;
  createdAt: string;
  acceptedAt: string | null;
  partner: { firstName: string | null; photoUrl: string | null; username: string | null } | null;
  permissions: PartnerPermissions;
};

export type PartnerOfLink = {
  partnerUuid: string;
  ownerName: string | null;
  ownerPhotoUrl: string | null;
  acceptedAt: string | null;
};

export type PartnerDayType = "period" | "period_predicted" | "fertile" | "pms" | null;

export type PartnerView = {
  /** v1.4: the owner withdrew consent; nothing about her cycle is shared. */
  sharingPaused?: boolean;
  /** v1.4: the partner's own consent, stored on the server. */
  partnerConsent?: { acceptedAt: string | null; version: string | null; current: boolean };
  today: Ymd;
  dayType: "period" | "fertile" | "pms" | "safe" | "nothing";
  daysUntilPeriod: number | null;
  cycleState: "expected" | "period" | "late" | "stale" | "no_data" | "paused" | "hidden";
  lateDays: number | null;
  ongoingPeriod: { dayIndex: number; suggestedTotal: number } | null;
  ownerName: string | null;
  ownerPhotoUrl: string | null;
  ownerIrregular: boolean;
  permissions: PartnerPermissions;
  sexDotsThisMonth: boolean[];
  sexDotsLastMonth: boolean[];
  monthDays: Array<{ date: Ymd; type: PartnerDayType }>;
  prevMonthDays: Array<{ date: Ymd; type: PartnerDayType }>;
};

export type PartnerAdvice =
  | { hidden: true }
  | { hidden: false; phase: string; text: string; category: AdviceCategory; fallback: boolean };

export type PartnerPrefs = Pick<PartnerPermissions, "partnerAdviceEnabled" | "partnerPhaseNotifications" | "partnerAdviceCategories">;

export type NudgeKind = "sweets" | "hug" | "ask";

export type TelegramStart = {
  pollToken: string;
  botUrl: string;
  expiresAt: string;
  pollIntervalMs: number;
};

export type TelegramPoll =
  | { status: "pending" | "cancelled" | "expired" }
  | { status: "confirmed"; user: Me };

export type MergeDetails = {
  other: {
    hasTelegram: boolean;
    hasEmail: boolean;
    periods: number;
    createdAt: string;
  };
};

export type NeedsConfirmationDetails = {
  previousStartYmd: Ymd;
  options: Array<"continuation" | "spotting" | "new_cycle">;
};

/** Object passed by the Telegram Login Widget to data-onauth. */
export type TelegramWidgetUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};
