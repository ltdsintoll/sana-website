"use client";

import { Cake, HandHeart, MessageCircleQuestion, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { ApiError, api, isUuid } from "../api/client";
import { ADVICE_CATEGORIES, type AdviceCategory, type NudgeKind, type PartnerAdvice, type PartnerDayType, type PartnerOfLink, type PartnerView } from "../api/types";
import { fmtDate, fmtMonth, monthGrid, monthOf, weekStartsOn, weekdayLabels } from "../lib/dates";
import { partnerExpected } from "../lib/forecast";
import { getSelectedPartner, setSelectedPartner } from "../state/selectedDay";
import { FullScreenSpinner, RequireAuth, Screen } from "../ui/layout";
import { Button, Card, Chip, SectionTitle, Spinner, Switch } from "../ui/primitives";
import { useUI } from "../ui/ui-context";

export default function PartnerScreen() {
  return (
    <RequireAuth allowOnboarding>
      <Partner />
    </RequireAuth>
  );
}

type Load = { kind: "loading" } | { kind: "none" } | { kind: "error" } | { kind: "ok"; uuid: string; view: PartnerView; links: PartnerOfLink[] };

function Partner() {
  const t = useTranslations("cab.partnerView");
  const tc = useTranslations("cab");
  const router = useRouter();
  const ui = useUI();
  const [state, setState] = useState<Load>({ kind: "loading" });

  const load = useCallback(async () => {
    try {
      const { links } = await api.partnerOf();
      const want = getSelectedPartner();
      const uuid = links.find((l) => l.partnerUuid === want)?.partnerUuid ?? links[0]?.partnerUuid;
      if (!uuid || !isUuid(uuid)) {
        setState({ kind: "none" });
        return;
      }
      setSelectedPartner(uuid);
      const view = await api.partnerView(uuid);
      setState({ kind: "ok", uuid, view, links });
    } catch (e) {
      setState(e instanceof ApiError && e.status === 403 ? { kind: "none" } : { kind: "error" });
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  async function leave(uuid: string, name: string) {
    const ok = await ui.confirm({ title: t("leaveTitle"), body: t("leaveBody", { name }), confirmLabel: t("leave"), danger: true });
    if (!ok) return;
    try {
      await api.leavePartner(uuid);
      router.replace("/app/settings");
    } catch {
      ui.toast(tc("errors.generic"), { tone: "error" });
    }
  }

  const close = (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/app/today"))}
      aria-label={tc("common.close")}
      className="flex h-12 w-12 items-center justify-center rounded-full active:bg-c-raised"
    >
      <X className="h-6 w-6" aria-hidden />
    </button>
  );

  if (state.kind === "loading") return <FullScreenSpinner />;
  if (state.kind === "none" || state.kind === "error")
    return (
      <Screen tabbar={false} title={t("title")} action={close}>
        <Card>
          <p className="text-base text-c-muted">{state.kind === "none" ? t("none") : tc("errors.network")}</p>
          {state.kind === "error" ? (
            <Button variant="soft" className="mt-3" onClick={() => void load()}>
              {tc("common.retry")}
            </Button>
          ) : null}
        </Card>
      </Screen>
    );

  const { view, uuid, links } = state;
  const name = view.ownerName ?? t("her");
  return (
    <Screen tabbar={false} title={t("cycleOf", { name })} action={close}>
      {links.length > 1 ? (
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label={t("switch")}>
          {links.map((l) => (
            <Chip
              key={l.partnerUuid}
              on={l.partnerUuid === uuid}
              onClick={() => {
                setSelectedPartner(l.partnerUuid);
                setState({ kind: "loading" });
                void load();
              }}
            >
              {l.ownerName ?? t("her")}
            </Chip>
          ))}
        </div>
      ) : null}
      <StatusCard view={view} name={name} />
      {view.monthDays.length ? <MiniMonth view={view} /> : null}
      <AdviceCard uuid={uuid} view={view} onPrefs={(p) => setState({ ...state, view: { ...view, permissions: { ...view.permissions, ...p } } })} />
      <NudgeCard uuid={uuid} name={name} />
      <div className="mt-8">
        <Button variant="danger" block onClick={() => void leave(uuid, name)}>
          {t("leave")}
        </Button>
      </div>
    </Screen>
  );
}

function StatusCard({ view: v, name }: { view: PartnerView; name: string }) {
  const t = useTranslations("cab.partnerView");
  const tp = useTranslations("cab.privacy");
  const locale = useLocale();
  let big: string;
  let tone = "bg-c-card";
  if (v.sharingPaused) {
    return (
      <section className="rounded-3xl bg-c-card p-5" aria-live="polite" data-sharing-paused>
        <p className="text-base text-c-ink">{tp("sharingPaused", { name })}</p>
      </section>
    );
  }
  switch (v.cycleState) {
    case "period":
      big = v.ongoingPeriod ? t("periodDay", { day: v.ongoingPeriod.dayIndex }) : t("period");
      tone = "bg-c-period-soft";
      break;
    case "expected":
      big = partnerExpected(v, t);
      break;
    case "late":
      big = t("late", { count: v.lateDays ?? 0 });
      tone = "bg-c-late-soft";
      break;
    case "paused":
      big = t("paused");
      break;
    case "hidden":
      big = t("hidden", { name });
      break;
    case "stale":
      big = t("stale");
      break;
    default:
      big = t("noData");
  }
  const day = v.dayType === "period" || v.dayType === "fertile" || v.dayType === "pms" || v.dayType === "safe" ? t(`dayType.${v.dayType}`) : null;
  return (
    <section className={`rounded-3xl p-5 ${tone}`} aria-live="polite">
      <p className="text-sm font-medium text-c-muted first-letter:uppercase">{fmtDate(v.today, locale, { weekday: "long", day: "numeric", month: "long" })}</p>
      <p className="mt-1 text-3xl font-light tracking-tight text-c-ink">{big}</p>
      {day ? <p className="mt-2 text-base text-c-muted">{day}</p> : null}
      {v.ownerIrregular && (v.cycleState === "expected" || v.cycleState === "late") ? <p className="mt-2 text-sm text-c-muted">{t("irregular")}</p> : null}
      {v.dayType === "fertile" ? <p className="mt-2 text-xs text-c-subtle">{t("notContraception")}</p> : null}
    </section>
  );
}

const DAY_STYLE: Record<Exclude<PartnerDayType, null>, string> = {
  period: "bg-c-period text-c-period-ink font-semibold",
  period_predicted: "predicted-ring border-2 border-dashed border-c-period text-c-period",
  fertile: "bg-c-fertile-soft text-c-fertile",
  pms: "bg-c-pms-soft text-c-ink",
};

function MiniMonth({ view }: { view: PartnerView }) {
  const t = useTranslations("cab");
  const locale = useLocale();
  const firstDow = weekStartsOn(locale);
  const month = useMemo(() => monthOf(view.today), [view.today]);
  const cells = useMemo(() => monthGrid(month, firstDow), [month, firstDow]);
  const labels = useMemo(() => weekdayLabels(locale, firstDow), [locale, firstDow]);
  const types = useMemo(() => new Map(view.monthDays.map((d) => [d.date, d.type])), [view.monthDays]);
  const kindKey = (k: PartnerDayType) => (k === "period" ? "kind.period" : k === "period_predicted" ? "kind.periodPredicted" : k === "fertile" ? "kind.fertile" : k === "pms" ? "kind.pms" : null);
  return (
    <Card className="mt-3 px-2 pb-3 pt-3">
      <h2 className="mb-2 text-center text-base font-medium">{fmtMonth(month, locale)}</h2>
      <div className="grid grid-cols-7 pb-1" aria-hidden>
        {labels.map((l, i) => (
          <span key={i} className="text-center text-xs uppercase text-c-subtle">
            {l}
          </span>
        ))}
      </div>
      <ul className="grid grid-cols-7 gap-y-1" aria-label={fmtMonth(month, locale)}>
        {cells.map((ymd, i) => {
          if (!ymd) return <li key={`e${i}`} aria-hidden />;
          const k = types.get(ymd) ?? null;
          const key = kindKey(k);
          return (
            <li key={ymd} className="flex justify-center">
              <span className="sr-only">{`${fmtDate(ymd, locale, { day: "numeric", month: "long" })}${key ? `: ${t(key)}` : ""}`}</span>
              <span
                aria-hidden
                className={`flex h-10 w-10 items-center justify-center rounded-full text-sm tabular-nums ${k ? DAY_STYLE[k] : "text-c-ink"} ${
                  ymd === view.today ? "outline outline-2 outline-offset-2 outline-c-ink" : ""
                }`}
              >
                {Number(ymd.slice(8))}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function AdviceCard({ uuid, view, onPrefs }: { uuid: string; view: PartnerView; onPrefs: (p: Partial<PartnerView["permissions"]>) => void }) {
  const t = useTranslations("cab.partnerView");
  const tc = useTranslations("cab");
  const locale = useLocale();
  const ui = useUI();
  const [advice, setAdvice] = useState<PartnerAdvice | "disabled" | "error" | null>(null);
  const p = view.permissions;

  useEffect(() => {
    let alive = true;
    api.partnerAdvice(uuid, locale).then(
      (r) => alive && setAdvice(r),
      (e) => alive && setAdvice(e instanceof ApiError && e.code === "phase_tips_disabled" ? "disabled" : "error"),
    );
    return () => {
      alive = false;
    };
  }, [uuid, locale, p.partnerAdviceEnabled, p.partnerAdviceCategories]);

  async function prefs(body: Partial<Pick<PartnerView["permissions"], "partnerAdviceEnabled" | "partnerPhaseNotifications" | "partnerAdviceCategories">>) {
    try {
      const r = await api.partnerPrefs(uuid, body);
      onPrefs(r);
    } catch {
      ui.toast(tc("errors.generic"), { tone: "error" });
    }
  }

  const toggleCategory = (c: AdviceCategory) => {
    const cur = p.partnerAdviceCategories;
    const next = cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c];
    if (next.length) void prefs({ partnerAdviceCategories: next });
  };

  return (
    <>
      <SectionTitle>{t("adviceTitle")}</SectionTitle>
      <Card>
        {advice === null ? (
          <Spinner className="text-c-accent" />
        ) : advice === "disabled" ? (
          <p className="text-base text-c-muted">{t("adviceDisabled")}</p>
        ) : advice === "error" ? (
          <p className="text-base text-c-muted">{tc("errors.offlineFeature")}</p>
        ) : advice.hidden ? (
          <p className="text-base text-c-muted">{p.partnerAdviceEnabled ? t("adviceNone") : t("adviceOff")}</p>
        ) : (
          <p className="text-lg text-c-ink">{advice.text || t("adviceNone")}</p>
        )}
        {advice !== "disabled" ? (
          <>
            <div className="my-3 h-px bg-c-line" />
            <Switch checked={p.partnerAdviceEnabled} label={t("adviceSwitch")} onChange={(v) => void prefs({ partnerAdviceEnabled: v })} />
            {p.partnerAdviceEnabled ? (
              <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label={t("categories")}>
                {ADVICE_CATEGORIES.map((c) => (
                  <Chip key={c} on={p.partnerAdviceCategories.includes(c)} onClick={() => toggleCategory(c)}>
                    {t(`category.${c}`)}
                  </Chip>
                ))}
              </div>
            ) : null}
            <Switch checked={p.partnerPhaseNotifications} label={t("phaseNotif")} hint={t("phaseNotifHint")} onChange={(v) => void prefs({ partnerPhaseNotifications: v })} />
          </>
        ) : null}
      </Card>
    </>
  );
}

const NUDGES: Array<{ kind: NudgeKind; Icon: typeof Cake }> = [
  { kind: "sweets", Icon: Cake },
  { kind: "hug", Icon: HandHeart },
  { kind: "ask", Icon: MessageCircleQuestion },
];

function NudgeCard({ uuid, name }: { uuid: string; name: string }) {
  const t = useTranslations("cab.partnerView");
  const tc = useTranslations("cab");
  const ui = useUI();
  const [busy, setBusy] = useState<NudgeKind | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);

  async function send(kind: NudgeKind) {
    setBusy(kind);
    try {
      const r = await api.nudge(uuid, kind);
      setRemaining(r.remaining);
      ui.toast(t("nudgeSent", { name, count: r.remaining }));
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) {
        setRemaining(0);
        ui.toast(t("nudgeLimit"), { tone: "error" });
      } else ui.toast(tc("errors.generic"), { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <SectionTitle>{t("nudgeTitle")}</SectionTitle>
      <Card>
        <p className="mb-3 text-sm text-c-muted">{t("nudgeText", { name })}</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {NUDGES.map(({ kind, Icon }) => (
            <Button key={kind} variant="outline" loading={busy === kind} disabled={remaining === 0} onClick={() => void send(kind)}>
              <Icon className="h-5 w-5 text-c-accent" aria-hidden />
              {t(`nudge.${kind}`)}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-c-subtle" aria-live="polite">
          {remaining === null ? t("nudgeRule") : t("nudgeRemaining", { count: remaining })}
        </p>
      </Card>
    </>
  );
}
