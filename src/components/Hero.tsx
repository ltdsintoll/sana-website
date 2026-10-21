"use client";

import { useTranslations } from "next-intl";
import PhoneMockup from "./PhoneMockup";

export default function Hero() {
  const t = useTranslations("hero");

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 pt-24 pb-16 md:pt-32 md:pb-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <div className="text-accent-dark bg-accent-soft mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium">
              <span className="bg-accent h-1.5 w-1.5 rounded-full" />
              {t("badge")}
            </div>
            <h1 className="text-text text-5xl font-light leading-[1.05] tracking-tight md:text-6xl lg:text-7xl">
              {t("title")}
            </h1>
            <p className="text-text-muted mx-auto mt-6 max-w-xl text-lg font-light leading-relaxed md:text-xl lg:mx-0">
              {t("subtitle")}
            </p>

            <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row lg:justify-start">
              <a
                href="https://t.me/sanacyclebot"
                target="_blank"
                rel="noopener noreferrer"
                className="bg-accent-dark hover:bg-accent-deep inline-flex items-center justify-center rounded-full px-6 py-3.5 text-sm font-medium text-white transition-colors"
              >
                {t("ctaPrimary")}
              </a>
              <button
                type="button"
                disabled
                className="border-border text-text-muted inline-flex cursor-not-allowed items-center justify-center rounded-full border bg-white px-6 py-3.5 text-sm font-medium"
              >
                {t("ctaSecondary")}
              </button>
            </div>

            <p className="text-text-subtle mt-4 text-xs">{t("ctaNote")}</p>
          </div>

          <div className="flex justify-center lg:justify-end">
            <PhoneMockup />
          </div>
        </div>
      </div>

      <div className="from-accent-soft/30 absolute top-0 left-1/2 -z-10 h-[600px] w-[120%] -translate-x-1/2 bg-gradient-to-b to-transparent blur-3xl" />
    </section>
  );
}
