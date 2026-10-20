"use client";

import { useMemo } from "react";
import type { CalendarDay, CycleResponse, DayLog, Ymd } from "../api/types";
import { localToday } from "../lib/dates";
import { useCabinet } from "./hooks";

export type CycleView = {
  cycle: CycleResponse | null;
  today: Ymd;
  day: (ymd: Ymd) => CalendarDay | undefined;
  log: (ymd: Ymd) => DayLog | undefined;
  /** Logged period on this day, including a not-yet-sent change from the outbox. */
  isPeriod: (ymd: Ymd) => boolean;
  /** True while a change of this day waits in the offline queue. */
  isPending: (ymd: Ymd) => boolean;
};

export function useCycleView(): CycleView {
  const { cycle, me, pending } = useCabinet();
  return useMemo(() => {
    const days = new Map((cycle?.calendar.days ?? []).map((d) => [d.ymd, d]));
    const logs = new Map((cycle?.dayLogs ?? []).map((d) => [d.ymd, d]));
    const queued = new Map<Ymd, boolean>();
    for (const p of pending) if (p.cmd.type === "dayPeriod") queued.set(p.cmd.ymd, p.cmd.isPeriod);
    const today = cycle?.today ?? localToday(me?.timezone);
    return {
      cycle,
      today,
      day: (y) => days.get(y),
      log: (y) => logs.get(y),
      isPeriod: (y) => {
        const q = queued.get(y);
        if (q !== undefined) return q;
        const d = days.get(y);
        return !!d && d.kind === "period" && !d.predicted;
      },
      isPending: (y) => queued.has(y),
    };
  }, [cycle, me?.timezone, pending]);
}

let selected: Ymd | null = null;
const KEY = "sana-selected-day";

/** The day opened in /app/day. Kept out of the URL on purpose (privacy). */
export function setSelectedDay(ymd: Ymd) {
  selected = ymd;
  try {
    sessionStorage.setItem(KEY, ymd);
  } catch {
    /* ignore */
  }
}

export function getSelectedDay(): Ymd | null {
  if (selected) return selected;
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
