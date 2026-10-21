"use client";

import { useLocale, useTranslations } from "next-intl";
import { fmtDate, fmtRange } from "../lib/dates";
import { useCycleView } from "../state/view";
import { CycleLoading, Screen } from "../ui/layout";
import { Card } from "../ui/primitives";

export default function StatsScreen() {
  const t = useTranslations("cab");
  const locale = useLocale();
  const { cycle } = useCycleView();
  if (!cycle) return <CycleLoading />;
  const st = cycle.stats;
  const s = cycle.status;
  const maxLen = Math.max(35, ...st.history.map((h) => h.lengthDays));

  return (
    <Screen title={t("stats.title")}>
      <div className="grid grid-cols-2 gap-3">
        <Tile label={t("stats.cycleLength")} value={t("stats.days", { count: st.cycleLength })} note={t(`stats.source.${st.cycleLengthSource}`)} />
        <Tile label={t("stats.periodLength")} value={t("stats.days", { count: st.periodLength })} note={t(`stats.source.${st.periodLengthSource}`)} />
        <Tile label={t("stats.cyclesCount")} value={String(st.cyclesCount)} note={t("stats.cyclesCountNote")} />
        <Tile
          label={t("stats.range")}
          value={st.cycleLengthMin != null && st.cycleLengthMax != null ? `${st.cycleLengthMin}–${st.cycleLengthMax}` : "—"}
          note={st.irregular ? t("stats.irregular") : t("stats.regular")}
          warn={st.irregular}
        />
      </div>

      <Card className="mt-3">
        <h2 className="text-sm font-medium text-c-muted">{t("stats.next")}</h2>
        <p className="mt-1 text-xl font-light">
          {s.state === "pregnancy"
            ? t("stats.nextPregnancy")
            : s.state === "late"
              ? t("today.lateDays", { count: s.lateDays ?? 0 })
              : s.expectedWindow
                ? fmtRange(s.expectedWindow.startYmd, s.expectedWindow.endYmd, locale)
                : t("stats.nextUnknown")}
        </p>
        {s.confidence !== "none" && s.state !== "pregnancy" ? <p className="mt-1 text-sm text-c-muted">{t(`stats.confidence.${s.confidence}`)}</p> : null}
      </Card>

      <h2 className="mb-2 mt-6 px-1 text-xs font-semibold uppercase tracking-wider text-c-subtle">{t("stats.history")}</h2>
      {st.history.length === 0 ? (
        <Card>
          <p className="text-base text-c-muted">{t("stats.empty")}</p>
        </Card>
      ) : (
        <Card className="py-2">
          <ul className="divide-y divide-c-line">
            {st.history.map((h) => (
              <li key={h.startYmd} className={`py-3 ${h.excluded ? "opacity-60" : ""}`}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm text-c-ink">
                    {fmtDate(h.startYmd, locale, { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                  <span className="text-sm tabular-nums text-c-muted">
                    {t("stats.days", { count: h.lengthDays })} · {t("stats.periodDays", { count: h.periodDays })}
                  </span>
                </div>
                <div className="mt-2 flex h-2.5 w-full overflow-hidden rounded-full bg-c-raised" aria-hidden>
                  <span className="h-full rounded-l-full bg-c-period" style={{ width: `${(h.periodDays / maxLen) * 100}%` }} />
                  <span className="ml-0.5 h-full rounded-r-full bg-c-accent/60" style={{ width: `${((h.lengthDays - h.periodDays) / maxLen) * 100}%` }} />
                </div>
                {h.excluded && h.excludedReason ? <p className="mt-1 text-xs text-c-subtle">{t(`stats.excluded.${h.excludedReason}`)}</p> : null}
              </li>
            ))}
          </ul>
          <p className="flex items-center gap-4 pb-2 pt-1 text-xs text-c-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-c-period" aria-hidden /> {t("kind.period")}
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-c-accent/60" aria-hidden /> {t("stats.restOfCycle")}
            </span>
          </p>
        </Card>
      )}
      <p className="mt-4 px-1 text-xs text-c-subtle">{t("stats.serverNote")}</p>
    </Screen>
  );
}

function Tile({ label, value, note, warn }: { label: string; value: string; note: string; warn?: boolean }) {
  return (
    <Card>
      <p className="text-sm text-c-muted">{label}</p>
      <p className="mt-1 text-2xl font-light tabular-nums text-c-ink">{value}</p>
      <p className={`mt-1 text-xs ${warn ? "text-c-late" : "text-c-subtle"}`}>{note}</p>
    </Card>
  );
}
