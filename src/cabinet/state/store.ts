"use client";

import {
  ApiError,
  NetworkError,
  api,
  commandRequest,
  rawRequest,
  returnsCycle,
  type Command,
} from "../api/client";
import type { CycleResponse, Me, NeedsConfirmationDetails, Symptom, Ymd } from "../api/types";
import { addDays, defaultRange, diffDays, localToday } from "../lib/dates";
import { loadSecure, saveSecure, wipeSecure } from "../lib/secureStore";

export type AuthState = "unknown" | "authed" | "anon";

export type OutboxItem = { id: string; cmd: Command; createdAt: number };

export type Snapshot = {
  auth: AuthState;
  me: Me | null;
  cycle: CycleResponse | null;
  online: boolean;
  syncing: boolean;
  /** Server not reachable on the last attempt (offline or API down). */
  unreachable: boolean;
  lastSyncedAt: number | null;
  pending: OutboxItem[];
  /** A queued "period start" came back with 409 needs_confirmation on replay. */
  replayConflict: { item: OutboxItem; details: NeedsConfirmationDetails } | null;
  /** Count of queued commands the server refused on replay (shown once). */
  droppedOnReplay: number;
  symptoms: Record<Ymd, Symptom[]>;
  /** Onboarding finished or skipped on this device (see needsOnboarding). */
  onboarded: boolean;
};

export type RunResult =
  | { status: "done"; before: CycleResponse | null; after: CycleResponse | null; data: unknown }
  | { status: "queued"; item: OutboxItem };

const POLL_MS = 30_000;
const CACHE_KEY = "snapshot.v1";
const OUTBOX_KEY = "outbox.v1";

type Persisted = {
  me: Me | null;
  cycle: CycleResponse | null;
  etag: string | null;
  symptoms: Record<Ymd, Symptom[]>;
  onboarded?: boolean;
};

function uid(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

class CabinetStore {
  private snap: Snapshot = {
    auth: "unknown",
    me: null,
    cycle: null,
    online: true,
    syncing: false,
    unreachable: false,
    lastSyncedAt: null,
    pending: [],
    replayConflict: null,
    droppedOnReplay: 0,
    symptoms: {},
    onboarded: false,
  };
  private etag: string | null = null;
  private range: { from: Ymd; to: Ymd } | null = null;
  private listeners = new Set<() => void>();
  private started = false;
  private flushing: Promise<void> | null = null;
  private refreshing: Promise<void> | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getSnapshot = () => this.snap;
  getServerSnapshot = () => this.snap;

  private set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  private persist() {
    const p: Persisted = {
      me: this.snap.me,
      cycle: this.snap.cycle,
      etag: this.etag,
      symptoms: this.snap.symptoms,
      onboarded: this.snap.onboarded,
    };
    void saveSecure(CACHE_KEY, p);
  }

  private persistOutbox() {
    void saveSecure(OUTBOX_KEY, this.snap.pending);
  }

  /** Called once by the provider in the browser. */
  async start() {
    if (this.started) return;
    this.started = true;
    this.set({ online: typeof navigator === "undefined" ? true : navigator.onLine });

    const [cached, outbox] = await Promise.all([
      loadSecure<Persisted>(CACHE_KEY),
      loadSecure<OutboxItem[]>(OUTBOX_KEY),
    ]);
    if (cached?.me) {
      this.etag = cached.etag;
      for (const [d, rows] of Object.entries(cached.symptoms ?? {})) this.rememberIds(d, rows);
      this.set({
        me: cached.me,
        cycle: cached.cycle,
        symptoms: cached.symptoms ?? {},
        onboarded: !!cached.onboarded,
        auth: "authed",
      });
    }
    if (outbox?.length) this.set({ pending: outbox });

    this.attachListeners();
    await this.checkSession();
  }

  private attachListeners() {
    const onVisible = () => {
      if (document.visibilityState === "visible") void this.wake();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", () => void this.wake());
    window.addEventListener("online", () => {
      this.set({ online: true });
      void this.wake();
    });
    window.addEventListener("offline", () => this.set({ online: false }));
    this.pollTimer = setInterval(() => {
      if (document.visibilityState === "visible") void this.pollVersion();
    }, POLL_MS);
  }

  /** Focus/visible/online: replay the queue, then refetch (ETag makes it cheap). */
  private async wake() {
    if (this.snap.auth !== "authed") {
      if (this.snap.auth === "unknown") await this.checkSession();
      return;
    }
    await this.flush();
    await this.refresh();
  }

  async checkSession() {
    try {
      const { user } = await api.session();
      this.set({ me: user, auth: "authed", unreachable: false });
      await this.flush();
      await this.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        // Session expired: keep the encrypted cache and unsent changes until the
        // next sign-in (wiped if a different account signs in, or on logout).
        this.set({ auth: "anon" });
      } else {
        // Offline / API down: keep the cached session if there is one.
        this.set({ unreachable: true, auth: this.snap.me ? "authed" : "anon" });
      }
    }
  }

  /** After any successful login or account link. */
  async signedIn(user: Me) {
    if (this.snap.me && this.snap.me.id !== user.id) {
      // Different account on this device: never mix cached data.
      await wipeSecure();
      this.etag = null;
      this.set({ cycle: null, symptoms: {}, pending: [], onboarded: false });
    }
    this.set({ me: user, auth: "authed", unreachable: false });
    this.persist();
    await this.flush();
    await this.refresh({ force: true });
  }

  markOnboarded() {
    this.set({ onboarded: true });
    this.persist();
  }

  setMe(user: Me) {
    this.set({ me: user });
    this.persist();
  }

  private handleAuthError(e: unknown): boolean {
    if (e instanceof ApiError && e.status === 401) {
      this.set({ auth: "anon" });
      return true;
    }
    return false;
  }

  private applyCycle(c: CycleResponse, etag: string | null) {
    this.etag = etag;
    this.set({ cycle: c, lastSyncedAt: Date.now(), unreachable: false });
    this.persist();
  }

  /** Make sure the cached range covers [from, to] (calendar navigation). */
  async ensureRange(from: Ymd, to: Ymd) {
    const cal = this.snap.cycle?.calendar;
    if (cal && cal.from <= from && cal.to >= to) return;
    const base = this.range ?? (cal ? { from: cal.from, to: cal.to } : defaultRange(localToday(this.snap.me?.timezone)));
    let nf = from < base.from ? from : base.from;
    let nt = to > base.to ? to : base.to;
    // The API allows at most 550 days: keep the side the user is looking at.
    if (diffDays(nt, nf) > 540) {
      if (from < base.from) nt = addDays(nf, 540);
      else nf = addDays(nt, -540);
    }
    this.range = { from: nf, to: nt };
    await this.refresh({ force: true });
  }

  async refresh(opts: { force?: boolean } = {}) {
    if (this.snap.auth === "anon") return;
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      this.set({ syncing: true });
      try {
        const r = await api.cycle(this.range, opts.force ? null : this.etag);
        if (r.status === 304 || !r.data) {
          this.set({ lastSyncedAt: Date.now(), unreachable: false });
        } else {
          this.applyCycle(r.data, r.etag);
        }
      } catch (e) {
        if (!this.handleAuthError(e)) this.set({ unreachable: true });
      } finally {
        this.set({ syncing: false });
        this.refreshing = null;
      }
    })();
    return this.refreshing;
  }

  /** Cheap version check every 30 s while visible; refetch only on change or a new day. */
  private async pollVersion() {
    if (this.snap.auth !== "authed") return;
    if (this.snap.pending.length) await this.flush();
    try {
      const v = await api.syncVersion();
      const c = this.snap.cycle;
      // The ETag includes "today": refetch after midnight so predictions move on.
      const today = v.today ?? (c ? localToday(c.settings.timezone ?? this.snap.me?.timezone) : null);
      const dayChanged = c ? today !== c.today : true;
      if (!c || v.version !== c.version || dayChanged) {
        await this.refresh();
        await this.reloadOpenSymptoms();
      } else {
        this.set({ lastSyncedAt: Date.now(), unreachable: false });
      }
    } catch (e) {
      if (!this.handleAuthError(e)) this.set({ unreachable: true });
    }
  }

  // ---------------------------------------------------------------- commands

  /**
   * Sends a command. Offline (or while older commands are queued) it is put in
   * the outbox and replayed in order later. API errors are thrown to the caller
   * (e.g. 409 needs_confirmation, 422 future_date).
   */
  async run(cmd: Command): Promise<RunResult> {
    if (this.snap.pending.length > 0 || !this.snap.online) {
      const item = this.enqueue(cmd);
      void this.flush();
      return { status: "queued", item };
    }
    const before = this.snap.cycle;
    try {
      const data = await this.send(cmd);
      return { status: "done", before, after: this.snap.cycle, data };
    } catch (e) {
      if (e instanceof NetworkError) {
        this.set({ unreachable: true });
        const item = this.enqueue(cmd);
        return { status: "queued", item };
      }
      this.handleAuthError(e);
      throw e;
    }
  }

  private async send(cmd: Command): Promise<unknown> {
    const { path, opts } = commandRequest(cmd, this.range);
    const r = await rawRequest<unknown>(path, opts);
    if (returnsCycle(cmd) && r.data) {
      // Mutation bodies carry the new state (and its ETag).
      this.applyCycle(r.data as CycleResponse, r.etag);
    }
    if (cmd.type === "symptomUpsert" || cmd.type === "symptomDelete") {
      this.afterSymptomWrite(cmd, r.data);
    }
    return r.data;
  }

  private enqueue(cmd: Command): OutboxItem {
    const item: OutboxItem = { id: uid(), cmd, createdAt: Date.now() };
    this.set({ pending: [...this.snap.pending, item] });
    this.persistOutbox();
    return item;
  }

  /** Removes a queued command that has not been sent yet (undo while offline). */
  cancelQueued(id: string): boolean {
    const exists = this.snap.pending.some((p) => p.id === id);
    if (!exists) return false;
    this.set({ pending: this.snap.pending.filter((p) => p.id !== id) });
    this.persistOutbox();
    return true;
  }

  async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (!this.snap.pending.length || this.snap.replayConflict || this.snap.auth !== "authed") return;
    this.flushing = (async () => {
      try {
        while (this.snap.pending.length) {
          const item = this.snap.pending[0];
          try {
            await this.send(item.cmd);
          } catch (e) {
            if (e instanceof NetworkError) {
              this.set({ unreachable: true });
              return;
            }
            if (this.handleAuthError(e)) return;
            if (e instanceof ApiError && e.code === "needs_confirmation") {
              this.set({ replayConflict: { item, details: e.details as NeedsConfirmationDetails } });
              return;
            }
            if (e instanceof ApiError && (e.status >= 500 || e.status === 429)) return; // retry later
            // 4xx: the command can no longer apply (e.g. future_date after a timezone change).
            this.set({ droppedOnReplay: this.snap.droppedOnReplay + 1 });
          }
          this.set({ pending: this.snap.pending.filter((p) => p.id !== item.id) });
          this.persistOutbox();
        }
        this.set({ unreachable: false });
      } finally {
        this.flushing = null;
      }
    })();
    return this.flushing;
  }

  /** User answered the needs_confirmation dialog for a queued command. */
  async resolveReplayConflict(choice: "continuation" | "spotting" | "new_cycle" | "discard") {
    const c = this.snap.replayConflict;
    if (!c) return;
    let pending = this.snap.pending;
    if (choice === "discard") pending = pending.filter((p) => p.id !== c.item.id);
    else
      pending = pending.map((p) =>
        p.id === c.item.id && p.cmd.type === "periodStart" ? { ...p, cmd: { ...p.cmd, as: choice } } : p,
      );
    this.set({ pending, replayConflict: null });
    this.persistOutbox();
    await this.flush();
  }

  ackDropped() {
    this.set({ droppedOnReplay: 0 });
  }

  // ---------------------------------------------------------------- symptoms

  private openSymptomDays = new Set<Ymd>();

  async loadSymptoms(ymd: Ymd) {
    this.openSymptomDays.add(ymd);
    try {
      const r = await api.symptoms(ymd);
      // Keep optimistic rows that are still being written or wait in the outbox.
      const busy = (c: string, k: string) => (this.symInFlight.get(this.symKey(ymd, c, k)) ?? 0) > 0;
      const local = (this.snap.symptoms[ymd] ?? []).filter((s) => busy(s.category, s.key));
      const queued = this.queuedSymptomRows(ymd).filter((q) => !busy(q.category, q.key));
      const mine = [...local, ...queued];
      const server = (r.symptoms ?? []).filter(
        (s) => !busy(s.category, s.key) && !mine.some((q) => q.category === s.category && q.key === s.key),
      );
      this.rememberIds(ymd, r.symptoms ?? []);
      this.setSymptoms(ymd, [...server, ...mine.filter((q) => q.value !== null && q.value !== "")]);
    } catch (e) {
      this.handleAuthError(e);
    }
  }

  closeSymptoms(ymd: Ymd) {
    this.openSymptomDays.delete(ymd);
  }

  private async reloadOpenSymptoms() {
    await Promise.all([...this.openSymptomDays].map((d) => this.loadSymptoms(d)));
  }

  private queuedSymptomRows(ymd: Ymd): Symptom[] {
    const rows: Symptom[] = [];
    for (const p of this.snap.pending) {
      if (p.cmd.type === "symptomUpsert" && p.cmd.date === ymd) {
        const c = p.cmd;
        const i = rows.findIndex((r) => r.category === c.category && r.key === c.key);
        const row: Symptom = {
          id: c.tempId ?? `tmp-${p.id}`,
          date: ymd,
          category: c.category,
          key: c.key,
          value: c.value,
          createdAt: "",
          updatedAt: "",
        };
        if (i >= 0) rows[i] = row;
        else rows.push(row);
      }
    }
    return rows;
  }

  private setSymptoms(ymd: Ymd, list: Symptom[]) {
    this.set({ symptoms: { ...this.snap.symptoms, [ymd]: list } });
    this.persist();
  }

  /** Known server ids per day/category/key, needed for DELETE /api/symptoms/:id. */
  private symIds = new Map<string, string>();
  /** Writes per key run one after another, so quick taps reach the server in order. */
  private symChain = new Map<string, Promise<void>>();
  private symInFlight = new Map<string, number>();

  private symKey(ymd: Ymd, category: string, key: string) {
    return `${ymd}|${category}|${key}`;
  }

  private rememberIds(ymd: Ymd, rows: Symptom[]) {
    for (const r of rows) if (!r.id.startsWith("tmp-")) this.symIds.set(this.symKey(ymd, r.category, r.key), r.id);
  }

  private afterSymptomWrite(cmd: Command, data: unknown) {
    if (cmd.type === "symptomUpsert") {
      const k = this.symKey(cmd.date, cmd.category, cmd.key);
      const row = (data as { symptom?: Symptom } | null)?.symptom;
      if (row) this.symIds.set(k, row.id);
      const newer = (this.symInFlight.get(k) ?? 0) > 1;
      const list = this.snap.symptoms[cmd.date] ?? [];
      if (newer) {
        // A newer value for this key is on its way: keep it, only adopt the real id.
        if (row) this.setSymptoms(cmd.date, list.map((s) => (s.category === cmd.category && s.key === cmd.key ? { ...s, id: row.id } : s)));
      } else {
        const rest = list.filter((s) => !(s.category === cmd.category && s.key === cmd.key));
        if (row && row.value !== null && row.value !== "") rest.push(row);
        this.setSymptoms(cmd.date, rest);
      }
    }
    if (cmd.type === "symptomDelete") {
      for (const [k, v] of this.symIds) if (v === cmd.id) this.symIds.delete(k);
    }
    // Calendar dots (hasWellbeingMarks) are computed on the server: refetch.
    this.scheduleRefresh();
  }

  private refreshTimer: ReturnType<typeof setTimeout> | null = null;
  private scheduleRefresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(() => void this.refresh(), 1200);
  }

  /** Set (value != null) or remove a symptom value: optimistic, ordered per key, queue-aware. */
  setSymptom(ymd: Ymd, category: string, key: string, value: string | null): Promise<void> {
    const k = this.symKey(ymd, category, key);
    const list = this.snap.symptoms[ymd] ?? [];
    const existing = list.find((s) => s.category === category && s.key === key);
    const rest = list.filter((s) => s !== existing);
    const remove = value === null || value === "";
    const tempId = `tmp-${uid()}`;
    if (remove) this.setSymptoms(ymd, rest);
    else
      this.setSymptoms(ymd, [
        ...rest,
        { id: existing?.id ?? tempId, date: ymd, category, key, value, createdAt: existing?.createdAt ?? "", updatedAt: "" },
      ]);

    this.symInFlight.set(k, (this.symInFlight.get(k) ?? 0) + 1);
    const job = (this.symChain.get(k) ?? Promise.resolve())
      .catch(() => undefined)
      .then(async () => {
        try {
          if (remove) {
            const id = this.symIds.get(k);
            if (id) {
              await this.run({ type: "symptomDelete", id });
              return;
            }
            // Never reached the server: drop the queued upsert instead of sending a delete.
            const q = this.snap.pending.find(
              (p) => p.cmd.type === "symptomUpsert" && p.cmd.date === ymd && p.cmd.category === category && p.cmd.key === key,
            );
            if (q) this.cancelQueued(q.id);
            return;
          }
          await this.run({ type: "symptomUpsert", date: ymd, category, key, value, tempId: this.symIds.has(k) ? undefined : tempId });
        } catch (e) {
          // Roll back to the server state of the day.
          void this.loadSymptoms(ymd);
          throw e;
        } finally {
          this.symInFlight.set(k, (this.symInFlight.get(k) ?? 1) - 1);
        }
      });
    this.symChain.set(k, job);
    return job;
  }

  // ---------------------------------------------------------------- session end

  private async clearLocal() {
    await wipeSecure();
    this.etag = null;
    this.range = null;
    this.symIds.clear();
    this.set({ me: null, cycle: null, symptoms: {}, pending: [], replayConflict: null, onboarded: false });
  }

  async logout(all = false) {
    try {
      if (all) await api.logoutAll();
      else await api.logout();
    } catch {
      /* we clear locally anyway */
    }
    await this.clearLocal();
    this.set({ auth: "anon" });
  }

  /** Account deleted on the server. */
  async forget() {
    await this.clearLocal();
    this.set({ auth: "anon" });
  }

  stop() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }
}

export const store = new CabinetStore();
