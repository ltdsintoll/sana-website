import type { Metadata } from "next";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://sanacycle.com").replace(/\/+$/, "");

/** Indexable marketing pages (the personal cabinet under /app is noindex). */
export const SITE_PATHS = ["", "/privacy", "/terms"] as const;
export type SitePath = (typeof SITE_PATHS)[number];

const OG_LOCALE: Record<Locale, string> = { en: "en_US", ru: "ru_RU", es: "es_ES", uk: "uk_UA" };

export const HOME_META: Record<Locale, { title: string; description: string }> = {
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

export function toLocale(value: string): Locale {
  return (locales as readonly string[]).includes(value) ? (value as Locale) : defaultLocale;
}

/** Absolute URL of a page in a locale, matching `localePrefix: "as-needed"` routing. */
export function localizedUrl(locale: Locale, path: SitePath): string {
  const prefix = locale === defaultLocale ? "" : `/${locale}`;
  return `${SITE_URL}${prefix}${path}` || SITE_URL;
}

/** hreflang alternates for a page: every locale plus x-default (the default locale). */
export function languageAlternates(path: SitePath): Record<string, string> {
  const languages: Record<string, string> = {};
  for (const locale of locales) languages[locale] = localizedUrl(locale, path);
  languages["x-default"] = localizedUrl(defaultLocale, path);
  return languages;
}

/**
 * Per-page SEO metadata: a self-referencing canonical for this locale, hreflang
 * alternates for all locales, and Open Graph / Twitter tags for the same URL.
 */
export function pageMetadata({
  locale,
  path,
  title,
  description,
}: {
  locale: Locale;
  path: SitePath;
  title: string;
  description: string;
}): Metadata {
  const url = localizedUrl(locale, path);
  // Set explicitly: a nested `openGraph` object replaces the one built from
  // app/opengraph-image.tsx, so without this pages had no share image.
  const image = { url: "/opengraph-image", width: 1200, height: 630, alt: HOME_META.en.title };
  return {
    title,
    description,
    alternates: { canonical: url, languages: languageAlternates(path) },
    openGraph: {
      type: "website",
      url,
      siteName: "Sana",
      title,
      description,
      locale: OG_LOCALE[locale],
      alternateLocale: locales.filter((l) => l !== locale).map((l) => OG_LOCALE[l]),
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image.url] },
  };
}
