"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Header() {
  const t = useTranslations("header");

  return (
    <header className="bg-white/80 border-border/60 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="from-accent to-accent-dark h-7 w-7 rounded-full bg-gradient-to-br" />
          <span className="text-text text-lg font-medium tracking-tight">
            Sana
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Link
            href="/app"
            prefetch={false}
            className="text-text hover:bg-surface-soft inline-flex min-h-10 items-center rounded-full px-4 py-2 text-sm font-medium transition-colors"
          >
            {t("signIn")}
          </Link>
          <a
            href="https://t.me/sanacyclebot"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-accent-dark hover:bg-accent-deep hidden items-center rounded-full px-4 py-2 text-sm font-medium text-white transition-colors sm:inline-flex"
          >
            {t("cta")}
          </a>
        </div>
      </div>
    </header>
  );
}
