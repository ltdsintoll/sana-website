"use client";

import { BarChart3, CalendarDays, Settings, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";

const TABS = [
  { href: "/app/today", key: "today", Icon: Sun },
  { href: "/app/calendar", key: "calendar", Icon: CalendarDays },
  { href: "/app/stats", key: "stats", Icon: BarChart3 },
  { href: "/app/settings", key: "settings", Icon: Settings },
] as const;

export default function TabBar() {
  const t = useTranslations("cab.tabs");
  const pathname = usePathname();
  return (
    <nav
      aria-label={t("label")}
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-c-line bg-c-card/95 backdrop-blur"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-4">
        {TABS.map(({ href, key, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex h-[4.5rem] flex-col items-center justify-center gap-1 text-xs font-medium transition ${
                  active ? "text-c-accent" : "text-c-subtle"
                }`}
              >
                <span className={`flex h-8 w-14 items-center justify-center rounded-full ${active ? "bg-c-accent-soft" : ""}`}>
                  <Icon className="h-5 w-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                </span>
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
