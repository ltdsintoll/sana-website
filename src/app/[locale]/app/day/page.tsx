import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import DayLogScreen from "@/cabinet/screens/DayLogScreen";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cab.meta" });
  return { title: t("day") };
}

export default function Page() {
  return <DayLogScreen />;
}
