import { getRequestConfig } from "next-intl/server";
import { defaultLocale, locales, type Locale } from "./config";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale: Locale =
    requested && (locales as readonly string[]).includes(requested)
      ? (requested as Locale)
      : defaultLocale;
  const [site, cab] = await Promise.all([
    import(`../../messages/${locale}.json`),
    import(`../../messages/cabinet/${locale}.json`),
  ]);
  return {
    locale,
    // `cab` holds the personal cabinet strings; the root layout strips it so
    // marketing pages do not ship them to the browser.
    messages: { ...site.default, cab: cab.default },
  };
});
