import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sanacycle.com";
const LOCALES = ["en", "ru", "es", "uk"] as const;
const PATHS = ["", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const path of PATHS) {
    for (const locale of LOCALES) {
      const prefix = locale === "en" ? "" : `/${locale}`;
      entries.push({
        url: `${SITE_URL}${prefix}${path}`,
        lastModified: now,
        changeFrequency: path === "" ? "weekly" : "monthly",
        priority: path === "" ? 1 : 0.5,
      });
    }
  }

  return entries;
}
