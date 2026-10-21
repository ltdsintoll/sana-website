"use client";

import { ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { consentStatus } from "../api/types";
import { useCabinet } from "../state/hooks";
import { store } from "../state/store";
import { Button, Sheet } from "./primitives";
import { useUI } from "./ui-context";

/** The consent checkbox with the privacy policy link (onboarding, invite, gate). */
export function ConsentCheck({ checked, onChange, tone = "card" }: { checked: boolean; onChange: (v: boolean) => void; tone?: "card" | "raised" }) {
  const t = useTranslations("cab.onboarding");
  return (
    <label className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl p-4 ${tone === "card" ? "bg-c-card" : "bg-c-raised"}`}>
      <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-[var(--cab-accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
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
  );
}

/** The three promises shown with every consent request. */
export function ConsentPoints() {
  const t = useTranslations("cab.onboarding");
  return (
    <ul className="space-y-2 text-base text-c-ink">
      <li>• {t("consent1")}</li>
      <li>• {t("consent2")}</li>
      <li>• {t("consent3")}</li>
    </ul>
  );
}

/**
 * v1.3 (contract 12): a write came back 403 consent_required (consent withdrawn here or elsewhere,
 * a new policy version...). Asks again; the write is resent once it is accepted.
 * v1.4: also opens by itself once per session for a new policy version, and from the banner.
 * Accounts that never consented see the onboarding consent step instead.
 */
export function ConsentGate() {
  const t = useTranslations("cab.consent");
  const tp = useTranslations("cab.privacy");
  const tc = useTranslations("cab");
  const locale = useLocale();
  const ui = useUI();
  const { consentNeeded, auth, me } = useCabinet();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const status = consentStatus(me);
  // Accounts that never consented answer the onboarding consent step instead.
  const open = consentNeeded && auth === "authed" && !!me && status !== "none";

  useEffect(() => {
    if (auth !== "authed" || status !== "reconsent") return;
    try {
      if (sessionStorage.getItem("sana:reconsent-asked") === me?.consent?.currentVersion) return;
      sessionStorage.setItem("sana:reconsent-asked", me?.consent?.currentVersion ?? "");
    } catch {
      /* private mode: ask anyway */
    }
    store.askConsent();
  }, [auth, status, me?.consent?.currentVersion]);

  async function accept() {
    setBusy(true);
    try {
      await store.acceptConsent();
      setAgree(false);
      ui.toast(t("accepted"));
    } catch {
      ui.toast(tc("errors.generic"), { tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const title = status === "reconsent" ? tp("reconsentTitle") : status === "withdrawn" ? tp("againTitle") : t("title");
  const body =
    status === "reconsent"
      ? tp("reconsentBody")
      : status === "withdrawn" && me?.consent?.withdrawnAt
        ? tp("againBody", { date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(new Date(me.consent.withdrawnAt)) })
        : t("body");

  return (
    <Sheet
      open={open}
      onClose={() => {
        store.declineConsent();
        setAgree(false);
      }}
      title={
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-c-accent" aria-hidden /> {title}
        </span>
      }
      labelClose={t("later")}
    >
      <div className="flex flex-col gap-4" data-consent-gate>
        <p className="text-base text-c-muted">{body}</p>
        <ConsentPoints />
        <ConsentCheck checked={agree} onChange={setAgree} tone="raised" />
        <Button size="lg" block disabled={!agree} loading={busy} onClick={() => void accept()}>
          {t("accept")}
        </Button>
        <Button
          variant="ghost"
          block
          onClick={() => {
            store.declineConsent();
            setAgree(false);
          }}
        >
          {t("later")}
        </Button>
      </div>
    </Sheet>
  );
}

/** v1.4: a quiet reminder on every screen while consent is withdrawn or a new text waits. */
export function ConsentBanner() {
  const t = useTranslations("cab.privacy");
  const { me, auth } = useCabinet();
  const status = consentStatus(me);
  if (auth !== "authed" || (status !== "withdrawn" && status !== "reconsent")) return null;
  return (
    <div className="mb-4 rounded-2xl bg-c-raised p-4" role="status" data-consent-banner>
      <p className="text-sm text-c-ink">{status === "withdrawn" ? t("bannerWithdrawn") : t("bannerReconsent")}</p>
      <Button variant="soft" size="sm" className="mt-3" onClick={() => store.askConsent()}>
        {t("bannerAction")}
      </Button>
    </div>
  );
}
