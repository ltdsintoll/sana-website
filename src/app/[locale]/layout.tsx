import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { type Locale, locales } from "@/i18n/config";
import { routing } from "@/i18n/routing";
import { HOME_META, toLocale } from "@/lib/seo";

// Title and description are defaults only. Canonical, hreflang alternates and
// Open Graph tags are per page (see pageMetadata in src/lib/seo.ts), so a
// page never inherits another page's canonical URL.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const meta = HOME_META[toLocale(locale)];

  return {
    title: meta.title,
    description: meta.description,
    robots: {
      index: true,
      follow: true,
    },
    icons: {
      icon: "/icon",
      apple: "/apple-icon",
    },
  };
}

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  setRequestLocale(locale);
  return children;
}
