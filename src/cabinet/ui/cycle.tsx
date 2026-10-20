"use client";

import { Clock, Share, SquarePlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import type { CalendarDay, DayLog, Ymd } from "../api/types";
import { addDays, fmtDate } from "../lib/dates";
import { useInstall } from "../lib/install";
import { Button, Card, Sheet } from "./primitives";

/** Visual style of a calendar cell. Logged and predicted kinds look different. */
export function cellStyle(day: CalendarDay | undefined, isPeriod: boolean): { box: string; text: string } {
  if (isPeriod) return { box: "bg-c-period", text: "text-c-period-ink font-semibold" };
  switch (day?.kind) {
    case "period":
    case "period_predicted":
      return { box: "predicted-ring border-2 border-dashed border-c-period", text: "text-c-period font-medium" };
    case "spotting":
      return { box: "border-2 border-c-period/50", text: "text-c-ink" };
    case "ovulation":
      return { box: "bg-c-fertile-soft ring-2 ring-inset ring-c-fertile", text: "text-c-fertile font-semibold" };
    case "fertile":
      return { box: "bg-c-fertile-soft", text: "text-c-fertile" };
    case "pms":
      return { box: "bg-c-pms-soft", text: "text-c-ink" };
    case "pregnancy":
      return { box: "bg-c-preg-soft", text: "text-c-ink" };
    default:
      return { box: "", text: "text-c-ink" };
  }
}

/** Long period guard (contract 11): the threshold above which we ask once more. */
export const LONG_PERIOD_DAYS = 10;

/** Length of the period run that marking `ymd` would produce (adjacent logged days + this one). */
export function periodRunIfMarked(isPeriod: (ymd: Ymd) => boolean, ymd: Ymd): number {
  let n = 1;
  for (let d = addDays(ymd, -1), i = 0; i < 60 && isPeriod(d); d = addDays(d, -1), i++) n++;
  for (let d = addDays(ymd, 1), i = 0; i < 60 && isPeriod(d); d = addDays(d, 1), i++) n++;
  return n;
}

export function kindLabelKey(day: CalendarDay | undefined, isPeriod: boolean): string | null {
  if (isPeriod) return "kind.period";
  if (!day || day.kind === "none") return null;
  if (day.kind === "period" || day.kind === "period_predicted") return "kind.periodPredicted";
  return `kind.${day.kind}`;
}

export function DayCell({
  ymd,
  day,
  log,
  isPeriod,
  isToday,
  isFuture,
  pending,
  onClick,
  label,
  size = "md",
}: {
  ymd: Ymd;
  day: CalendarDay | undefined;
  log: DayLog | undefined;
  isPeriod: boolean;
  isToday: boolean;
  isFuture: boolean;
  pending: boolean;
  onClick?: () => void;
  label: string;
  size?: "md" | "sm";
}) {
  const s = cellStyle(day, isPeriod);
  const n = Number(ymd.slice(8));
  const dim = size === "sm" ? "h-10 w-10 text-sm" : "h-11 w-11 text-base sm:h-12 sm:w-12";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={isToday ? "date" : undefined}
      className="relative flex min-h-12 w-full flex-col items-center justify-center rounded-2xl active:bg-c-raised"
    >
      <span
        className={`flex ${dim} items-center justify-center rounded-full tabular-nums ${s.box} ${s.text} ${
          isToday ? "outline outline-2 outline-offset-2 outline-c-ink" : ""
        } ${pending ? "opacity-70" : ""}`}
      >
        {n}
      </span>
      <span className="absolute bottom-0 flex h-1.5 gap-0.5" aria-hidden>
        {log?.hasWellbeingMarks ? <span className="h-1.5 w-1.5 rounded-full bg-c-accent" /> : null}
        {log?.hasActivityMarks || log?.hasSex ? <span className="h-1.5 w-1.5 rounded-full bg-c-fertile" /> : null}
        {log?.flow && !isPeriod ? <span className="h-1.5 w-1.5 rounded-full bg-c-period" /> : null}
      </span>
      {pending ? <Clock className="absolute right-0.5 top-0.5 h-3 w-3 text-c-subtle" aria-hidden /> : null}
      {isFuture ? <span className="sr-only">·</span> : null}
    </button>
  );
}

export function Legend() {
  const t = useTranslations("cab");
  const items: Array<[string, string]> = [
    ["bg-c-period", t("kind.period")],
    ["predicted-ring border-2 border-dashed border-c-period", t("kind.periodPredicted")],
    ["bg-c-fertile-soft", t("kind.fertile")],
    ["bg-c-fertile-soft ring-2 ring-inset ring-c-fertile", t("kind.ovulation")],
    ["bg-c-pms-soft", t("kind.pms")],
  ];
  return (
    <div className="mt-4">
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-c-muted">
        {items.map(([cls, text]) => (
          <li key={text} className="flex items-center gap-2">
            <span className={`h-4 w-4 shrink-0 rounded-full ${cls}`} aria-hidden />
            {text}
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="flex w-4 justify-center gap-0.5" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-c-accent" />
            <span className="h-1.5 w-1.5 rounded-full bg-c-fertile" />
          </span>
          {t("kind.marks")}
        </li>
      </ul>
      <p className="mt-3 text-xs text-c-subtle">{t("common.notContraception")}</p>
    </div>
  );
}

/** Pick a past day (or today). Future dates are not offered at all. */
export function PastDatePicker({
  open,
  title,
  today,
  min,
  onClose,
  onPick,
}: {
  open: boolean;
  title: string;
  today: Ymd;
  min?: Ymd;
  onClose: () => void;
  onPick: (ymd: Ymd) => void;
}) {
  const t = useTranslations("cab");
  const locale = useLocale();
  const [value, setValue] = useState(today);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setValue(today); // every opening starts at today
  }
  const quick = [0, 1, 2, 3].map((n) => addDays(today, -n)).filter((d) => !min || d >= min);
  return (
    <Sheet open={open} onClose={onClose} title={title} labelClose={t("common.close")}>
      <div className="grid grid-cols-2 gap-2">
        {quick.map((d, i) => (
          <Button key={d} variant="outline" onClick={() => onPick(d)}>
            {i === 0 ? t("common.today") : i === 1 ? t("common.yesterday") : fmtDate(d, locale, { weekday: "short", day: "numeric", month: "short" })}
          </Button>
        ))}
      </div>
      <label className="mt-4 block">
        <span className="mb-1.5 block text-sm text-c-muted">{t("common.otherDate")}</span>
        <input
          type="date"
          value={value}
          max={today}
          min={min}
          onChange={(e) => setValue(e.target.value)}
          className="min-h-12 w-full rounded-2xl border border-c-line bg-c-bg px-4 text-base text-c-ink"
        />
      </label>
      <Button block className="mt-3" disabled={!value || value > today || (!!min && value < min)} onClick={() => onPick(value)}>
        {t("common.choose")}
      </Button>
    </Sheet>
  );
}

const HINT_KEY = "sana-install-hint-dismissed";
const hintListeners = new Set<() => void>();
function subscribeHint(l: () => void) {
  hintListeners.add(l);
  return () => {
    hintListeners.delete(l);
  };
}
function readHint(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

/** "Add to Home Screen" instructions for iOS, install button where supported. */
export function InstallHint({ compact = false }: { compact?: boolean }) {
  const t = useTranslations("cab.install");
  const info = useInstall();
  const dismissed = useSyncExternalStore(subscribeHint, readHint, () => true);
  if (info.standalone) return compact ? null : <p className="text-sm text-c-muted">{t("installed")}</p>;
  if (compact && (dismissed || (!info.ios && !info.canPrompt))) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {
      /* ignore */
    }
    hintListeners.forEach((l) => l());
  };
  const body = info.ios ? (
    <ol className="space-y-2 text-sm text-c-muted">
      <li className="flex items-center gap-2">
        <span>1.</span> {t("ios1")} <Share className="h-4 w-4 text-c-accent" aria-label={t("share")} />
      </li>
      <li className="flex items-center gap-2">
        <span>2.</span> {t("ios2")} <SquarePlus className="h-4 w-4 text-c-accent" aria-hidden />
      </li>
      <li>
        <span>3.</span> {t("ios3")}
      </li>
    </ol>
  ) : info.canPrompt ? (
    <Button variant="soft" onClick={() => void info.prompt()}>
      {t("button")}
    </Button>
  ) : (
    <p className="text-sm text-c-muted">{t("other")}</p>
  );
  if (!compact) return body;
  return (
    <Card className="mt-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <h2 className="text-base font-medium">{t("title")}</h2>
        <button type="button" onClick={dismiss} className="-m-2 min-h-11 px-2 text-sm text-c-subtle">
          {t("dismiss")}
        </button>
      </div>
      {body}
    </Card>
  );
}
