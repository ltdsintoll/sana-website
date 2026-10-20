"use client";

import { Check, ChevronRight, Mail, Send } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { type Locale } from "@/i18n/config";
import { ApiError, IS_MOCK, api } from "../api/client";
import type { AuthConfig, Me, MergeDetails, NotificationSettings, TelegramWidgetUser, Ymd } from "../api/types";
import { fmtDate } from "../lib/dates";
import { useCabinet } from "../state/hooks";
import { store } from "../state/store";
import { useCycleView } from "../state/view";
import { InstallHint, PastDatePicker } from "../ui/cycle";
import { EmailCodeForm, MergeSheet } from "../ui/email";
import { FullScreenSpinner, Screen } from "../ui/layout";
import { Button, Card, SectionTitle, Sheet, Spinner, Stepper, Switch } from "../ui/primitives";
import { TelegramWidget, useTelegramDeepLink } from "../ui/telegram";
import { useUI } from "../ui/ui-context";

const LANGS: Array<{ code: Locale; label: string }> = [
  { code: "ru", label: "Русский" },
  { code: "uk", label: "Українська" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
];

export default function SettingsScreen() {
  const t = useTranslations("cab");
  const { me, cycle } = useCabinet();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  useEffect(() => {
    api.authConfig().then(setConfig, () => setConfig({ telegramBotUsername: "HerCycleBot", telegramWidgetEnabled: true, emailLoginEnabled: true }));
  }, []);
  useEffect(() => {
    if (window.location.hash === "#pregnancy") document.getElementById("pregnancy")?.scrollIntoView();
  }, [cycle]);
  if (!me || !cycle) return <FullScreenSpinner />;
  const bot = config?.telegramBotUsername ?? "HerCycleBot";

  return (
    <Screen title={t("settings.title")}>
      <AccountCard me={me} config={config} />
      <SectionTitle>{t("settings.cycle")}</SectionTitle>
      <CycleCard />
      <SectionTitle>{t("settings.pregnancy")}</SectionTitle>
      <PregnancyCard />
      <SectionTitle>{t("settings.notifications")}</SectionTitle>
      <NotificationsCard hasTelegram={!!me.telegram} bot={bot} />
      <SectionTitle>{t("settings.language")}</SectionTitle>
      <LanguageCard />
      <SectionTitle>{t("settings.app")}</SectionTitle>
      <AppCard />
      <SectionTitle>{t("settings.partner")}</SectionTitle>
      <Card>
        <p className="text-base text-c-muted">{t("settings.partnerText")}</p>
        <a href={`https://t.me/${bot}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 text-c-accent">
          <Send className="h-4 w-4" aria-hidden /> {t("settings.openBot")}
        </a>
      </Card>
      <SectionTitle>{t("settings.privacy")}</SectionTitle>
      <SessionCard />
      <DangerZone />
    </Screen>
  );
}

// ------------------------------------------------------------------ account & linking

function AccountCard({ me, config }: { me: Me; config: AuthConfig | null }) {
  const t = useTranslations("cab");
  const ui = useUI();
  const [sheet, setSheet] = useState<null | "email" | "telegram">(null);
  const name = me.telegram?.firstName || me.email || "Sana";

  async function linked(user: Me, kind: "email" | "telegram") {
    setSheet(null);
    store.setMe(user);
    await store.refresh({ force: true });
    ui.toast(kind === "email" ? t("link.emailDone") : t("link.telegramDone"));
  }

  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-c-accent-soft text-lg font-semibold uppercase text-c-accent">{name.slice(0, 1)}</span>
        <div className="min-w-0">
          <p className="truncate text-lg font-medium">{name}</p>
          <p className="text-sm text-c-muted">{t("link.sameData")}</p>
        </div>
      </div>
      <ul className="mt-3 divide-y divide-c-line">
        <li className="flex min-h-14 items-center gap-3 py-2">
          <Mail className="h-5 w-5 shrink-0 text-c-subtle" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-base">{t("link.email")}</span>
            <span className="block truncate text-sm text-c-muted">{me.email ?? t("link.notLinked")}</span>
          </span>
          {me.email ? (
            <Check className="h-5 w-5 text-c-fertile" aria-label={t("link.linked")} />
          ) : (
            <Button size="sm" variant="soft" onClick={() => setSheet("email")}>
              {t("link.add")}
            </Button>
          )}
        </li>
        <li className="flex min-h-14 items-center gap-3 py-2">
          <Send className="h-5 w-5 shrink-0 text-c-subtle" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block text-base">Telegram</span>
            <span className="block truncate text-sm text-c-muted">
              {me.telegram ? (me.telegram.username ? `@${me.telegram.username}` : me.telegram.firstName ?? t("link.linked")) : t("link.notLinked")}
            </span>
          </span>
          {me.telegram ? (
            <Check className="h-5 w-5 text-c-fertile" aria-label={t("link.linked")} />
          ) : (
            <Button size="sm" variant="soft" onClick={() => setSheet("telegram")}>
              {t("link.add")}
            </Button>
          )}
        </li>
      </ul>

      <Sheet open={sheet === "email"} onClose={() => setSheet(null)} title={t("link.emailTitle")} labelClose={t("common.close")}>
        <p className="mb-4 text-sm text-c-muted">{t("link.emailText")}</p>
        <EmailCodeForm mode="link" onDone={(u) => linked(u, "email")} />
      </Sheet>
      <Sheet open={sheet === "telegram"} onClose={() => setSheet(null)} title={t("link.telegramTitle")} labelClose={t("common.close")}>
        {sheet === "telegram" ? <LinkTelegram config={config} onDone={(u) => void linked(u, "telegram")} /> : null}
      </Sheet>
    </Card>
  );
}

function LinkTelegram({ config, onDone }: { config: AuthConfig | null; onDone: (u: Me) => void }) {
  const t = useTranslations("cab");
  const tg = useTelegramDeepLink("link", onDone);
  const [widgetMerge, setWidgetMerge] = useState<{ data: TelegramWidgetUser; details: MergeDetails } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function viaWidget(data: TelegramWidgetUser, merge = false) {
    setBusy(true);
    setError(null);
    try {
      const r = await api.linkTelegramWidget(data, merge);
      setWidgetMerge(null);
      onDone(r.user);
    } catch (e) {
      if (e instanceof ApiError && e.code === "merge_required") setWidgetMerge({ data, details: e.details as MergeDetails });
      else if (e instanceof ApiError && e.code === "account_conflict") setError(t("link.conflict"));
      else setError(t("errors.generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-c-muted">{t("link.telegramText")}</p>
      {tg.state.kind === "waiting" ? (
        <>
          <a
            href={tg.state.botUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#2AABEE] px-5 text-lg font-medium text-white"
          >
            <Send className="h-5 w-5" aria-hidden /> {t("login.openTelegram")}
          </a>
          <p className="flex items-center justify-center gap-2 text-sm text-c-muted">
            <Spinner /> {t("login.waitingTelegram")}
          </p>
        </>
      ) : (
        <Button size="lg" block loading={tg.state.kind === "starting"} onClick={() => void tg.start()} className="!bg-[#2AABEE] !text-white">
          <Send className="h-5 w-5" aria-hidden /> {t("link.viaBot")}
        </Button>
      )}
      {tg.state.kind === "expired" || tg.state.kind === "cancelled" || tg.state.kind === "error" ? (
        <p className="text-sm text-c-danger" role="alert">
          {tg.state.kind === "error" && tg.state.code === "account_conflict" ? t("link.conflict") : tg.state.kind === "expired" ? t("login.tgExpired") : t("errors.generic")}
        </p>
      ) : null}
      {config?.telegramWidgetEnabled ? (
        <div className="flex flex-col items-center gap-2 border-t border-c-line pt-3">
          <p className="text-xs text-c-subtle">{t("link.widgetAlt")}</p>
          <TelegramWidget botUsername={config.telegramBotUsername} onAuth={(d) => void viaWidget(d)} demoLabel={t("demo.widget")} />
        </div>
      ) : null}
      {error ? (
        <p className="text-sm text-c-danger" role="alert">
          {error}
        </p>
      ) : null}
      <MergeSheet
        details={tg.state.kind === "merge" ? tg.state.details : widgetMerge ? widgetMerge.details : null}
        kind="telegram"
        busy={busy}
        onCancel={() => {
          tg.reset();
          setWidgetMerge(null);
        }}
        onConfirm={() => {
          if (tg.state.kind === "merge") void tg.confirmMerge();
          else if (widgetMerge) void viaWidget(widgetMerge.data, true);
        }}
      />
    </div>
  );
}

// ------------------------------------------------------------------ cycle settings

function CycleCard() {
  const t = useTranslations("cab");
  const ui = useUI();
  const { cycle } = useCycleView();
  const s = cycle!.settings;
  const [cycleLength, setCycleLength] = useState<number | null>(s.cycleLength);
  const [periodLength, setPeriodLength] = useState<number | null>(s.periodLength);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setCycleLength(s.cycleLength);
    setPeriodLength(s.periodLength);
  }, [s.cycleLength, s.periodLength]);
  const dirty = cycleLength !== s.cycleLength || periodLength !== s.periodLength;

  async function save() {
    setBusy(true);
    await ui.exec({ type: "settings", patch: { cycleLength, periodLength } }, t("common.saved"));
    setBusy(false);
  }

  return (
    <Card>
      <LengthRow label={t("settings.cycleLength")} hint={t("settings.cycleLengthHint")} value={cycleLength} min={15} max={90} fallback={cycleLength ?? cycle!.stats.cycleLength} onChange={setCycleLength} />
      <div className="my-3 h-px bg-c-line" />
      <LengthRow label={t("settings.periodLength")} hint={t("settings.periodLengthHint")} value={periodLength} min={1} max={14} fallback={periodLength ?? cycle!.stats.periodLength} onChange={setPeriodLength} />
      {dirty ? (
        <Button block className="mt-4" loading={busy} onClick={() => void save()}>
          {t("common.save")}
        </Button>
      ) : null}
      <div className="my-3 h-px bg-c-line" />
      <Switch
        checked={s.forceCycleLength}
        disabled={!s.cycleLength}
        label={t("settings.forceLength")}
        hint={t("settings.forceLengthHint")}
        onChange={(v) => void ui.exec({ type: "settings", patch: { forceCycleLength: v } }, t("common.saved"))}
      />
      <Switch
        checked={s.isIrregular}
        label={t("settings.irregular")}
        hint={t("settings.irregularHint")}
        onChange={(v) => void ui.exec({ type: "settings", patch: { isIrregular: v } }, t("common.saved"))}
      />
    </Card>
  );
}

function LengthRow(p: { label: string; hint: string; value: number | null; fallback: number; min: number; max: number; onChange: (v: number | null) => void }) {
  const t = useTranslations("cab");
  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-3">
        <span>
          <span className="block text-base">{p.label}</span>
          <span className="block text-sm text-c-muted">{p.hint}</span>
        </span>
        <Switch checked={p.value === null} label={<span className="text-sm text-c-muted">{t("settings.auto")}</span>} onChange={(auto) => p.onChange(auto ? null : p.fallback)} />
      </div>
      {p.value !== null ? <Stepper value={p.value} min={p.min} max={p.max} onChange={p.onChange} label={p.label} unit={t("common.daysUnit")} /> : null}
    </div>
  );
}

// ------------------------------------------------------------------ pregnancy

function PregnancyCard() {
  const t = useTranslations("cab");
  const locale = useLocale();
  const ui = useUI();
  const { cycle, today } = useCycleView();
  const [sheet, setSheet] = useState<null | "start" | "end" | "lmp">(null);
  const [lmp, setLmp] = useState<Ymd | null>(null);
  const preg = cycle!.status.pregnancy;
  const active = cycle!.settings.mode === "PREGNANCY" || !!preg;

  return (
    <div id="pregnancy">
      <Card>
        {active ? (
          <>
            <p className="text-base">{preg ? t("today.pregnancyWeek", { week: preg.week, day: preg.day }) : t("settings.pregnancyOn")}</p>
            {preg?.dueYmd ? <p className="text-sm text-c-muted">{t("today.dueDate", { date: fmtDate(preg.dueYmd, locale, { day: "numeric", month: "long", year: "numeric" }) })}</p> : null}
            <Button variant="outline" block className="mt-3" onClick={() => setSheet("end")}>
              {t("settings.pregnancyEnd")}
            </Button>
          </>
        ) : (
          <>
            <p className="text-base text-c-muted">{t("settings.pregnancyText")}</p>
            <Button variant="soft" block className="mt-3" onClick={() => setSheet("start")}>
              {t("settings.pregnancyStart")}
            </Button>
          </>
        )}
      </Card>

      <Sheet open={sheet === "start"} onClose={() => setSheet(null)} title={t("settings.pregnancyStart")} labelClose={t("common.close")}>
        <p className="mb-4 text-sm text-c-muted">{t("settings.pregnancyStartText")}</p>
        <Button variant="outline" block onClick={() => setSheet("lmp")}>
          {lmp ? t("settings.lmpValue", { date: fmtDate(lmp, locale) }) : t("settings.lmpPick")}
        </Button>
        <Button
          block
          className="mt-3"
          onClick={async () => {
            setSheet(null);
            await ui.exec({ type: "pregnancyStart", startYmd: lmp ?? undefined }, t("settings.pregnancyStarted"));
          }}
        >
          {t("settings.pregnancyConfirm")}
        </Button>
      </Sheet>
      <PastDatePicker open={sheet === "lmp"} title={t("settings.lmpPick")} today={today} onClose={() => setSheet("start")} onPick={(d) => { setLmp(d); setSheet("start"); }} />

      <Sheet open={sheet === "end"} onClose={() => setSheet(null)} title={t("settings.pregnancyEnd")} labelClose={t("common.close")}>
        <p className="mb-4 text-sm text-c-muted">{t("settings.pregnancyEndText")}</p>
        <div className="flex flex-col gap-2">
          {(["birth", "loss", "other"] as const).map((o) => (
            <Button
              key={o}
              variant="outline"
              block
              onClick={async () => {
                setSheet(null);
                await ui.exec({ type: "pregnancyEnd", outcome: o, endYmd: today }, t("settings.pregnancyEnded"));
              }}
            >
              {t(`settings.outcome.${o}`)}
            </Button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

// ------------------------------------------------------------------ notifications

const NOTIF_KEYS = ["checkBag", "remindMark", "congratulate", "pmsWarning", "discreetMode"] as const;

function NotificationsCard({ hasTelegram, bot }: { hasTelegram: boolean; bot: string }) {
  const t = useTranslations("cab");
  const ui = useUI();
  const [n, setN] = useState<NotificationSettings | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    api.notifications().then(
      (r) => setN(r ?? { checkBag: true, remindMark: true, congratulate: true, pmsWarning: true, discreetMode: false }),
      () => setFailed(true),
    );
  }, []);

  async function set(key: (typeof NOTIF_KEYS)[number], v: boolean) {
    const prev = n;
    setN((cur) => (cur ? { ...cur, [key]: v } : cur));
    try {
      const r = await api.updateNotifications({ [key]: v });
      setN(r);
    } catch {
      setN(prev);
      ui.toast(t("errors.generic"), { tone: "error" });
    }
  }

  return (
    <Card>
      {!hasTelegram ? (
        <p className="mb-2 rounded-2xl bg-c-accent-soft p-3 text-sm text-c-accent">{t("notifications.needTelegram")}</p>
      ) : (
        <p className="mb-1 text-sm text-c-muted">{t("notifications.viaBot", { bot: `@${bot}` })}</p>
      )}
      {failed ? <p className="text-sm text-c-muted">{t("errors.offlineFeature")}</p> : null}
      {n
        ? NOTIF_KEYS.map((k) => (
            <Switch key={k} checked={!!n[k]} label={t(`notifications.${k}`)} hint={t(`notifications.${k}Hint`)} onChange={(v) => void set(k, v)} />
          ))
        : !failed ? <Spinner className="text-c-accent" /> : null}
      {/* TODO(push): Web Push needs VAPID + subscription endpoints in the API (not in contract v1). */}
      <p className="mt-2 text-xs text-c-subtle">{t("notifications.pushSoon")}</p>
    </Card>
  );
}

// ------------------------------------------------------------------ language, app, session

function LanguageCard() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <Card className="grid grid-cols-2 gap-2">
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          aria-pressed={locale === l.code}
          onClick={() => {
            if (l.code === locale) return;
            void api.patchMe({ languageCode: l.code }).catch(() => undefined);
            router.replace(pathname, { locale: l.code });
          }}
          className={`min-h-12 rounded-2xl border px-3 text-base ${locale === l.code ? "border-c-accent bg-c-accent-soft text-c-accent" : "border-c-line"}`}
        >
          {l.label}
        </button>
      ))}
    </Card>
  );
}

function AppCard() {
  const t = useTranslations("cab");
  const locale = useLocale();
  const { lastSyncedAt, syncing, pending } = useCabinet();
  return (
    <Card>
      <h3 className="mb-2 text-base">{t("install.title")}</h3>
      <InstallHint />
      <div className="my-3 h-px bg-c-line" />
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-c-muted">
          {lastSyncedAt ? t("sync.last", { time: new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit" }).format(lastSyncedAt) }) : t("sync.never")}
          {pending.length ? ` · ${t("sync.pending", { count: pending.length })}` : ""}
        </span>
        <Button size="sm" variant="ghost" loading={syncing} onClick={() => void store.flush().then(() => store.refresh({ force: true }))}>
          {t("sync.now")}
        </Button>
      </div>
      <p className="mt-1 text-xs text-c-subtle">{t("sync.explain")}</p>
    </Card>
  );
}

function SessionCard() {
  const t = useTranslations("cab");
  const ui = useUI();
  const router = useRouter();
  const { pending } = useCabinet();
  return (
    <Card className="py-1">
      <Link href="/privacy" className="flex min-h-12 items-center justify-between text-base">
        {t("settings.privacyPolicy")} <ChevronRight className="h-5 w-5 text-c-subtle" aria-hidden />
      </Link>
      <Link href="/terms" className="flex min-h-12 items-center justify-between border-t border-c-line text-base">
        {t("settings.terms")} <ChevronRight className="h-5 w-5 text-c-subtle" aria-hidden />
      </Link>
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between border-t border-c-line text-left text-base text-c-accent"
        onClick={async () => {
          if (pending.length && !(await ui.confirm({ title: t("settings.logout"), body: t("settings.logoutPending", { count: pending.length }), confirmLabel: t("settings.logout") }))) return;
          router.push("/app/logout");
        }}
      >
        {t("settings.logout")}
      </button>
      <button
        type="button"
        className="flex min-h-12 w-full items-center justify-between border-t border-c-line text-left text-base text-c-accent"
        onClick={async () => {
          if (!(await ui.confirm({ title: t("settings.logoutAll"), body: t("settings.logoutAllText"), confirmLabel: t("settings.logoutAll") }))) return;
          await store.logout(true);
          router.replace("/app/login");
        }}
      >
        {t("settings.logoutAll")}
      </button>
    </Card>
  );
}

function DangerZone() {
  const t = useTranslations("cab");
  const ui = useUI();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-10 border-t border-c-line pt-6">
      <Button
        variant="danger"
        block
        loading={busy}
        onClick={async () => {
          const ok = await ui.confirm({ title: t("settings.deleteTitle"), body: t("settings.deleteText"), confirmLabel: t("settings.deleteConfirm"), danger: true });
          if (!ok) return;
          setBusy(true);
          try {
            await api.deleteAccount();
            await store.forget();
            router.replace("/app/login");
          } catch {
            ui.toast(t("errors.generic"), { tone: "error" });
          } finally {
            setBusy(false);
          }
        }}
      >
        {t("settings.deleteTitle")}
      </Button>
      {IS_MOCK ? <p className="mt-3 text-center text-xs text-c-subtle">{t("demo.banner")}</p> : null}
    </div>
  );
}
