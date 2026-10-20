"use client";

import { ChevronLeft, ChevronRight, PenLine } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import type { Flow, Ymd } from "../api/types";
import {
  fmtDate,
  fmtMonth,
  monthEnd,
  monthGrid,
  monthOf,
  monthStart,
  shiftMonth,
  weekStartsOn,
  weekdayLabels,
  type MonthKey,
} from "../lib/dates";
import { store } from "../state/store";
import { setSelectedDay, useCycleView } from "../state/view";
import { DayCell, Legend, kindLabelKey } from "../ui/cycle";
import { CycleLoading, Screen } from "../ui/layout";
import { Button, Card, Chip, Sheet, Switch } from "../ui/primitives";
import { useUI } from "../ui/ui-context";

const FLOWS: Flow[] = ["spotting", "light", "normal", "heavy"];

export default function CalendarScreen() {
  const t = useTranslations("cab");
  const locale = useLocale();
  const view = useCycleView();
  const ui = useUI();
  const { cycle, today } = view;
  const [month, setMonth] = useState<MonthKey>(() => monthOf(today));
  const [editMode, setEditMode] = useState(false);
  const [open, setOpen] = useState<Ymd | null>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const firstDow = weekStartsOn(locale);
  const cells = useMemo(() => monthGrid(month, firstDow), [month, firstDow]);
  const labels = useMemo(() => weekdayLabels(locale, firstDow), [locale, firstDow]);

  // Load more history / forecast when the user leaves the cached window.
  useEffect(() => {
    void store.ensureRange(monthStart(shiftMonth(month, -1)), monthEnd(shiftMonth(month, 1)));
  }, [month]);

  if (!cycle) return <CycleLoading />;
  const isCurrent = month.y === monthOf(today).y && month.m === monthOf(today).m;

  async function toggle(ymd: Ymd) {
    const next = !view.isPeriod(ymd);
    const date = fmtDate(ymd, locale);
    await ui.exec({ type: "dayPeriod", ymd, isPeriod: next }, next ? t("calendar.marked", { date }) : t("calendar.unmarked", { date }));
  }

  return (
    <Screen
      title={t("calendar.title")}
      action={
        <Button variant={editMode ? "primary" : "soft"} size="sm" onClick={() => setEditMode((v) => !v)} aria-pressed={editMode}>
          {editMode ? t("common.done") : t("calendar.editPeriods")}
        </Button>
      }
    >
      <Card className="px-2 pb-3 pt-2">
        <div className="mb-1 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label={t("calendar.prevMonth")}
            className="flex h-12 w-12 items-center justify-center rounded-full text-c-ink active:bg-c-raised"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <div className="flex flex-col items-center">
            <h2 className="text-lg font-medium" aria-live="polite">
              {fmtMonth(month, locale)}
            </h2>
            {!isCurrent ? (
              <button type="button" onClick={() => setMonth(monthOf(today))} className="min-h-8 text-sm text-c-accent">
                {t("calendar.toToday")}
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            aria-label={t("calendar.nextMonth")}
            className="flex h-12 w-12 items-center justify-center rounded-full text-c-ink active:bg-c-raised"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {editMode ? <p className="mx-2 mb-2 rounded-2xl bg-c-period-soft px-3 py-2 text-sm text-c-period">{t("calendar.editHint")}</p> : null}

        <div
          className="touch-pan-y"
          onTouchStart={(e) => {
            touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
          }}
          onTouchEnd={(e) => {
            const s = touch.current;
            touch.current = null;
            if (!s) return;
            const dx = e.changedTouches[0].clientX - s.x;
            const dy = e.changedTouches[0].clientY - s.y;
            if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) setMonth((m) => shiftMonth(m, dx < 0 ? 1 : -1));
          }}
        >
          <div className="grid grid-cols-7 pb-1" aria-hidden>
            {labels.map((l, i) => (
              <span key={i} className="text-center text-xs uppercase text-c-subtle">
                {l}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-y-1" role="group" data-cal-grid aria-label={fmtMonth(month, locale)}>
            {cells.map((ymd, i) =>
              ymd ? (
                <DayCell
                  key={ymd}
                  ymd={ymd}
                  day={view.day(ymd)}
                  log={view.log(ymd)}
                  isPeriod={view.isPeriod(ymd)}
                  isToday={ymd === today}
                  isFuture={ymd > today}
                  pending={view.isPending(ymd)}
                  label={(() => {
                    const k = kindLabelKey(view.day(ymd), view.isPeriod(ymd));
                    return `${fmtDate(ymd, locale, { weekday: "long", day: "numeric", month: "long" })}${k ? `: ${t(k)}` : ""}`;
                  })()}
                  onClick={() => {
                    if (editMode && ymd <= today) void toggle(ymd);
                    else if (editMode) ui.toast(t("errors.futureDate"));
                    else setOpen(ymd);
                  }}
                />
              ) : (
                <span key={`e${i}`} />
              ),
            )}
          </div>
        </div>
      </Card>
      <Legend />
      <DaySheet ymd={open} onClose={() => setOpen(null)} onToggle={toggle} />
    </Screen>
  );
}

function DaySheet({ ymd, onClose, onToggle }: { ymd: Ymd | null; onClose: () => void; onToggle: (ymd: Ymd) => Promise<void> }) {
  const t = useTranslations("cab");
  const locale = useLocale();
  const router = useRouter();
  const view = useCycleView();
  const ui = useUI();
  if (!ymd) return <Sheet open={false} onClose={onClose} title="" labelClose="">{null}</Sheet>;
  const future = ymd > view.today;
  const day = view.day(ymd);
  const log = view.log(ymd);
  const isPeriod = view.isPeriod(ymd);
  const kind = kindLabelKey(day, isPeriod);
  const fertile = day?.kind === "fertile" || day?.kind === "ovulation";

  return (
    <Sheet open onClose={onClose} title={fmtDate(ymd, locale, { weekday: "long", day: "numeric", month: "long" })} labelClose={t("common.close")}>
      {kind ? (
        <p className="mb-3 text-sm text-c-muted">
          {t(kind)}
          {day?.predicted && !isPeriod ? ` · ${t("common.forecast")}` : ""}
        </p>
      ) : null}
      {fertile ? <p className="mb-3 text-xs text-c-subtle">{t("common.notContraception")}</p> : null}

      {future ? (
        <p className="rounded-2xl bg-c-raised p-4 text-sm text-c-muted">{t("calendar.futureReadOnly")}</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-c-period-soft px-4">
            <Switch checked={isPeriod} onChange={() => void onToggle(ymd)} label={t("day.periodThisDay")} />
          </div>
          <div>
            <p className="mb-2 text-sm text-c-muted">{t("day.flow")}</p>
            <div className="flex flex-wrap gap-2">
              {FLOWS.map((f) => (
                <Chip
                  key={f}
                  tone="period"
                  on={log?.flow === f}
                  onClick={() => void ui.exec({ type: "dayLog", ymd, patch: { flow: log?.flow === f ? null : f } }, t("common.saved"))}
                >
                  {t(`flow.${f}`)}
                </Chip>
              ))}
            </div>
          </div>
          {log && (log.pain != null || log.hasSex || log.hasWellbeingMarks || log.hasActivityMarks) ? (
            <p className="text-sm text-c-muted">
              {[
                log.pain != null ? t("day.painValue", { value: log.pain }) : null,
                log.hasSex ? t("day.sexShort") : null,
                log.hasWellbeingMarks || log.hasActivityMarks ? t("today.hasMarks") : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
          <Button
            variant="outline"
            block
            onClick={() => {
              setSelectedDay(ymd);
              onClose();
              router.push("/app/day");
            }}
          >
            <PenLine className="h-4 w-4" aria-hidden />
            {t("calendar.moreDetails")}
          </Button>
        </div>
      )}
    </Sheet>
  );
}
