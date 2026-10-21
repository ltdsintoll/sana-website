"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { type Locale } from "@/i18n/config";

const LOCALES = [
  { code: "en" as const, label: "English" },
  { code: "ru" as const, label: "Русский" },
  { code: "es" as const, label: "Español" },
  { code: "uk" as const, label: "Українська" },
] as const;

export default function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  function switchTo(target: Locale) {
    router.replace(pathname, { locale: target });
    setOpen(false);
  }

  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="language-list"
        className="text-text-muted hover:text-text hover:bg-surface-soft inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm transition-colors"
      >
        <Globe aria-hidden className="h-4 w-4" strokeWidth={1.5} />
        <span lang={current.code}>{current.label}</span>
      </button>
      {open && (
        <div
          id="language-list"
          className="border-border absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-2xl border bg-white shadow-lg"
        >
          {LOCALES.map((l) => (
            <button
              key={l.code}
              type="button"
              lang={l.code}
              aria-current={l.code === locale ? "true" : undefined}
              onClick={() => switchTo(l.code)}
              className="text-text hover:bg-surface-soft flex w-full items-center justify-between px-4 py-2.5 text-sm transition-colors"
            >
              <span>{l.label}</span>
              {l.code === locale && (
                <Check aria-hidden className="text-accent h-4 w-4" strokeWidth={1.5} />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
