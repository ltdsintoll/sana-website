import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { languageAlternates, localizedUrl, SITE_PATHS } from "@/lib/seo";

// Same URLs as the canonical links on the pages, each with its hreflang set.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return SITE_PATHS.flatMap((path) =>
    locales.map((locale) => ({
      url: localizedUrl(locale, path),
      lastModified: now,
      changeFrequency: path === "" ? ("weekly" as const) : ("monthly" as const),
      priority: path === "" ? 1 : 0.5,
      alternates: { languages: languageAlternates(path) },
    })),
  );
}
