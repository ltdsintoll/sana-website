"use client";

import { ChevronRight, PenLine } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import type { CycleStatus, Ymd } from "../api/types";
import { addDays, diffDays, fmtDate, fmtRange } from "../lib/dates";
import { useCabinet } from "../state/hooks";
import { setSelectedDay, useCycleView } from "../state/view";
import { DayCell, InstallHint, PastDatePicker, kindLabelKey } from "../ui/cycle";
import { FullScreenSpinner, Screen } from "../ui/layout";
import { Button, Card } from "../ui/primitives";
import { useUI } from "../ui/ui-context";

export default function TodayScreen() {
  const t = useTranslations("cab");
  const locale = useLocale();
  const view = useCycleView();
  const { cycle, today } = view;
  const { symptoms } = useCabinet();
  const router = useRouter();

  if (!cycle) return <FullScreenSpinner />;
  const s = cycle.status;
  const todayLog = view.log(today);
  const todaySymptoms = (symptoms[today] ?? []).filter((x) => x.value);

  const openDay = (ymd: Ymd) => {
    setSelectedDay(ymd);
    router.push("/app/day");
  };

  return (
    <Screen title={t("today.title")}>
      <p className="-mt-2 mb-3 px-1 text-sm text-c-muted first-letter:uppercase">{fmtDate(today, locale, { weekday: "long", day: "numeric", month: "long" })}</p>
      <StatusHero status={s} today={today} />

      {s.state !== "pregnancy" && s.state !== "no_data" ? <PhaseLine status={s} /> : null}

      <Card className="mt-3 px-2 py-3">
        <div className="grid grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => addDays(today, i - 3)).map((d) => {
            const future = d > today;
            const day = view.day(d);
            const lk = kindLabelKey(day, view.isPeriod(d));
            return (
              <div key={d} className="flex flex-col items-center gap-1">
                <span className={`text-[11px] uppercase ${d === today ? "font-semibold text-c-ink" : "text-c-subtle"}`}>
                  {fmtDate(d, locale, { weekday: "narrow" })}
                </span>
                <DayCell
                  size="sm"
                  ymd={d}
                  day={day}
                  log={view.log(d)}
                  isPeriod={view.isPeriod(d)}
                  isToday={d === today}
                  isFuture={future}
                  pending={view.isPending(d)}
                  label={`${fmtDate(d, locale, { day: "numeric", month: "long" })}${lk ? `: ${t(lk)}` : ""}`}
                  onClick={future ? () => router.push("/app/calendar") : () => openDay(d)}
                />
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="mt-3">
        <button type="button" onClick={() => openDay(today)} className="flex min-h-14 w-full items-center gap-3 text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-c-accent-soft text-c-accent">
            <PenLine className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-medium">{t("today.logTitle")}</span>
            <span className="block truncate text-sm text-c-muted">
              {todayLog?.flow || todayLog?.pain != null || todaySymptoms.length || todayLog?.hasWellbeingMarks
                ? [
                    todayLog?.flow ? t(`flow.${todayLog.flow}`) : null,
                    todayLog?.pain != null ? t("day.painValue", { value: todayLog.pain }) : null,
                    todaySymptoms.length ? t("today.marksCount", { count: todaySymptoms.length }) : todayLog?.hasWellbeingMarks ? t("today.hasMarks") : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")
                : t("today.logHint")}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-c-subtle" aria-hidden />
        </button>
      </Card>

      <Upcoming status={s} />
      <InstallHint compact />
    </Screen>
  );
}

function StatusHero({ status: s, today }: { status: CycleStatus; today: Ymd }) {
  const t = useTranslations("cab");
  const locale = useLocale();
  const ui = useUI();
  const view = useCycleView();
  const [picker, setPicker] = useState<null | "start" | "end">(null);
  const [busy, setBusy] = useState(false);

  async function start(date: Ymd) {
    setPicker(null);
    setBusy(true);
    await ui.exec({ type: "periodStart", date }, date === today ? t("today.startedToday") : t("today.startedOn", { date: fmtDate(date, locale) }));
    setBusy(false);
  }
  async function end(date: Ymd) {
    setPicker(null);
    setBusy(true);
    await ui.exec({ type: "periodEnd", date }, date === today ? t("today.endedToday") : t("today.endedOn", { date: fmtDate(date, locale) }));
    setBusy(false);
  }

  const startButtons = (
    <>
      <Button variant="period" size="lg" block loading={busy} onClick={() => void start(today)}>
        {t("today.periodStarted")}
      </Button>
      <Button variant="ghost" size="sm" block onClick={() => setPicker("start")}>
        {t("today.startedOtherDay")}
      </Button>
    </>
  );

  let tone = "bg-c-card";
  let eyebrow = "";
  let big: string;
  let sub: string | null = null;
  let actions = startButtons;
  let extra: ReactNode = null;

  switch (s.state) {
    case "period": {
      tone = "bg-c-period-soft";
      eyebrow = t("today.periodEyebrow");
      big = t("today.periodDay", { day: s.periodDay ?? 1 });
      const ep = view.cycle?.episodes.find((e) => e.startYmd === s.lastPeriodStartYmd);
      const endsToday = ep?.endYmd === today;
      sub = endsToday ? t("today.lastDayToday") : null;
      actions = endsToday ? (
        <Button variant="outline" block onClick={() => ep && void ui.exec({ type: "periodPatch", id: ep.id, endYmd: null }, t("today.stillGoing"))}>
          {t("today.notEndedYet")}
        </Button>
      ) : (
        <>
          <Button variant="period" size="lg" block loading={busy} onClick={() => void end(today)}>
            {t("today.periodEnded")}
          </Button>
          <Button variant="ghost" size="sm" block onClick={() => setPicker("end")}>
            {t("today.endedOtherDay")}
          </Button>
        </>
      );
      break;
    }
    case "expected":
      eyebrow = t("today.nextEyebrow");
      big = s.daysUntilExpected === 0 ? t("today.expectedToday") : t("today.inDays", { count: s.daysUntilExpected ?? 0 });
      sub = s.expectedStartYmd ? fmtDate(s.expectedStartYmd, locale, { weekday: "long", day: "numeric", month: "long" }) : null;
      break;
    case "late":
      tone = "bg-c-late-soft";
      eyebrow = t("today.lateEyebrow");
      big = t("today.lateDays", { count: s.lateDays ?? 0 });
      sub = s.expectedStartYmd ? t("today.wasExpected", { date: fmtDate(s.expectedStartYmd, locale) }) : null;
      extra = (
        <p className="mt-3 text-sm text-c-muted">
          {t("today.lateHint")}{" "}
          <Link href="/app/settings#pregnancy" className="text-c-accent underline underline-offset-2">
            {t("today.pregnancyLink")}
          </Link>
        </p>
      );
      break;
    case "stale":
      eyebrow = t("today.staleEyebrow");
      big = t("today.staleTitle");
      sub = t("today.staleHint");
      actions = (
        <>
          <Button variant="period" size="lg" block onClick={() => setPicker("start")}>
            {t("today.markLastPeriod")}
          </Button>
          <Button variant="ghost" size="sm" block loading={busy} onClick={() => void start(today)}>
            {t("today.startedTodayShort")}
          </Button>
        </>
      );
      break;
    case "pregnancy": {
      tone = "bg-c-preg-soft";
      eyebrow = t("today.pregnancyEyebrow");
      big = t("today.pregnancyWeek", { week: s.pregnancy?.week ?? 0, day: s.pregnancy?.day ?? 0 });
      const due = s.pregnancy?.dueYmd;
      sub = due ? t("today.dueDate", { date: fmtDate(due, locale, { day: "numeric", month: "long", year: "numeric" }) }) : null;
      actions = (
        <Link href="/app/settings#pregnancy" className="inline-flex min-h-11 items-center text-sm text-c-accent">
          {t("today.pregnancySettings")}
        </Link>
      );
      break;
    }
    default:
      eyebrow = t("today.noDataEyebrow");
      big = t("today.noDataTitle");
      sub = t("today.noDataHint");
  }

  return (
    <section className={`rounded-3xl p-5 ${tone}`} aria-live="polite">
      <p className="text-sm font-medium text-c-muted">{eyebrow}</p>
      <p className="mt-1 text-4xl font-light tracking-tight text-c-ink">{big}</p>
      {sub ? <p className="mt-1 text-base first-letter:uppercase text-c-muted">{sub}</p> : null}
      {extra}
      <div className="mt-5 flex flex-col gap-1">{actions}</div>
      <PastDatePicker
        open={picker !== null}
        title={picker === "end" ? t("today.whenEnded") : t("today.whenStarted")}
        today={today}
        min={picker === "end" ? s.lastPeriodStartYmd ?? undefined : undefined}
        onClose={() => setPicker(null)}
        onPick={(d) => void (picker === "end" ? end(d) : start(d))}
      />
    </section>
  );
}

function PhaseLine({ status: s }: { status: CycleStatus }) {
  const t = useTranslations("cab");
  const fertile = s.phase === "fertile" || s.phase === "ovulation";
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 px-1">
      {s.cycleDay ? <span className="rounded-full bg-c-card px-3 py-1.5 text-sm text-c-ink">{t("today.cycleDay", { day: s.cycleDay })}</span> : null}
      {s.phase !== "unknown" && s.phase !== "menstrual" && s.phase !== "late" ? (
        <span className={`rounded-full px-3 py-1.5 text-sm ${fertile ? "bg-c-fertile-soft text-c-fertile" : s.phase === "pms" ? "bg-c-pms-soft text-c-pms" : "bg-c-card text-c-ink"}`}>
          {t(`phase.${s.phase}`)}
        </span>
      ) : null}
      {s.confidence === "low" || s.confidence === "none" ? <span className="text-xs text-c-subtle">{t("today.lowConfidence")}</span> : null}
      {fertile ? <p className="w-full text-xs text-c-subtle">{t("common.notContraception")}</p> : null}
    </div>
  );
}

function Upcoming({ status: s }: { status: CycleStatus }) {
  const t = useTranslations("cab");
  const locale = useLocale();
  const rows: Array<{ label: string; value: string; tone: string }> = [];
  if (s.state === "pregnancy" || s.state === "no_data" || s.state === "stale") return null;
  if (s.expectedWindow && s.state !== "late") {
    rows.push({ label: t("today.nextPeriod"), value: fmtRange(s.expectedWindow.startYmd, s.expectedWindow.endYmd, locale), tone: "bg-c-period" });
  }
  if (s.fertileWindow && s.fertileWindow.endYmd >= s.today) {
    rows.push({ label: t("today.fertileWindow"), value: fmtRange(s.fertileWindow.startYmd, s.fertileWindow.endYmd, locale), tone: "bg-c-fertile" });
  }
  if (s.ovulationYmd && s.ovulationYmd >= s.today) {
    rows.push({ label: t("today.ovulation"), value: fmtDate(s.ovulationYmd, locale), tone: "bg-c-fertile" });
  }
  if (s.pmsWindow && s.pmsWindow.endYmd >= s.today && diffDays(s.pmsWindow.startYmd, s.today) < 20) {
    rows.push({ label: t("today.pms"), value: fmtRange(s.pmsWindow.startYmd, s.pmsWindow.endYmd, locale), tone: "bg-c-pms" });
  }
  if (!rows.length) return null;
  return (
    <Card className="mt-3">
      <h2 className="mb-1 text-sm font-medium text-c-muted">{t("today.upcoming")}</h2>
      <ul className="divide-y divide-c-line">
        {rows.map((r) => (
          <li key={r.label} className="flex min-h-12 items-center gap-3 py-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${r.tone}`} aria-hidden />
            <span className="flex-1 text-base text-c-ink">{r.label}</span>
            <span className="text-right text-sm text-c-muted">{r.value}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-c-subtle">{t("today.forecastNote")}</p>
    </Card>
  );
}
