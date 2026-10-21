"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "@/i18n/navigation";
import { store } from "../state/store";
import { FullScreenSpinner } from "../ui/layout";

/** /app/logout: ends the session on the server and wipes local data. */
export default function LogoutScreen() {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    void store.logout().then(() => router.replace("/app/login"));
  }, [router]);
  return <FullScreenSpinner />;
}
