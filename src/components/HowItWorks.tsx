"use client";

import { useTranslations } from "next-intl";
import { MessageSquare, Pencil, Sparkles } from "lucide-react";

export default function HowItWorks() {
  const t = useTranslations("how");

  const steps = [
    { icon: MessageSquare, key: "step1" as const },
    { icon: Pencil, key: "step2" as const },
    { icon: Sparkles, key: "step3" as const },
  ];

  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <div className="text-accent-dark mb-3 text-xs font-medium tracking-widest uppercase">
            {t("eyebrow")}
          </div>
          <h2 className="text-text text-4xl font-light tracking-tight md:text-5xl">
            {t("title")}
          </h2>
          <p className="text-text-muted mt-4 text-lg font-light">
            {t("subtitle")}
          </p>
        </div>

        <div className="relative grid gap-8 md:grid-cols-3">
          {steps.map(({ icon: Icon, key }, i) => (
            <div key={key} className="relative">
              <div className="border-border h-full rounded-[20px] border bg-white p-8">
                <div className="mb-6 flex items-center justify-between">
                  <div className="bg-accent-soft flex h-12 w-12 items-center justify-center rounded-full">
                    <Icon className="text-accent h-5 w-5" strokeWidth={1.5} />
                  </div>
                  <span className="text-text-subtle text-xs font-medium tabular-nums">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="text-text mb-2 text-xl font-medium">
                  {t(`${key}.title`)}
                </h3>
                <p className="text-text-muted text-sm leading-relaxed">
                  {t(`${key}.description`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
