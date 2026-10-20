"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { useCabinet } from "../state/hooks";
import { FullScreenSpinner } from "../ui/layout";

export default function AppIndex() {
  const { auth } = useCabinet();
  const router = useRouter();
  useEffect(() => {
    if (auth === "authed") router.replace("/app/today");
    else if (auth === "anon") router.replace("/app/login");
  }, [auth, router]);
  return <FullScreenSpinner />;
}
