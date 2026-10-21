"use client";

import { motion } from "framer-motion";
import { useTranslations } from "next-intl";

type Screen = {
  key: "calendar" | "symptoms" | "partner" | "insights";
  accent: string;
};

const screens: Screen[] = [
  { key: "calendar", accent: "from-accent-soft to-white" },
  { key: "symptoms", accent: "from-[#F5F3FB] to-white" },
  { key: "partner", accent: "from-accent-soft to-[#F5F3FB]" },
  { key: "insights", accent: "from-white to-accent-soft" },
];

export default function ScreenshotsGallery() {
  const t = useTranslations("screenshots");

  return (
    <section className="overflow-hidden py-24 md:py-32">
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
      </div>

      <div className="relative">
        {/* Focusable so the horizontal scroller can be scrolled with the keyboard. */}
        <div
          role="region"
          aria-label={t("title")}
          tabIndex={0}
          className="scrollbar-hide focus-visible:ring-accent-dark flex snap-x snap-mandatory gap-6 overflow-x-auto px-6 pb-8 focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset md:gap-8 md:px-12"
        >
          {screens.map((screen, i) => (
            <motion.div
              key={screen.key}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: "easeOut" }}
              className="w-[260px] flex-shrink-0 snap-center md:w-[300px]"
            >
              <div className="bg-ink relative aspect-[9/19] w-full rounded-[40px] p-2.5 shadow-xl">
                <div
                  className={`relative h-full w-full overflow-hidden rounded-[32px] bg-gradient-to-b ${screen.accent}`}
                >
                  <div className="bg-ink absolute top-0 left-1/2 z-10 h-5 w-20 -translate-x-1/2 rounded-b-xl" />

                  <div className="px-5 pt-10">
                    <div className="text-text-muted mt-3 text-[10px] tracking-widest uppercase">
                      {t(`${screen.key}.label`)}
                    </div>
                    <div className="text-text mt-1 text-base font-light">
                      {t(`${screen.key}.title`)}
                    </div>

                    {screen.key === "calendar" && (
                      <div className="mt-5 grid grid-cols-7 gap-1.5">
                        {Array.from({ length: 28 }).map((_, idx) => (
                          <div
                            key={idx}
                            className={`aspect-square rounded-md ${
                              idx >= 12 && idx <= 15
                                ? "bg-accent"
                                : idx === 21
                                  ? "bg-accent/40"
                                  : "bg-white/60"
                            }`}
                          />
                        ))}
                      </div>
                    )}

                    {screen.key === "symptoms" && (
                      <div className="mt-5 space-y-2">
                        {["Mood", "Energy", "Cramps", "Sleep"].map((label) => (
                          <div
                            key={label}
                            className="border-border rounded-xl border bg-white p-3"
                          >
                            <div className="text-text-subtle text-[10px]">
                              {label}
                            </div>
                            <div className="mt-1.5 flex gap-1">
                              {Array.from({ length: 5 }).map((_, idx) => (
                                <div
                                  key={idx}
                                  className={`h-1.5 flex-1 rounded-full ${idx < 3 ? "bg-accent" : "bg-surface-soft"}`}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {screen.key === "partner" && (
                      <div className="mt-5 space-y-3">
                        <div className="border-border flex items-center gap-3 rounded-xl border bg-white p-3">
                          <div className="bg-accent/30 h-8 w-8 rounded-full" />
                          <div className="flex-1">
                            <div className="bg-surface-soft h-2 w-3/4 rounded" />
                            <div className="bg-surface-soft mt-1.5 h-1.5 w-1/2 rounded" />
                          </div>
                        </div>
                        <div className="bg-accent-soft rounded-xl p-3">
                          <div className="text-accent-dark text-[10px]">
                            Today
                          </div>
                          <div className="text-text mt-1 text-xs">Be gentle — day 2</div>
                        </div>
                      </div>
                    )}

                    {screen.key === "insights" && (
                      <div className="mt-5">
                        <div className="border-border rounded-xl border bg-white p-4">
                          <div className="text-text-subtle text-[10px]">
                            Next period
                          </div>
                          <div className="text-text mt-1 text-2xl font-light">
                            in 6 days
                          </div>
                          <div className="bg-surface-soft mt-3 h-1.5 overflow-hidden rounded-full">
                            <div className="bg-accent h-full w-3/4 rounded-full" />
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-2 gap-2">
                          <div className="border-border rounded-xl border bg-white p-2.5">
                            <div className="text-text-subtle text-[9px]">
                              Avg cycle
                            </div>
                            <div className="text-text mt-0.5 text-sm">28 days</div>
                          </div>
                          <div className="border-border rounded-xl border bg-white p-2.5">
                            <div className="text-text-subtle text-[9px]">
                              Avg period
                            </div>
                            <div className="text-text mt-0.5 text-sm">5 days</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
