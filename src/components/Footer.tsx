"use client";

import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default function Footer() {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="border-border border-t bg-white">
      <div className="mx-auto max-w-7xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2">
              <div className="from-accent to-accent-dark h-7 w-7 rounded-full bg-gradient-to-br" />
              <span className="text-text text-lg font-medium tracking-tight">
                Sana
              </span>
            </div>
            <p className="text-text-muted mt-4 max-w-sm text-sm leading-relaxed">
              {t("tagline")}
            </p>
          </div>

          <div>
            <div className="text-text-subtle mb-4 text-xs font-medium tracking-widest uppercase">
              {t("product")}
            </div>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="https://t.me/sanacyclebot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text-muted hover:text-accent-dark inline-flex items-center gap-1.5 transition-colors"
                >
                  <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {t("telegram")}
                </a>
              </li>
            </ul>
          </div>

          <div>
            <div className="text-text-subtle mb-4 text-xs font-medium tracking-widest uppercase">
              {t("legal")}
            </div>
            <ul className="space-y-3 text-sm">
              <li>
                <Link
                  href="/privacy"
                  className="text-text-muted hover:text-accent-dark transition-colors"
                >
                  {t("privacy")}
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-text-muted hover:text-accent-dark transition-colors"
                >
                  {t("terms")}
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-border mt-12 flex flex-col items-center justify-between gap-3 border-t pt-6 sm:flex-row">
          <p className="text-text-subtle text-xs">
            © {year} Sana. {t("rights")}
          </p>
          <p className="text-text-subtle text-xs">{t("madeWith")}</p>
        </div>
      </div>
    </footer>
  );
}
