"use client";

import { CloudOff, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "@/i18n/navigation";
import { useCabinet } from "../state/hooks";
import type { Snapshot } from "../state/store";
import { Spinner } from "./primitives";

export function Screen({ title, action, children, tabbar = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; tabbar?: boolean }) {
  return (
    <main className={`px-safe mx-auto w-full max-w-xl ${tabbar ? "pb-tabbar" : "pb-safe pb-8"}`}>
      {title !== undefined ? (
        <header className="flex min-h-16 items-center justify-between gap-3 pt-2">
          <h1 className="text-2xl font-light tracking-tight text-c-ink">{title}</h1>
          <div className="flex items-center gap-1">
            <SyncPill />
            {action}
          </div>
        </header>
      ) : null}
      {children}
    </main>
  );
}

/** Shows offline / queued / syncing state. Hidden when everything is in sync. */
export function SyncPill() {
  const t = useTranslations("cab.sync");
  const { online, unreachable, pending, syncing } = useCabinet();
  if (!online || unreachable) {
    return (
      <span className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-full bg-c-raised px-3 text-xs font-medium text-c-muted" role="status">
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
        {pending.length ? t("offlinePending", { count: pending.length }) : t("offline")}
      </span>
    );
  }
  if (pending.length || syncing) {
    return (
      <span className="inline-flex min-h-8 items-center gap-1.5 rounded-full px-2 text-xs text-c-subtle" role="status">
        <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden />
        <span className="sr-only">{t("syncing")}</span>
      </span>
    );
  }
  return null;
}

export function FullScreenSpinner() {
  return (
    <div className="flex min-h-[70dvh] items-center justify-center text-c-accent">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

/**
 * Client-side guard for the signed-in screens. Sends anonymous visitors to the
 * login screen and new accounts to onboarding.
 */
export function RequireAuth({ children, allowOnboarding = false }: { children: ReactNode; allowOnboarding?: boolean }) {
  const snap = useCabinet();
  const { auth } = snap;
  const router = useRouter();
  const needsOnboarding = needsOnboardingOf(snap);
  useEffect(() => {
    if (auth === "anon") router.replace("/app/login");
    else if (auth === "authed" && needsOnboarding && !allowOnboarding) router.replace("/app/onboarding");
  }, [auth, needsOnboarding, allowOnboarding, router]);
  if (auth !== "authed" || (needsOnboarding && !allowOnboarding)) return <FullScreenSpinner />;
  return <>{children}</>;
}

/**
 * Consent is required before storing data. The cycle questions are shown to
 * accounts without any data that have not completed or skipped them.
 */
export function needsOnboardingOf(s: Snapshot): boolean {
  if (!s.me) return false;
  if (!s.me.gdprConsent) return true;
  if (s.onboarded || s.me.hasProfile) return false;
  return s.cycle?.status.state === "no_data";
}
