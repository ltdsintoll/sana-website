"use client";

import { useTranslations } from "next-intl";
import { Activity, Calendar, Lock, Plane, Shield, Users } from "lucide-react";

export default function Features() {
  const t = useTranslations("features");

  const items = [
    { icon: Calendar, key: "calendar" as const },
    { icon: Activity, key: "symptoms" as const },
    { icon: Users, key: "partner" as const },
    { icon: Shield, key: "safety" as const },
    { icon: Plane, key: "trip" as const },
    { icon: Lock, key: "privacy" as const },
  ];

  return (
    <section className="bg-surface-soft py-24 md:py-32">
      <div className="mx-auto max-w-7xl px-6">
        <div className="mx-auto mb-16 max-w-2xl text-center">
          <div className="text-accent mb-3 text-xs font-medium tracking-widest uppercase">
            {t("eyebrow")}
          </div>
          <h2 className="text-text text-4xl font-light tracking-tight md:text-5xl">
            {t("title")}
          </h2>
          <p className="text-text-muted mt-4 text-lg font-light">
            {t("subtitle")}
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="group rounded-[20px] border border-border bg-white p-7 transition-all duration-300 hover:border-accent/40 hover:shadow-[0_4px_24px_-8px_rgba(139,127,214,0.15)]"
            >
              <div className="bg-accent-soft group-hover:bg-accent/15 mb-5 flex h-11 w-11 items-center justify-center rounded-full transition-colors">
                <Icon
                  className="text-accent h-5 w-5"
                  strokeWidth={1.5}
                />
              </div>
              <h3 className="text-text mb-2 text-lg font-medium">
                {t(`${key}.title`)}
              </h3>
              <p className="text-text-muted text-sm leading-relaxed">
                {t(`${key}.description`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
