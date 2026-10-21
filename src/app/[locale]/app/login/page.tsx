import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import LoginScreen from "@/cabinet/screens/LoginScreen";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cab.meta" });
  return { title: t("login") };
}

export default function Page() {
  return <LoginScreen />;
}
