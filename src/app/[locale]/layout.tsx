import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { type Locale, locales } from "@/i18n/config";
import { routing } from "@/i18n/routing";
import Footer from "@/components/Footer";
import Header from "@/components/Header";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sanacycle.com";

const META_BY_LOCALE: Record<string, { title: string; description: string }> = {
  en: {
    title: "Sana — calm cycle tracking in Telegram",
    description:
      "Cycle tracking, quietly done. No pink clichés, no ads, no data selling. Just your cycle — right inside Telegram.",
  },
  ru: {
    title: "Sana — спокойный трекер цикла в Telegram",
    description: "Трекер цикла без розового и без слежки. Работает прямо в Telegram.",
  },
  es: {
    title: "Sana — seguimiento del ciclo en Telegram",
    description:
      "Seguimiento del ciclo, en calma. Sin anuncios, sin venta de datos. Directamente en Telegram.",
  },
  uk: {
    title: "Sana — спокійний трекер циклу в Telegram",
    description: "Трекер циклу без рожевого і без стеження. Працює прямо в Telegram.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const meta = META_BY_LOCALE[locale] ?? META_BY_LOCALE.en;
  const url = locale === "en" ? SITE_URL : `${SITE_URL}/${locale}`;

  return {
    title: meta.title,
    description: meta.description,
    alternates: {
      canonical: url,
      languages: {
        en: SITE_URL,
        ru: `${SITE_URL}/ru`,
        es: `${SITE_URL}/es`,
        uk: `${SITE_URL}/uk`,
      },
    },
    openGraph: {
      type: "website",
      url,
      siteName: "Sana",
      title: meta.title,
      description: meta.description,
      locale,
    },
    twitter: {
      card: "summary_large_image",
      title: meta.title,
      description: meta.description,
    },
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
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
