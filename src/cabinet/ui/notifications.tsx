"use client";

import { BellRing, Mail, Send, Smartphone, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { ApiError, IS_MOCK, api } from "../api/client";
import type { AuthConfig, Me, NotificationSettings, PushDevice } from "../api/types";
import { fmtDate } from "../lib/dates";
import { PushError, demoPush, disablePush, dropLocalPush, enablePush, isPushOnHere, permission, pushSupport, thisDeviceId } from "../lib/push";
import { InstallHint } from "./cycle";
import { Button, Card, Spinner, Switch } from "./primitives";
import { useUI } from "./ui-context";

const REMINDER_KEYS = ["checkBag", "remindMark", "congratulate", "pmsWarning", "discreetMode"] as const;
type Key = (typeof REMINDER_KEYS)[number] | "channelTelegram" | "channelWebPush" | "emailLateReminders";

const DEFAULTS: NotificationSettings = {
  checkBag: true,
  remindMark: true,
  congratulate: true,
  pmsWarning: true,
  discreetMode: false,
  channelTelegram: true,
  channelWebPush: true,
  emailLateReminders: false,
};

/**
 * Settings -> Notifications (API contract v1.2, sections 8 and 9): where the
 * reminders go (browser push on this device, Telegram, email fallback) and
 * which reminders are sent.
 */
export function NotificationsCard({ me, config, bot }: { me: Me; config: AuthConfig | null; bot: string }) {
  const t = useTranslations("cab");
  const ui = useUI();
  const [n, setN] = useState<NotificationSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [devices, setDevices] = useState<PushDevice[] | null>(null);
  const [here, setHere] = useState(false);
  const [busy, setBusy] = useState<null | "on" | "off" | "test">(null);
  const serverPush = config ? config.webPushEnabled !== false && !!config.vapidPublicKey : false;

  const loadDevices = useCallback(
    () =>
      Promise.all([api.pushDevices().then((r) => r.subscriptions, () => [] as PushDevice[]), isPushOnHere(me.id)]).then(([list, on]) => {
        setDevices(list);
        setHere(on);
      }),
    [me.id],
  );

  const loadSettings = useCallback(
    () =>
      api.notifications().then(
        (r) => {
          setN({ ...DEFAULTS, ...(r ?? {}) });
          setFailed(false);
        },
        () => setFailed(true),
      ),
    [],
  );

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);
  useEffect(() => {
    if (serverPush) void loadDevices();
  }, [serverPush, loadDevices]);

  async function set(key: Key, v: boolean) {
    const prev = n;
    setN((cur) => (cur ? { ...cur, [key]: v } : cur));
    try {
      const r = await api.updateNotifications({ [key]: v });
      setN({ ...DEFAULTS, ...r });
    } catch (e) {
      setN(prev);
      ui.toast(e instanceof ApiError && e.code === "email_required" ? t("notifications.emailRequired") : t("errors.generic"), { tone: "error" });
    }
  }

  async function turnOn() {
    setBusy("on");
    try {
      await enablePush(config?.vapidPublicKey, me.id);
      ui.toast(t("push.enabled"));
      await Promise.all([loadDevices(), loadSettings()]);
    } catch (e) {
      const code = e instanceof PushError ? e.code : "failed";
      ui.toast(t(`push.err.${code}`), { tone: "error", ms: 6000 });
    } finally {
      setBusy(null);
    }
  }

  async function turnOff() {
    setBusy("off");
    await disablePush();
    setHere(false);
    await Promise.all([loadDevices(), loadSettings()]);
    setBusy(null);
    ui.toast(t("push.disabled"));
  }

  async function test() {
    setBusy("test");
    try {
      const r = await api.pushTest(thisDeviceId() ?? undefined);
      if (IS_MOCK) await demoPush({ v: 1, kind: "test", title: "Sana", body: t("push.testBody"), url: window.location.href, tag: "sana-test", ts: Date.now() });
      ui.toast(r.sent > 0 ? t("push.testSent") : t("push.testNone"));
    } catch (e) {
      ui.toast(e instanceof ApiError && e.status === 429 ? t("push.testLimit") : t("errors.generic"), { tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function removeDevice(d: PushDevice) {
    const ok = await ui.confirm({ title: t("push.removeTitle"), body: t("push.removeBody"), confirmLabel: t("push.remove") });
    if (!ok) return;
    try {
      await api.pushDelete(d.id);
      if (d.id === thisDeviceId()) await dropLocalPush();
      await Promise.all([loadDevices(), loadSettings()]);
    } catch {
      ui.toast(t("errors.generic"), { tone: "error" });
    }
  }

  const avail = n?.available;
  const hasDevices = (avail?.webPushDevices ?? devices?.length ?? 0) > 0;

  return (
    <Card>
      {failed ? <p className="mb-2 text-sm text-c-muted">{t("errors.offlineFeature")}</p> : null}

      {/* ---------------------------------------------------- this device */}
      <h3 className="flex items-center gap-2 text-base font-medium">
        <BellRing className="h-5 w-5 text-c-accent" aria-hidden />
        {t("push.title")}
      </h3>
      <div className="mt-2" aria-live="polite">
        <PushControls serverPush={serverPush} here={here} busy={busy} onOn={() => void turnOn()} onOff={() => void turnOff()} onTest={() => void test()} />
      </div>

      {devices && devices.length ? (
        <div className="mt-3">
          <p className="mb-1 text-sm text-c-muted">{t("push.devices")}</p>
          <ul className="divide-y divide-c-line">
            {devices.map((d) => (
              <DeviceRow key={d.id} d={d} here={d.id === thisDeviceId() && here} onRemove={() => void removeDevice(d)} />
            ))}
          </ul>
        </div>
      ) : null}

      {/* ---------------------------------------------------- channels */}
      <div className="my-3 h-px bg-c-line" />
      <h3 className="mb-1 text-base font-medium">{t("notifications.channels")}</h3>
      {n ? (
        <>
          {hasDevices ? (
            <Switch checked={n.channelWebPush !== false} label={t("notifications.channelWebPush")} hint={t("notifications.channelWebPushHint")} onChange={(v) => void set("channelWebPush", v)} />
          ) : null}
          {avail?.telegram || (!avail && me.telegram) ? (
            <Switch
              checked={n.channelTelegram !== false}
              label={
                <span className="inline-flex items-center gap-1.5">
                  <Send className="h-4 w-4 text-c-subtle" aria-hidden /> {t("notifications.channelTelegram")}
                </span>
              }
              hint={t("notifications.viaBot", { bot: `@${bot}` })}
              onChange={(v) => void set("channelTelegram", v)}
            />
          ) : avail?.telegramBlocked ? (
            <p className="my-2 rounded-2xl bg-c-late-soft p-3 text-sm text-c-late">{t("notifications.telegramBlocked", { bot: `@${bot}` })}</p>
          ) : (
            <p className="my-2 text-sm text-c-muted">{t("notifications.needTelegram")}</p>
          )}
          <Switch
            checked={!!n.emailLateReminders}
            disabled={avail ? !avail.email : !me.email}
            label={
              <span className="inline-flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-c-subtle" aria-hidden /> {t("notifications.emailLate")}
              </span>
            }
            hint={(avail ? avail.email : !!me.email) ? t("notifications.emailLateHint") : t("notifications.emailLateNeedEmail")}
            onChange={(v) => void set("emailLateReminders", v)}
          />

          <div className="my-3 h-px bg-c-line" />
          <h3 className="mb-1 text-base font-medium">{t("notifications.what")}</h3>
          {REMINDER_KEYS.map((k) => (
            <Switch key={k} checked={!!n[k]} label={t(`notifications.${k}`)} hint={t(`notifications.${k}Hint`)} onChange={(v) => void set(k, v)} />
          ))}
        </>
      ) : !failed ? (
        <Spinner className="text-c-accent" />
      ) : null}
    </Card>
  );
}

function PushControls({
  serverPush,
  here,
  busy,
  onOn,
  onOff,
  onTest,
}: {
  serverPush: boolean;
  here: boolean;
  busy: null | "on" | "off" | "test";
  onOn: () => void;
  onOff: () => void;
  onTest: () => void;
}) {
  const t = useTranslations("cab.push");
  // Read in the browser only: the server render never shows these controls.
  const [env, setEnv] = useState<{ support: ReturnType<typeof pushSupport>; perm: ReturnType<typeof permission> } | null>(null);
  useEffect(() => {
    const read = () => setEnv({ support: pushSupport(), perm: permission() });
    const id = requestAnimationFrame(read);
    return () => cancelAnimationFrame(id);
  }, [here, busy]);

  if (!env) return <Spinner className="text-c-accent" />;
  if (!serverPush) return <p className="text-sm text-c-muted">{t("serverOff")}</p>;
  if (env.support === "needs-install")
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-c-muted">{t("iosInstall")}</p>
        <InstallHint />
      </div>
    );
  if (env.support === "unsupported") return <p className="text-sm text-c-muted">{t("unsupported")}</p>;
  if (env.perm === "denied") return <p className="rounded-2xl bg-c-raised p-3 text-sm text-c-muted">{t("denied")}</p>;
  if (here)
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-c-fertile">{t("onHere")}</p>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="soft" loading={busy === "test"} onClick={onTest}>
            {t("test")}
          </Button>
          <Button size="sm" variant="ghost" loading={busy === "off"} onClick={onOff}>
            {t("turnOff")}
          </Button>
        </div>
      </div>
    );
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-c-muted">{t("explain")}</p>
      <Button block loading={busy === "on"} onClick={onOn}>
        {t("turnOn")}
      </Button>
    </div>
  );
}

function DeviceRow({ d, here, onRemove }: { d: PushDevice; here: boolean; onRemove: () => void }) {
  const t = useTranslations("cab.push");
  const locale = useLocale();
  const name = d.deviceLabel || d.endpointHost || t("deviceUnknown");
  return (
    <li className="flex min-h-12 items-center gap-3 py-2">
      <Smartphone className="h-5 w-5 shrink-0 text-c-subtle" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base">
          {name}
          {here ? <span className="ml-2 rounded-full bg-c-accent-soft px-2 py-0.5 text-xs text-c-accent">{t("thisDevice")}</span> : null}
        </span>
        <span className="block text-xs text-c-muted">{t("since", { date: fmtDate(d.createdAt.slice(0, 10), locale, { day: "numeric", month: "short", year: "numeric" }) })}</span>
      </span>
      <button type="button" onClick={onRemove} aria-label={t("removeNamed", { name })} className="flex h-11 w-11 items-center justify-center rounded-full text-c-muted active:bg-c-raised">
        <Trash2 className="h-5 w-5" aria-hidden />
      </button>
    </li>
  );
}
