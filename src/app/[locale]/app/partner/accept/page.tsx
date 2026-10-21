import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import AcceptInviteScreen from "@/cabinet/screens/AcceptInviteScreen";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "cab.meta" });
  return { title: t("invite") };
}

export default function Page() {
  return <AcceptInviteScreen />;
}
