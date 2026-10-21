import { defineRouting } from "next-intl/routing";
import { defaultLocale, locales } from "./config";

export const routing = defineRouting({
  locales: [...locales],
  defaultLocale,
  localePrefix: "as-needed",
  // hreflang alternates come from page metadata (src/lib/seo.ts) on the
  // canonical domain. The middleware's `Link` header used the request host
  // instead, so on any other host (preview, www, localhost) the page's own
  // URL was an hreflang entry that differed from its canonical.
  alternateLinks: false,
});
