"use client";

import { ChevronDown, ChevronLeft, ChevronRight, Minus, Plus, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import type { Flow, Symptom, Ymd } from "../api/types";
import { LIBIDO, NOTES, SEX, SYMPTOM_SECTIONS, TEMP, WATER, WEIGHT, type SymptomSection } from "../lib/catalog";
import { addDays, fmtDate, isYmd } from "../lib/dates";
import { useCabinet } from "../state/hooks";
import { store } from "../state/store";
import { getSelectedDay, setSelectedDay, useCycleView } from "../state/view";
import { RequireAuth, Screen, SyncPill } from "../ui/layout";
import { Button, Card, Chip, Switch } from "../ui/primitives";
import { useUI } from "../ui/ui-context";

const FLOWS: Flow[] = ["spotting", "light", "normal", "heavy"];

export default function DayLogScreen() {
  return (
    <RequireAuth>
      <DayLog />
    </RequireAuth>
  );
}

function DayLog() {
  const t = useTranslations("cab");
  const locale = useLocale();
  const router = useRouter();
  const view = useCycleView();
  const { today } = view;
  const [picked, setYmd] = useState<Ymd>(() => {
    const s = getSelectedDay();
    return isYmd(s) && s <= today ? s : today;
  });
  const ymd = picked > today ? today : picked; // never log future days

  useEffect(() => {
    setSelectedDay(ymd);
    void store.loadSymptoms(ymd);
    return () => store.closeSymptoms(ymd);
  }, [ymd]);

  const go = (n: number) => setYmd((d) => (addDays(d, n) > today ? d : addDays(d, n)));

  return (
    <Screen tabbar={false}>
      <header className="sticky top-0 z-30 -mx-4 mb-2 bg-c-bg/95 px-2 pb-1 backdrop-blur">
        <div className="flex min-h-14 items-center justify-between">
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? router.back() : router.push("/app/today"))}
            aria-label={t("common.close")}
            className="flex h-12 w-12 items-center justify-center rounded-full active:bg-c-raised"
          >
            <X className="h-6 w-6" />
          </button>
          <p className="text-sm text-c-subtle">{t("day.title")}</p>
          <span className="flex w-12 justify-end">
            <SyncPill />
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => go(-1)} aria-label={t("day.prevDay")} className="flex h-12 w-12 items-center justify-center rounded-full bg-c-card active:bg-c-raised">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h1 className="truncate text-lg font-medium first-letter:uppercase">{fmtDate(ymd, locale, { weekday: "long", day: "numeric", month: "long" })}</h1>
            {ymd === today ? <p className="text-xs text-c-accent">{t("common.today")}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => go(1)}
            disabled={ymd >= today}
            aria-label={t("day.nextDay")}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-c-card active:bg-c-raised disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </header>
      <DayForm key={ymd} ymd={ymd} />
      <div className="mt-6">
        <Button variant="primary" size="lg" block onClick={() => router.push("/app/today")}>
          {t("common.done")}
        </Button>
      </div>
    </Screen>
  );
}

function DayForm({ ymd }: { ymd: Ymd }) {
  const t = useTranslations("cab");
  const ui = useUI();
  const view = useCycleView();
  const { symptoms } = useCabinet();
  const rows: Symptom[] = symptoms[ymd] ?? [];
  const log = view.log(ymd);
  const isPeriod = view.isPeriod(ymd);

  const value = (category: string, key: string) => rows.find((r) => r.category === category && r.key === key)?.value ?? null;
  const on = (category: string, key: string) => {
    const v = value(category, key);
    return v !== null && v !== "";
  };

  const setSym = useCallback(
    async (category: string, key: string, v: string | null) => {
      try {
        await store.setSymptom(ymd, category, key, v);
      } catch {
        ui.toast(t("errors.generic"), { tone: "error" });
      }
    },
    [ymd, ui, t],
  );

  const exclusive = async (category: string, keys: readonly string[], chosen: string) => {
    if (on(category, chosen)) return setSym(category, chosen, null);
    // Remove the other answers (instead of storing empty rows), then set the chosen one.
    for (const k of keys) if (k !== chosen && on(category, k)) await setSym(category, k, null);
    await setSym(category, chosen, "1");
  };

  const dayLog = (patch: { flow?: Flow | null; pain?: number | null; hasSex?: boolean; sexNote?: string | null }) =>
    ui.exec({ type: "dayLog", ymd, patch }, t("common.saved"));

  async function setSex(v: boolean) {
    await dayLog(v ? { hasSex: true } : { hasSex: false, sexNote: null });
    if (!v) {
      // Turning "had sex" off also clears protection/type, keeps desire.
      for (const k of [...SEX.protection, ...SEX.type]) if (on(SEX.category, k)) await setSym(SEX.category, k, null);
    }
  }

  async function clearDay() {
    const ok = await ui.confirm({ title: t("day.clearTitle"), body: t("day.clearBody"), confirmLabel: t("day.clearConfirm"), danger: true });
    if (!ok) return;
    await ui.exec({ type: "dayClear", ymd }, t("day.cleared"));
    for (const r of rows) await setSym(r.category, r.key, null);
  }

  const water = Math.max(0, parseInt(value(WATER.category, WATER.key) ?? "0", 10) || 0);
  // Read the latest optimistic value at tap time so quick repeated taps add up.
  const addWater = (delta: number) => {
    const rowsNow = store.getSnapshot().symptoms[ymd] ?? [];
    const cur = Math.max(0, parseInt(rowsNow.find((r) => r.category === WATER.category && r.key === WATER.key)?.value ?? "0", 10) || 0);
    const next = Math.min(6000, Math.max(0, cur + delta));
    void setSym(WATER.category, WATER.key, next > 0 ? String(next) : null);
  };

  return (
    <div className="flex flex-col gap-3">
      <Card>
        <h2 className="mb-1 text-base font-medium">{t("day.periodSection")}</h2>
        <Switch checked={isPeriod} label={t("day.periodThisDay")} onChange={(v) => void ui.exec({ type: "dayPeriod", ymd, isPeriod: v }, v ? t("day.periodOn") : t("day.periodOff"))} />
        <p className="mb-2 mt-3 text-sm text-c-muted">{t("day.flow")}</p>
        <div className="flex flex-wrap gap-2">
          {FLOWS.map((f) => (
            <Chip key={f} tone="period" on={log?.flow === f} onClick={() => void dayLog({ flow: log?.flow === f ? null : f })}>
              {t(`flow.${f}`)}
            </Chip>
          ))}
        </div>
        <p className="mt-2 text-xs text-c-subtle">{t("day.flowHint")}</p>
        <PainSlider value={log?.pain ?? null} onCommit={(v) => void dayLog({ pain: v })} />
      </Card>

      {SYMPTOM_SECTIONS.filter((s) => s.group === "wellbeing").map((s, i) => (
        <SectionCard key={s.id} section={s} defaultOpen={i < 3} on={on} onToggle={(c, k) => void (s.exclusive ? exclusive(c, s.chips.map((x) => x.key), k) : setSym(c, k, on(c, k) ? null : "1"))} />
      ))}

      <Card>
        <h2 className="mb-1 text-base font-medium">{t("symptoms.sections.intimacy")}</h2>
        <Switch checked={!!log?.hasSex} label={t("day.hadSex")} onChange={(v) => void setSex(v)} />
        {log?.hasSex ? (
          <div className="mt-2 flex flex-col gap-3">
            <ChipRow title={t("day.protection")}>
              {SEX.protection.map((k) => (
                <Chip key={k} on={on(SEX.category, k)} onClick={() => void exclusive(SEX.category, SEX.protection, k)}>
                  {t(`day.sex_${k}`)}
                </Chip>
              ))}
            </ChipRow>
            <ChipRow title={t("day.sexType")}>
              {SEX.type.map((k) => (
                <Chip key={k} on={on(SEX.category, k)} onClick={() => void exclusive(SEX.category, SEX.type, k)}>
                  {t(`day.sex_${k}`)}
                </Chip>
              ))}
            </ChipRow>
            <TextField
              label={t("day.sexNote")}
              initial={log?.sexNote ?? ""}
              multiline
              onSave={(v) => void dayLog({ sexNote: v || null })}
            />
          </div>
        ) : null}
        <ChipRow title={t("day.libido")} className="mt-3">
          {[1, 2, 3, 4, 5].map((n) => (
            <Chip key={n} on={value(LIBIDO.category, LIBIDO.key) === String(n)} onClick={() => void setSym(LIBIDO.category, LIBIDO.key, value(LIBIDO.category, LIBIDO.key) === String(n) ? null : String(n))}>
              {t(`day.libido${n}`)}
            </Chip>
          ))}
        </ChipRow>
      </Card>

      {SYMPTOM_SECTIONS.filter((s) => s.group !== "wellbeing").map((s) => (
        <SectionCard key={s.id} section={s} defaultOpen={s.id === "activity"} on={on} onToggle={(c, k) => void (s.exclusive ? exclusive(c, s.chips.map((x) => x.key), k) : setSym(c, k, on(c, k) ? null : "1"))} />
      ))}

      <Card>
        <h2 className="mb-2 text-base font-medium">{t("symptoms.sections.water")}</h2>
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            aria-label={t("day.waterLess")}
            disabled={water <= 0}
            onClick={() => addWater(-250)}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-c-raised disabled:opacity-40"
          >
            <Minus className="h-5 w-5" />
          </button>
          <output className="text-2xl font-light tabular-nums" aria-live="polite">
            {t("day.waterValue", { ml: water })}
          </output>
          <button
            type="button"
            aria-label={t("day.waterMore")}
            onClick={() => addWater(250)}
            className="flex h-12 w-12 items-center justify-center rounded-2xl bg-c-accent-soft text-c-accent"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </Card>

      <Card className="grid grid-cols-2 gap-3">
        <TextField
          label={t("day.weight")}
          initial={value(WEIGHT.category, WEIGHT.key) ?? ""}
          inputMode="decimal"
          validate={(v) => v === "" || (/^\d{2,3}([.,]\d{1,2})?$/.test(v) && +v.replace(",", ".") >= 25 && +v.replace(",", ".") <= 300)}
          onSave={(v) => void setSym(WEIGHT.category, WEIGHT.key, v ? v.replace(",", ".") : null)}
        />
        <TextField
          label={t("day.temperature")}
          initial={value(TEMP.category, TEMP.key) ?? ""}
          inputMode="decimal"
          validate={(v) => v === "" || (/^\d{2}([.,]\d{1,2})?$/.test(v) && +v.replace(",", ".") >= 34 && +v.replace(",", ".") <= 42)}
          onSave={(v) => void setSym(TEMP.category, TEMP.key, v ? v.replace(",", ".") : null)}
        />
      </Card>

      <Card>
        <TextField label={t("symptoms.sections.notes")} placeholder={t("day.notesPlaceholder")} initial={value(NOTES.category, NOTES.key) ?? ""} multiline onSave={(v) => void setSym(NOTES.category, NOTES.key, v || null)} />
      </Card>

      <p className="px-1 text-xs text-c-subtle">{t("day.disclaimer")}</p>
      <Button variant="danger" block onClick={() => void clearDay()}>
        {t("day.clearTitle")}
      </Button>
    </div>
  );
}

function ChipRow({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-2 text-sm text-c-muted">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function SectionCard({
  section,
  defaultOpen,
  on,
  onToggle,
}: {
  section: SymptomSection;
  defaultOpen: boolean;
  on: (c: string, k: string) => boolean;
  onToggle: (c: string, k: string) => void;
}) {
  const t = useTranslations("cab.symptoms");
  const [open, setOpen] = useState(defaultOpen);
  const count = section.chips.filter((c) => on(c.category, c.key)).length;
  return (
    <Card className="py-2">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex min-h-12 w-full items-center gap-2 text-left">
        <span className="flex-1 text-base font-medium">{t(`sections.${section.id}`)}</span>
        {count ? <span className="rounded-full bg-c-accent-soft px-2 py-0.5 text-xs font-semibold text-c-accent">{count}</span> : null}
        <ChevronDown className={`h-5 w-5 text-c-subtle transition ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {open ? (
        <div className="flex flex-wrap gap-2 pb-2 pt-1">
          {section.chips.map((c) => (
            <Chip key={`${c.category}.${c.key}`} on={on(c.category, c.key)} tone={section.group === "activity" ? "fertile" : "accent"} onClick={() => onToggle(c.category, c.key)}>
              {t(`items.${c.item}`)}
            </Chip>
          ))}
        </div>
      ) : null}
    </Card>
  );
}

function PainSlider({ value, onCommit }: { value: number | null; onCommit: (v: number | null) => void }) {
  const t = useTranslations("cab.day");
  const [v, setV] = useState<number | null>(value);
  const [prev, setPrev] = useState(value);
  if (value !== prev) {
    // New value from the server (or another device): show it.
    setPrev(value);
    setV(value);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const change = (n: number) => {
    setV(n);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => onCommit(n), 600);
  };
  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor="pain" className="text-sm text-c-muted">
          {t("pain")}
        </label>
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium tabular-nums text-c-ink">{v === null ? t("painNone") : `${v} / 10`}</span>
          {v !== null ? (
            <button
              type="button"
              className="min-h-11 px-2 text-sm text-c-accent"
              onClick={() => {
                if (timer.current) clearTimeout(timer.current);
                setV(null);
                onCommit(null);
              }}
            >
              {t("painReset")}
            </button>
          ) : null}
        </span>
      </div>
      <input
        id="pain"
        type="range"
        min={0}
        max={10}
        step={1}
        value={v ?? 0}
        onChange={(e) => change(Number(e.target.value))}
        className={`h-11 w-full accent-[var(--cab-period)] ${v === null ? "opacity-50" : ""}`}
      />
    </div>
  );
}

function TextField({
  label,
  initial,
  onSave,
  multiline,
  inputMode,
  placeholder,
  validate,
}: {
  label: string;
  initial: string;
  onSave: (v: string) => void;
  multiline?: boolean;
  inputMode?: "decimal" | "text";
  placeholder?: string;
  validate?: (v: string) => boolean;
}) {
  const t = useTranslations("cab.day");
  const [v, setV] = useState(initial);
  const [focused, setFocused] = useState(false);
  const [shown, setShown] = useState(initial);
  const saved = useRef(initial);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorId = useId();
  // Take server updates (e.g. from Telegram) unless the user is typing.
  if (!focused && initial !== shown) {
    setShown(initial);
    setV(initial);
  }
  useEffect(() => {
    if (!focused) saved.current = initial;
  }, [initial, focused]);
  const invalid = !!validate && !validate(v.trim());
  const commit = (value: string) => {
    if (timer.current) clearTimeout(timer.current);
    const s = value.trim();
    if (s === saved.current || (validate && !validate(s))) return;
    saved.current = s;
    onSave(s);
  };
  const onBlur = () => {
    setFocused(false);
    commit(v);
  };
  const onChange = (e: { target: { value: string } }) => {
    setV(e.target.value);
    if (timer.current) clearTimeout(timer.current);
    const next = e.target.value;
    timer.current = setTimeout(() => commit(next), 900);
  };
  const cls = `w-full rounded-2xl border bg-c-bg px-4 text-base text-c-ink outline-none placeholder:text-c-subtle focus:border-c-accent ${invalid ? "border-c-danger" : "border-c-line"}`;
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-c-muted">{label}</span>
      {multiline ? (
        <textarea
          rows={3}
          maxLength={1000}
          value={v}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onFocus={() => setFocused(true)}
          onBlur={onBlur}
          onChange={onChange}
          className={`${cls} min-h-24 py-3`}
        />
      ) : (
        <input
          inputMode={inputMode}
          value={v}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          onFocus={() => setFocused(true)}
          onBlur={onBlur}
          onChange={onChange}
          className={`${cls} min-h-12`}
        />
      )}
      {invalid ? (
        <span id={errorId} className="mt-1 block text-xs text-c-danger">
          {t("invalidNumber")}
        </span>
      ) : null}
    </label>
  );
}
