"use client";

import { useTranslations } from "next-intl";
import { Database, EyeOff, Lock } from "lucide-react";

export default function PrivacySection() {
  const t = useTranslations("privacy_section");

  const points = [
    { icon: Lock, key: "encryption" as const },
    { icon: EyeOff, key: "noTracking" as const },
    { icon: Database, key: "ownership" as const },
  ];

  return (
    <section className="bg-surface-soft py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          <div>
            <div className="text-accent mb-3 text-xs font-medium tracking-widest uppercase">
              {t("eyebrow")}
            </div>
            <h2 className="text-text text-4xl font-light leading-[1.1] tracking-tight md:text-5xl">
              {t("title")}
            </h2>
            <p className="text-text-muted mt-6 text-lg font-light leading-relaxed">
              {t("subtitle")}
            </p>
          </div>

          <div className="space-y-5">
            {points.map(({ icon: Icon, key }) => (
              <div
                key={key}
                className="border-border flex gap-5 rounded-[20px] border bg-white p-6"
              >
                <div className="bg-accent-soft flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full">
                  <Icon
                    className="text-accent h-5 w-5"
                    strokeWidth={1.5}
                  />
                </div>
                <div>
                  <h3 className="text-text mb-1.5 text-base font-medium">
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
      </div>
    </section>
  );
}
