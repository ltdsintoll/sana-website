"use client";

import { useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, Check } from "lucide-react";
import { Link } from "@/i18n/navigation";

type Status = "idle" | "loading" | "success" | "error";

export default function EmailCapture() {
  const t = useTranslations("email");
  const locale = useLocale();
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!consent) {
      setStatus("error");
      setMessage(t("errorConsent"));
      return;
    }
    setStatus("loading");
    setMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, locale }),
      });
      if (!res.ok) throw new Error("Request failed");
      setStatus("success");
      setEmail("");
      setConsent(false);
    } catch {
      setStatus("error");
      setMessage(t("errorGeneric"));
    }
  }

  return (
    <section className="bg-surface-soft py-24 md:py-32">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <div className="text-accent mb-3 text-xs font-medium tracking-widest uppercase">
          {t("eyebrow")}
        </div>
        <h2 className="text-text text-4xl font-light tracking-tight md:text-5xl">
          {t("title")}
        </h2>
        <p className="text-text-muted mt-4 text-lg font-light">
          {t("subtitle")}
        </p>

        {status === "success" ? (
          <div className="text-accent-dark bg-accent-soft mt-10 inline-flex items-center gap-3 rounded-full px-6 py-4">
            <Check className="h-5 w-5" strokeWidth={1.5} />
            <span className="text-sm font-medium">{t("success")}</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mx-auto mt-10 max-w-md">
            <div className="border-border flex flex-col gap-2 rounded-full border bg-white p-1.5 shadow-sm sm:flex-row">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("placeholder")}
                className="text-text placeholder:text-text-subtle flex-1 border-0 bg-transparent px-5 py-2.5 text-sm focus:outline-none focus:ring-0"
                disabled={status === "loading"}
                autoComplete="email"
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="bg-accent hover:bg-accent-dark inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-white transition-colors disabled:opacity-60"
              >
                {status === "loading" ? t("loading") : t("submit")}
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>

            <label className="text-text-muted mt-5 flex cursor-pointer items-start gap-3 text-left text-xs leading-relaxed">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="border-border mt-0.5 h-4 w-4 flex-shrink-0 rounded border accent-[#8B7FD6]"
              />
              <span>
                {t.rich("consent", {
                  privacy: (chunks) => (
                    <Link
                      href="/privacy"
                      className="text-accent-dark hover:text-accent underline"
                    >
                      {chunks}
                    </Link>
                  ),
                })}
              </span>
            </label>

            {status === "error" && (
              <p className="mt-3 text-left text-xs text-red-500">{message}</p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
