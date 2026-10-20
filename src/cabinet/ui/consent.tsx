"use client";

import { ShieldCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { hasConsent } from "../api/types";
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
 * v1.3 (contract 12): a write came back 403 consent_required although this
 * device thought consent was given (accepted policy changed, consent withdrawn
 * elsewhere...). Asks again; the write is resent once it is accepted.
 * Accounts that never consented see the onboarding consent step instead.
 */
export function ConsentGate() {
  const t = useTranslations("cab.consent");
  const tc = useTranslations("cab");
  const ui = useUI();
  const { consentNeeded, auth, me } = useCabinet();
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const open = consentNeeded && auth === "authed" && hasConsent(me);

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

  return (
    <Sheet
      open={open}
      onClose={() => {
        store.declineConsent();
        setAgree(false);
      }}
      title={
        <span className="inline-flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-c-accent" aria-hidden /> {t("title")}
        </span>
      }
      labelClose={t("later")}
    >
      <div className="flex flex-col gap-4" data-consent-gate>
        <p className="text-base text-c-muted">{t("body")}</p>
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
