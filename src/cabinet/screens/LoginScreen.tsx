"use client";

import { Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError, IS_MOCK, api } from "../api/client";
import type { AuthConfig, Me, TelegramWidgetUser } from "../api/types";
import { useCabinet } from "../state/hooks";
import { store } from "../state/store";
import { EmailCodeForm } from "../ui/email";
import { FullScreenSpinner, needsOnboardingOf } from "../ui/layout";
import { Button, Card, Spinner } from "../ui/primitives";
import { TelegramWidget, useTelegramDeepLink } from "../ui/telegram";

const DEFAULT_CONFIG: AuthConfig = { telegramBotUsername: "HerCycleBot", telegramWidgetEnabled: true, emailLoginEnabled: true };

export default function LoginScreen() {
  const t = useTranslations("cab");
  const router = useRouter();
  const snap = useCabinet();
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [widgetError, setWidgetError] = useState<string | null>(null);
  const [showWidget, setShowWidget] = useState(false);

  useEffect(() => {
    api.authConfig().then(setConfig, () => setConfig(DEFAULT_CONFIG));
  }, []);

  // Already signed in (or just signed in): leave the login screen.
  useEffect(() => {
    if (snap.auth === "authed" && (snap.cycle || snap.unreachable)) {
      router.replace(needsOnboardingOf(snap) ? "/app/onboarding" : "/app/today");
    }
  }, [snap, router]);

  async function done(user: Me) {
    await store.signedIn(user);
  }

  const tg = useTelegramDeepLink("login", (u) => void done(u));

  async function onWidget(u: TelegramWidgetUser) {
    setWidgetError(null);
    try {
      const r = await api.telegramWidget(u);
      await done(r.user);
    } catch (e) {
      setWidgetError(e instanceof ApiError && (e.code === "auth_expired" || e.code === "invalid_signature") ? t("login.errWidget") : t("errors.generic"));
    }
  }

  if (snap.auth === "unknown" || snap.auth === "authed") return <FullScreenSpinner />;

  const cfg = config ?? DEFAULT_CONFIG;

  return (
    <main className="px-safe pb-safe mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top))] w-full max-w-md flex-col pb-6">
      <div className="flex flex-1 flex-col justify-center py-8">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-[#8B7FD6] to-[#6B5FB8] text-3xl font-semibold text-white">
            S
          </div>
          <h1 className="text-3xl font-light tracking-tight text-c-ink">{t("login.title")}</h1>
          <p className="mx-auto mt-2 max-w-xs text-base text-c-muted">{t("login.subtitle")}</p>
        </div>

        <Card className="flex flex-col gap-3">
          {tg.state.kind === "waiting" ? (
            <div className="flex flex-col gap-3" aria-live="polite">
              <a
                href={tg.state.botUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#2AABEE] px-5 text-lg font-medium text-white active:opacity-90"
              >
                <Send className="h-5 w-5" aria-hidden />
                {t("login.openTelegram")}
              </a>
              <p className="flex items-center justify-center gap-2 text-sm text-c-muted">
                <Spinner /> {t("login.waitingTelegram")}
              </p>
              {IS_MOCK ? <p className="text-center text-xs text-c-subtle">{t("demo.telegramAuto")}</p> : null}
              <Button variant="ghost" size="sm" onClick={tg.reset}>
                {t("common.cancel")}
              </Button>
            </div>
          ) : (
            <>
              <Button size="lg" block loading={tg.state.kind === "starting"} onClick={() => void tg.start()} className="!bg-[#2AABEE] !text-white">
                <Send className="h-5 w-5" aria-hidden />
                {t("login.withTelegram")}
              </Button>
              {tg.state.kind === "expired" || tg.state.kind === "cancelled" || tg.state.kind === "error" ? (
                <p className="text-center text-sm text-c-danger" role="alert">
                  {tg.state.kind === "expired" ? t("login.tgExpired") : tg.state.kind === "cancelled" ? t("login.tgCancelled") : t("errors.generic")}
                </p>
              ) : null}
              <p className="text-center text-xs text-c-subtle">{t("login.telegramHint")}</p>
            </>
          )}

          {cfg.telegramWidgetEnabled ? (
            <div className="text-center">
              {showWidget ? (
                <div className="flex flex-col items-center gap-2 pt-1">
                  <TelegramWidget botUsername={cfg.telegramBotUsername} onAuth={(u) => void onWidget(u)} demoLabel={t("demo.widget")} />
                  {widgetError ? (
                    <p className="text-sm text-c-danger" role="alert">
                      {widgetError}
                    </p>
                  ) : null}
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setShowWidget(true)}>
                  {t("login.widgetToggle")}
                </Button>
              )}
            </div>
          ) : null}
        </Card>

        {cfg.emailLoginEnabled ? (
          <>
            <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-c-subtle">
              <span className="h-px flex-1 bg-c-line" />
              {t("login.or")}
              <span className="h-px flex-1 bg-c-line" />
            </div>
            <Card>
              <EmailCodeForm mode="login" onDone={done} />
            </Card>
          </>
        ) : null}
        {IS_MOCK ? <p className="mt-4 text-center text-xs text-c-subtle">{t("demo.loginHint")}</p> : null}
      </div>
      <p className="text-center text-xs leading-relaxed text-c-subtle">
        {t.rich("login.legal", {
          terms: (c) => (
            <Link href="/terms" className="underline underline-offset-2">
              {c}
            </Link>
          ),
          privacy: (c) => (
            <Link href="/privacy" className="underline underline-offset-2">
              {c}
            </Link>
          ),
        })}
      </p>
    </main>
  );
}
