import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import type { ReactNode } from "react";
import { startupImages } from "@/cabinet/lib/splash";
import CabinetRoot from "@/cabinet/ui/CabinetRoot";

// Personal cabinet: private, never indexed, no analytics, own PWA manifest.
export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cab.meta" });
  return {
    title: { default: t("title"), template: `%s · Sana` },
    description: t("description"),
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    alternates: null,
    openGraph: null,
    twitter: null,
    manifest: `/app.webmanifest?locale=${locale}`,
    appleWebApp: { capable: true, title: "Sana", statusBarStyle: "default", startupImage: startupImages() },
    formatDetection: { telephone: false, email: false, address: false, date: false },
    referrer: "same-origin",
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#111015" },
  ],
};

export default async function CabinetLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  // Rendered per request: the CSP nonce from src/proxy.ts must reach the scripts.
  await connection();
  const { locale } = await params;
  setRequestLocale(locale);
  const messages = (await getMessages()) as Record<string, unknown>;
  return (
    <NextIntlClientProvider messages={{ cab: messages.cab } as never}>
      <CabinetRoot>{children}</CabinetRoot>
    </NextIntlClientProvider>
  );
}
