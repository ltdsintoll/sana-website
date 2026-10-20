"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ApiError, api } from "../api/client";
import type { MergeDetails, Me } from "../api/types";
import { fmtDate } from "../lib/dates";
import { Button, Sheet } from "./primitives";

function emailError(t: (k: string, v?: Record<string, string | number>) => string, e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case "invalid_code":
        return t("login.errInvalidCode");
      case "code_expired":
        return t("login.errExpired");
      case "too_many_attempts":
        return t("login.errTooMany");
      case "rate_limited":
        return e.retryAfterSec ? t("login.errWait", { sec: e.retryAfterSec }) : t("errors.rateLimited");
      case "validation_error":
        return t("login.errEmail");
      case "account_conflict":
        return t("link.conflict");
      case "forbidden_origin":
        return t("errors.forbiddenOrigin");
    }
    return t("errors.generic");
  }
  return t("errors.network");
}

/**
 * Email + 6-digit code. `mode="login"` signs in (creating the account when the
 * email is new); `mode="link"` adds the email to the signed-in account and
 * handles the 409 merge_required confirmation.
 */
export function EmailCodeForm({ mode, onDone }: { mode: "login" | "link"; onDone: (user: Me) => void | Promise<void> }) {
  const t = useTranslations("cab");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [merge, setMerge] = useState<MergeDetails | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step !== "code") return;
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, [step]);

  async function requestCode() {
    setError(null);
    const value = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError(t("login.errEmail"));
      return;
    }
    setBusy(true);
    try {
      const r = mode === "login" ? await api.emailRequest(value, locale) : await api.linkEmailRequest(value, locale);
      setEmail(value);
      setStep("code");
      setCode("");
      setResendAt(Date.now() + (r.resendAfterSec ?? 60) * 1000);
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) {
      setError(emailError(t, e));
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string, withMerge = false) {
    setError(null);
    setBusy(true);
    try {
      if (mode === "login") {
        const r = await api.emailVerify(email, value);
        await onDone(r.user);
      } else {
        const r = await api.linkEmailVerify(email, value, withMerge);
        setMerge(null);
        await onDone(r.user);
      }
    } catch (e) {
      if (e instanceof ApiError && e.code === "merge_required") {
        setMerge(e.details as MergeDetails);
      } else {
        setError(emailError(t, e));
        if (e instanceof ApiError && (e.code === "code_expired" || e.code === "too_many_attempts")) setCode("");
      }
    } finally {
      setBusy(false);
    }
  }

  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));

  if (step === "email") {
    return (
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          void requestCode();
        }}
      >
        <label className="block">
          <span className="mb-1.5 block text-sm text-c-muted">{t("login.emailLabel")}</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            spellCheck={false}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="min-h-12 w-full rounded-2xl border border-c-line bg-c-card px-4 text-base text-c-ink outline-none placeholder:text-c-subtle focus:border-c-accent"
          />
        </label>
        {error ? (
          <p className="text-sm text-c-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" variant={mode === "login" ? "outline" : "primary"} block loading={busy}>
          {t("login.getCode")}
        </Button>
      </form>
    );
  }

  return (
    <>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) void verify(code);
        }}
      >
        <p className="text-base text-c-muted">{t("login.codeSent", { email })}</p>
        <label className="block">
          <span className="mb-1.5 block text-sm text-c-muted">{t("login.codeLabel")}</span>
          <input
            ref={codeRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={(e) => {
              const v = e.target.value.replace(/\D/g, "").slice(0, 6);
              setCode(v);
              if (v.length === 6 && !busy) void verify(v);
            }}
            aria-describedby="code-hint"
            className="min-h-14 w-full rounded-2xl border border-c-line bg-c-card px-4 text-center font-mono text-3xl tracking-[0.5em] text-c-ink outline-none focus:border-c-accent"
          />
        </label>
        <p id="code-hint" className="text-xs text-c-subtle">
          {t("login.codeHint")}
        </p>
        {error ? (
          <p className="text-sm text-c-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" block loading={busy} disabled={code.length !== 6}>
          {mode === "login" ? t("login.signIn") : t("link.confirm")}
        </Button>
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => setStep("email")}>
            {t("login.changeEmail")}
          </Button>
          <Button variant="ghost" size="sm" disabled={wait > 0 || busy} onClick={() => void requestCode()}>
            {wait > 0 ? t("login.resendIn", { sec: wait }) : t("login.resend")}
          </Button>
        </div>
      </form>
      <MergeSheet details={merge} kind="email" busy={busy} onCancel={() => setMerge(null)} onConfirm={() => void verify(code, true)} />
    </>
  );
}

export function MergeSheet({
  details,
  kind,
  busy,
  onConfirm,
  onCancel,
}: {
  details: MergeDetails | null;
  kind: "email" | "telegram";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("cab");
  const locale = useLocale();
  const o = details?.other;
  return (
    <Sheet open={!!details} onClose={onCancel} title={t("merge.title")} labelClose={t("common.close")}>
      {o ? (
        <div className="flex flex-col gap-4">
          <p className="text-base text-c-ink">{t(kind === "email" ? "merge.bodyEmail" : "merge.bodyTelegram")}</p>
          <ul className="rounded-2xl bg-c-raised p-4 text-sm text-c-muted">
            <li>{t("merge.created", { date: fmtDate(o.createdAt.slice(0, 10), locale, { day: "numeric", month: "long", year: "numeric" }) })}</li>
            <li>{t("merge.periods", { count: o.periods })}</li>
            <li>{o.hasTelegram ? t("merge.hasTelegram") : t("merge.hasEmail")}</li>
          </ul>
          <p className="text-sm text-c-muted">{t("merge.what")}</p>
          <p className="text-sm font-medium text-c-ink">{t("merge.irreversible")}</p>
          <Button block loading={busy} onClick={onConfirm}>
            {t("merge.confirm")}
          </Button>
          <Button variant="ghost" block onClick={onCancel}>
            {t("common.cancel")}
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
