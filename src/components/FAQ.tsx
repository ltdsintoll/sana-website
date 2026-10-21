"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const KEYS = ["q1", "q2", "q3", "q4", "q5", "q6", "q7", "q8"] as const;

export default function FAQ() {
  const t = useTranslations("faq");
  const [open, setOpen] = useState<string | null>("q1");

  return (
    <section className="py-24 md:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-14 text-center">
          <div className="text-accent-dark mb-3 text-xs font-medium tracking-widest uppercase">
            {t("eyebrow")}
          </div>
          <h2 className="text-text text-4xl font-light tracking-tight md:text-5xl">
            {t("title")}
          </h2>
        </div>

        <div className="border-border divide-border divide-y border-y">
          {KEYS.map((key) => {
            const isOpen = open === key;
            return (
              <div key={key}>
                <button
                  type="button"
                  id={`faq-${key}-q`}
                  aria-expanded={isOpen}
                  aria-controls={`faq-${key}-a`}
                  onClick={() => setOpen(isOpen ? null : key)}
                  className="group flex w-full items-start justify-between gap-6 py-6 text-left"
                >
                  <span className="text-text group-hover:text-accent-dark text-base font-medium transition-colors md:text-lg">
                    {t(`${key}.q`)}
                  </span>
                  <span className="mt-1 flex-shrink-0">
                    {isOpen ? (
                      <Minus
                        aria-hidden
                        className="text-accent h-5 w-5"
                        strokeWidth={1.5}
                      />
                    ) : (
                      <Plus
                        aria-hidden
                        className="text-text-muted h-5 w-5"
                        strokeWidth={1.5}
                      />
                    )}
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      id={`faq-${key}-a`}
                      role="region"
                      aria-labelledby={`faq-${key}-q`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeOut" }}
                      className="overflow-hidden"
                    >
                      <p className="text-text-muted pr-12 pb-6 leading-relaxed">
                        {t(`${key}.a`)}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
