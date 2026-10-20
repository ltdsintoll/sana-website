import { type Locale, locales } from "@/i18n/config";
import en from "../../../messages/cabinet/en.json";
import es from "../../../messages/cabinet/es.json";
import ru from "../../../messages/cabinet/ru.json";
import uk from "../../../messages/cabinet/uk.json";

const MESSAGES = { en, es, ru, uk } as const;

// PWA manifest of the personal cabinet, scoped to /app (or /<locale>/app) so
// the installed app opens straight into the cabinet, not the landing page.
export function GET(req: Request) {
  const requested = new URL(req.url).searchParams.get("locale");
  const locale: Locale = (locales as readonly string[]).includes(requested ?? "") ? (requested as Locale) : "en";
  const base = locale === "en" ? "/app" : `/${locale}/app`;
  const m = MESSAGES[locale];
  const manifest = {
    id: `${base}/`,
    name: m.meta.appName,
    short_name: "Sana",
    description: m.meta.description,
    lang: locale,
    start_url: `${base}/today?source=pwa`,
    scope: base,
    display: "standalone",
    orientation: "portrait",
    background_color: "#f7f6fb",
    theme_color: "#f7f6fb",
    categories: ["health", "lifestyle"],
    icons: [
      { src: "/pwa-icon/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: m.tabs.today, url: `${base}/today?source=pwa` },
      { name: m.tabs.calendar, url: `${base}/calendar?source=pwa` },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
