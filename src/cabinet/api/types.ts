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
  gdprConsent: boolean;
  mode: Mode;
  hasProfile: boolean;
  createdAt: string;
};

export type AuthConfig = {
  telegramBotUsername: string;
  telegramWidgetEnabled: boolean;
  emailLoginEnabled: boolean;
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
};

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
