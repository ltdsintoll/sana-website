"use client";

import { HeartHandshake } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link, useRouter } from "@/i18n/navigation";
import { ApiError, api, isUuid } from "../api/client";
import { hasConsent } from "../api/types";
import { useCabinet } from "../state/hooks";
import { getPendingInvite, setPendingInvite, setSelectedPartner } from "../state/selectedDay";
import { store } from "../state/store";
import { ConsentCheck } from "../ui/consent";
import { FullScreenSpinner } from "../ui/layout";
import { Button, Card } from "../ui/primitives";
import LoginScreen from "./LoginScreen";

/** Reads ?invite=<uuid> once, keeps it in this tab and removes it from the address bar. */
function takeInvite(): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = new URL(window.location.href).searchParams.get("invite");
  if (isUuid(fromUrl)) {
    setPendingInvite(fromUrl);
    const clean = window.location.pathname;
    window.history.replaceState(window.history.state, "", clean);
    return fromUrl;
  }
  const kept = getPendingInvite();
  return isUuid(kept) ? kept : null;
}

/**
 * /app/partner/accept?invite=<uuid> (contract 10): the partner signs in (or
 * creates an account), reads what will be shared, then accepts.
 */
export default function AcceptInviteScreen() {
  const t = useTranslations("cab.invite");
  const tc = useTranslations("cab");
  const router = useRouter();
  const snap = useCabinet();
  // undefined until read in the browser (the server render has no URL state).
  const [invite, setInvite] = useState<string | null | undefined>(undefined);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setInvite(takeInvite()));
    return () => cancelAnimationFrame(id);
  }, []);

  if (invite === undefined) return <FullScreenSpinner />;
  if (!invite)
    return (
      <Shell>
        <p className="text-base text-c-muted">{t("invalid")}</p>
        <Link href="/app" className="mt-3 inline-flex min-h-11 items-center text-c-accent">
          {t("toApp")}
        </Link>
      </Shell>
    );

  if (snap.auth === "unknown") return <FullScreenSpinner />;
  if (snap.auth === "anon" || !snap.me)
    return (
      <LoginScreen
        embedded
        intro={
          <Card className="mb-6 flex items-start gap-3">
            <HeartHandshake className="mt-0.5 h-6 w-6 shrink-0 text-c-accent" aria-hidden />
            <p className="text-base text-c-ink">{t("signInFirst")}</p>
          </Card>
        }
      />
    );

  const me = snap.me;
  const needsConsent = !hasConsent(me);

  async function accept() {
    if (!invite) return;
    setBusy(true);
    setError(null);
    try {
      if (needsConsent) {
        await store.acceptConsent();
      }
      await api.acceptInvite(invite);
      // A partner-only account does not need the cycle questions on this device.
      if (!snap.cycle || snap.cycle.status.state === "no_data") store.markOnboarded();
      setPendingInvite(null);
      setSelectedPartner(invite);
      router.replace("/app/partner");
    } catch (e) {
      const code = e instanceof ApiError ? e.code : "network";
      setError(
        code === "own_link" ? t("own") : code === "not_found" ? t("revoked") : code === "link_taken" ? t("taken") : e instanceof ApiError ? tc("errors.generic") : tc("errors.network"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <h1 className="text-2xl font-light tracking-tight text-c-ink">{t("title")}</h1>
      <p className="mt-3 text-base text-c-muted">{t("body")}</p>
      <ul className="mt-3 space-y-1.5 text-base text-c-ink">
        <li>• {t("point1")}</li>
        <li>• {t("point2")}</li>
        <li>• {t("point3")}</li>
      </ul>
      {needsConsent ? (
        <div className="mt-5">
          <ConsentCheck checked={agree} onChange={setAgree} tone="raised" />
        </div>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-c-danger" role="alert">
          {error}
        </p>
      ) : null}
      <Button size="lg" block className="mt-5" loading={busy} disabled={needsConsent && !agree} onClick={() => void accept()}>
        {t("accept")}
      </Button>
      <Button
        variant="ghost"
        block
        className="mt-2"
        onClick={() => {
          setPendingInvite(null);
          router.replace("/app");
        }}
      >
        {t("decline")}
      </Button>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="px-safe pb-safe mx-auto flex min-h-[calc(100dvh-env(safe-area-inset-top))] w-full max-w-md flex-col justify-center py-8">
      <Card className="p-5">{children}</Card>
    </main>
  );
}
