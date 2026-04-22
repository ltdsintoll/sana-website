"use client";

import { useTranslations } from "next-intl";
import { Heart, Lock, MessageCircle, ShieldCheck } from "lucide-react";

export default function TrustStrip() {
  const t = useTranslations("trust");

  const items = [
    { icon: Lock, key: "noDataSelling" as const },
    { icon: ShieldCheck, key: "gdpr" as const },
    { icon: Heart, key: "womenCentered" as const },
    { icon: MessageCircle, key: "telegram" as const },
  ];

  return (
    <section className="border-border bg-surface-soft border-y">
      <div className="mx-auto max-w-7xl px-6 py-10">
        <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
          {items.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="flex items-center justify-center gap-3 md:justify-start"
            >
              <Icon
                className="text-accent h-5 w-5 flex-shrink-0"
                strokeWidth={1.5}
              />
              <span className="text-text-muted text-sm font-medium">
                {t(key)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
