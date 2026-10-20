"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { api } from "../api/client";
import type { Ymd } from "../api/types";
import { addDays, fmtDate, localToday } from "../lib/dates";
import { useCabinet } from "../state/hooks";
import { store } from "../state/store";
import { RequireAuth } from "../ui/layout";
import { Button, Card, Stepper } from "../ui/primitives";
import { useUI } from "../ui/ui-context";

export default function OnboardingScreen() {
  return (
    <RequireAuth allowOnboarding>
      <Onboarding />
    </RequireAuth>
  );
}

type Step = "consent" | "last" | "period" | "cycle";

function Onboarding() {
  const t = useTranslations("cab.onboarding");
  const tc = useTranslations("cab");
  const locale = useLocale();
  const router = useRouter();
  const ui = useUI();
  const snap = useCabinet();
  const me = snap.me!;
  const today = snap.cycle?.today ?? localToday(me.timezone);
  const hasData = !!snap.cycle && snap.cycle.status.state !== "no_data";

  const [step, setStep] = useState<Step>(me.gdprConsent ? "last" : "consent");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<Ymd | null>(null);
  const [lastMode, setLastMode] = useState<"today" | "yesterday" | "date" | "unknown" | null>(null);
  const [periodLength, setPeriodLength] = useState(5);
  const [cycleLength, setCycleLength] = useState(28);

  useEffect(() => {
    if (me.gdprConsent && hasData && step === "last") router.replace("/app/today");
  }, [me.gdprConsent, hasData, step, router]);

  async function acceptConsent() {
    setBusy(true);
    try {
      await api.gdprAccept();
      store.setMe({ ...me, gdprConsent: true });
      if (hasData) {
        store.markOnboarded();
        router.replace("/app/today");
      } else setStep("last");
    } catch {
      ui.toast(tc("errors.generic"), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function finish(values: { last: Ymd | null; period: number | null; cycle: number | null }) {
    setBusy(true);
    try {
      await store.run({ type: "onboarding", lastPeriodStartYmd: values.last, periodLength: values.period, cycleLength: values.cycle });
      store.markOnboarded();
      router.replace("/app/today");
    } catch {
      ui.toast(tc("errors.generic"), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const steps: Step[] = me.gdprConsent && step !== "consent" ? ["last", "period", "cycle"] : ["consent", "last", "period", "cycle"];
  const idx = steps.indexOf(step);

  return (
    <main className="px-safe pb-safe mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top))] w-full max-w-md flex-col pb-6">
      <header className="flex min-h-16 items-center justify-between">
        <div className="flex gap-1.5" aria-label={t("progress", { step: idx + 1, total: steps.length })}>
          {steps.map((s, i) => (
            <span key={s} className={`h-1.5 w-8 rounded-full ${i <= idx ? "bg-c-accent" : "bg-c-line"}`} />
          ))}
        </div>
        {step !== "consent" ? (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void finish({ last: null, period: null, cycle: null })}>
            {t("skip")}
          </Button>
        ) : null}
      </header>

      {step === "consent" ? (
        <section className="flex flex-1 flex-col">
          <h1 className="mt-6 text-3xl font-light tracking-tight">{t("consentTitle")}</h1>
          <p className="mt-3 text-base text-c-muted">{t("consentBody")}</p>
          <ul className="mt-4 space-y-2 text-base text-c-ink">
            <li>• {t("consent1")}</li>
            <li>• {t("consent2")}</li>
            <li>• {t("consent3")}</li>
          </ul>
          <label className="mt-6 flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl bg-c-card p-4">
            <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--cab-accent)]" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
            <span className="text-sm text-c-ink">
              {t.rich("consentCheck", {
                privacy: (c) => (
                  <Link href="/privacy" className="underline underline-offset-2">
                    {c}
                  </Link>
                ),
              })}
            </span>
          </label>
          <div className="pb-safe sticky bottom-0 mt-auto bg-c-bg pb-2 pt-4">
            <Button size="lg" block disabled={!agree} loading={busy} onClick={() => void acceptConsent()}>
              {t("continue")}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "last" ? (
        <section className="flex flex-1 flex-col">
          <h1 className="mt-6 text-3xl font-light tracking-tight">{t("lastTitle")}</h1>
          <p className="mt-2 text-base text-c-muted">{t("lastHint")}</p>
          <div className="mt-6 grid grid-cols-2 gap-2">
            {(
              [
                ["today", today],
                ["yesterday", addDays(today, -1)],
              ] as const
            ).map(([mode, d]) => (
              <button
                key={mode}
                type="button"
                aria-pressed={lastMode === mode}
                onClick={() => {
                  setLastMode(mode);
                  setLast(d);
                }}
                className={`min-h-14 rounded-2xl border px-4 text-base ${lastMode === mode ? "border-c-accent bg-c-accent-soft text-c-accent" : "border-c-line bg-c-card"}`}
              >
                {tc(`common.${mode}`)}
              </button>
            ))}
          </div>
          <Card className="mt-2">
            <label className="block">
              <span className="mb-1.5 block text-sm text-c-muted">{t("pickDate")}</span>
              <input
                type="date"
                max={today}
                min={addDays(today, -365)}
                value={lastMode === "date" && last ? last : ""}
                onChange={(e) => {
                  if (e.target.value && e.target.value <= today) {
                    setLastMode("date");
                    setLast(e.target.value);
                  }
                }}
                className="min-h-12 w-full rounded-2xl border border-c-line bg-c-bg px-4 text-base text-c-ink"
              />
            </label>
          </Card>
          <button
            type="button"
            aria-pressed={lastMode === "unknown"}
            onClick={() => {
              setLastMode("unknown");
              setLast(null);
            }}
            className={`mt-2 min-h-12 rounded-2xl border px-4 text-base ${lastMode === "unknown" ? "border-c-accent bg-c-accent-soft text-c-accent" : "border-c-line bg-c-card"}`}
          >
            {t("dontRemember")}
          </button>
          {last ? <p className="mt-3 text-center text-sm text-c-muted">{fmtDate(last, locale, { weekday: "long", day: "numeric", month: "long" })}</p> : null}
          <div className="pb-safe sticky bottom-0 mt-auto bg-c-bg pb-2 pt-4">
            <Button size="lg" block disabled={lastMode === null} onClick={() => setStep("period")}>
              {t("next")}
            </Button>
          </div>
        </section>
      ) : null}

      {step === "period" || step === "cycle" ? (
        <LengthStep
          key={step}
          title={step === "period" ? t("periodTitle") : t("cycleTitle")}
          hint={step === "period" ? t("periodHint") : t("cycleHint")}
          value={step === "period" ? periodLength : cycleLength}
          min={step === "period" ? 1 : 15}
          max={step === "period" ? 14 : 90}
          unit={tc("common.daysUnit")}
          onChange={step === "period" ? setPeriodLength : setCycleLength}
          busy={busy}
          dontKnow={t("dontKnow")}
          nextLabel={step === "period" ? t("next") : t("finish")}
          onNext={(known) => {
            if (step === "period") {
              if (!known) setPeriodLength(-1);
              setStep("cycle");
            } else
              void finish({
                last,
                period: periodLength > 0 ? periodLength : null,
                cycle: known ? cycleLength : null,
              });
          }}
        />
      ) : null}
    </main>
  );
}

function LengthStep(p: {
  title: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (v: number) => void;
  onNext: (known: boolean) => void;
  busy: boolean;
  dontKnow: string;
  nextLabel: string;
}) {
  const tc = useTranslations("cab");
  const v = p.value > 0 ? p.value : p.min === 1 ? 5 : 28;
  return (
    <section className="flex flex-1 flex-col">
      <h1 className="mt-6 text-3xl font-light tracking-tight">{p.title}</h1>
      <p className="mt-2 text-base text-c-muted">{p.hint}</p>
      <Card className="mt-8 py-6">
        <Stepper value={v} min={p.min} max={p.max} onChange={p.onChange} label={p.title} unit={p.unit} labelLess={tc("common.lessDay")} labelMore={tc("common.moreDay")} />
      </Card>
      <div className="pb-safe sticky bottom-0 mt-auto flex flex-col gap-2 bg-c-bg pb-2 pt-4">
        <Button size="lg" block loading={p.busy} onClick={() => p.onNext(true)}>
          {p.nextLabel}
        </Button>
        <Button variant="ghost" block disabled={p.busy} onClick={() => p.onNext(false)}>
          {p.dontKnow}
        </Button>
      </div>
    </section>
  );
}
