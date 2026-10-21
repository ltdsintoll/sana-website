import type { Command } from "../api/client";
import type { CycleResponse, Episode, Ymd } from "../api/types";

function contains(e: Episode, d: Ymd): boolean {
  return e.startYmd <= d && (e.endYmd === null || e.endYmd >= d);
}

function restore(before: Episode | undefined, after: Episode): Command | null {
  if (!before) return { type: "periodDelete", id: after.id };
  if (before.startYmd !== after.startYmd || before.endYmd !== after.endYmd)
    return { type: "periodPatch", id: after.id, startYmd: before.startYmd, endYmd: before.endYmd };
  return null;
}

/**
 * A day tap can create a whole period (a lone past day gets the usual length, or stays ongoing until
 * today), so toggling the same day back is not always the inverse: compare the episodes instead.
 */
function dayPeriodUndo(cmd: Extract<Command, { type: "dayPeriod" }>, before: CycleResponse, after: CycleResponse): Command[] {
  const prev = new Map(before.episodes.map((e) => [e.id, e]));
  const next = new Map(after.episodes.map((e) => [e.id, e]));
  const added = after.episodes.filter((e) => !prev.has(e.id));
  const removed = before.episodes.filter((e) => !next.has(e.id));
  const changed = before.episodes.filter((b) => {
    const a = next.get(b.id);
    if (!a || (a.startYmd === b.startYmd && a.endYmd === b.endYmd)) return false;
    // Closing an ongoing period that ran past its length happens on any write; not part of this tap.
    return !(b.endYmd === null && a.source === "auto_closed" && !contains(a, cmd.ymd));
  });
  if (!added.length && !removed.length && !changed.length) return [];
  if (cmd.isPeriod && added.length === 1 && !removed.length && !changed.length) return [{ type: "periodDelete", id: added[0].id }];
  if (!cmd.isPeriod && removed.length === 1 && !added.length && !changed.length) {
    const old = removed[0];
    // Re-marking a lone day may give it the usual length: set its own end again.
    return old.endYmd === null
      ? [{ type: "dayPeriod", ymd: cmd.ymd, isPeriod: true }]
      : [{ type: "dayPeriod", ymd: cmd.ymd, isPeriod: true }, { type: "periodEnd", date: old.endYmd }];
  }
  // Extending, shortening, splitting or bridging by one day: the opposite tap restores it.
  return [{ type: "dayPeriod", ymd: cmd.ymd, isPeriod: !cmd.isPeriod }];
}

/**
 * Commands that revert a period mutation. Only the episodes touched by this
 * command (the one around its date, and a previous ongoing one it closed) are
 * restored, so changes made meanwhile in Telegram are never undone by accident.
 * Bookkeeping only: no cycle math.
 */
export function undoCommands(cmd: Command, before: CycleResponse | null, after: CycleResponse | null): Command[] {
  if (!before || !after) return [];
  const prev = new Map(before.episodes.map((e) => [e.id, e]));
  const out: Command[] = [];

  switch (cmd.type) {
    case "dayPeriod":
      return dayPeriodUndo(cmd, before, after);

    case "periodPatch": {
      const old = prev.get(cmd.id);
      const now = after.episodes.find((e) => e.id === cmd.id);
      const c = old && now ? restore(old, now) : null;
      return c ? [c] : [];
    }

    case "periodEnd": {
      const now = after.episodes.find((e) => e.endYmd === cmd.date && e.startYmd <= cmd.date);
      const c = now ? restore(prev.get(now.id), now) : null;
      return c && c.type === "periodPatch" ? [c] : [];
    }

    case "periodStart": {
      if (cmd.as === "spotting") {
        const oldLog = before.dayLogs.find((d) => d.ymd === cmd.date);
        return [{ type: "dayLog", ymd: cmd.date, patch: { flow: oldLog?.flow ?? null } }];
      }
      const now = after.episodes.find((e) => contains(e, cmd.date));
      if (now) {
        const c = restore(prev.get(now.id), now);
        if (c) out.push(c);
      }
      // A previous ongoing period that this start closed.
      for (const old of before.episodes) {
        if (old.endYmd !== null || old.id === now?.id) continue;
        const cur = after.episodes.find((e) => e.id === old.id);
        if (cur && cur.endYmd !== null) out.push({ type: "periodPatch", id: old.id, endYmd: null });
      }
      // Delete the new episode before re-opening the old one (avoids overlaps).
      return out.sort((a, b) => (a.type === "periodDelete" ? -1 : 0) - (b.type === "periodDelete" ? -1 : 0));
    }

    default:
      return [];
  }
}
