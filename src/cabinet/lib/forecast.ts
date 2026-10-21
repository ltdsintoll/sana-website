// Wording of the "Next period" forecast. How precisely the day is known comes from the API
// (CycleStatus.forecastPrecision, v1.5): steady cycles name the day, a short or varying history
// says "about", an irregular cycle shows a band of days and never "expected today".
// Same rules as the Mini App and the bot texts. No cycle calculations here.

import type { CycleStatus, PartnerView } from "../api/types";
import { diffDays, fmtDate } from "./dates";

type T = (key: string, values?: Record<string, string | number>) => string;

export function expectedHeadline(s: CycleStatus, t: T, locale: string): { big: string; sub: string | null } {
  const days = s.daysUntilExpected ?? 0;
  const band = s.forecastPrecision === "range" ? s.expectedStartRange ?? null : null;
  if (band && band.startYmd < band.endYmd) {
    const min = diffDays(band.startYmd, s.today);
    const max = diffDays(band.endYmd, s.today);
    if (min > 0) {
      return {
        big: t("today.inDaysRange", { min, count: max }),
        sub: t("today.rangeDates", { from: fmtDate(band.startYmd, locale), to: fmtDate(band.endYmd, locale) }),
      };
    }
    if (max > 0) return { big: t("today.anyDayNow"), sub: t("today.untilDate", { date: fmtDate(band.endYmd, locale) }) };
    return { big: t("today.expectedTodayApprox"), sub: null };
  }
  if (s.forecastPrecision === "approximate" || s.forecastPrecision === "range") {
    return {
      big: days === 0 ? t("today.expectedTodayApprox") : t("today.inDaysApprox", { count: days }),
      sub: s.expectedStartYmd ? t("today.aroundDate", { date: fmtDate(s.expectedStartYmd, locale) }) : null,
    };
  }
  return {
    big: days === 0 ? t("today.expectedToday") : t("today.inDays", { count: days }),
    sub: s.expectedStartYmd ? fmtDate(s.expectedStartYmd, locale, { weekday: "long", day: "numeric", month: "long" }) : null,
  };
}

/** "Was expected on ..." of a late period; for an irregular cycle, the end of the band. */
export function lateSubline(s: CycleStatus, t: T, locale: string): string | null {
  if (!s.expectedStartYmd) return null;
  return s.forecastPrecision === "range"
    ? t("today.wasExpectedRange", { date: fmtDate(s.expectedStartYmd, locale) })
    : t("today.wasExpected", { date: fmtDate(s.expectedStartYmd, locale) });
}

/** Partner card headline while a period is expected (PartnerView.periodForecast, v1.5). `t` is scoped to partnerView. */
export function partnerExpected(v: PartnerView, t: T): string {
  const d = v.daysUntilPeriod ?? 0;
  const f = v.periodForecast ?? null;
  if (f?.precision === "range" && f.minDays < f.maxDays) {
    return f.minDays > 0 ? t("inDaysRange", { min: f.minDays, count: f.maxDays }) : t("anyDayNow");
  }
  if (f?.precision === "approximate" || f?.precision === "range") return d === 0 ? t("expectedTodayApprox") : t("inDaysApprox", { count: d });
  return d === 0 ? t("expectedToday") : t("inDays", { count: d });
}
