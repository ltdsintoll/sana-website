"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { IS_MOCK } from "../api/client";
import { fmtDate } from "../lib/dates";
import { useCabinet } from "../state/hooks";
import { store } from "../state/store";
import { Button, Sheet } from "./primitives";
import { UIProvider, useUI } from "./ui-context";

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID ?? "dev";

/** Scope of the service worker = the cabinet root of the current locale ("/app" or "/ru/app"). */
export function appBasePath(): string {
  const m = window.location.pathname.match(/^(.*?\/app)(?:\/|$)/);
  return m ? m[1] : "/app";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (process.env.NODE_ENV !== "production" && !IS_MOCK) return;
  const scope = appBasePath();
  navigator.serviceWorker
    .register(`/app-sw.js?v=${encodeURIComponent(BUILD_ID)}`, { scope, updateViaCache: "none" })
    .catch(() => {
      /* offline support is optional */
    });
}

export default function CabinetRoot({ children }: { children: ReactNode }) {
  useEffect(() => {
    void store.start();
    registerServiceWorker();
    if (IS_MOCK) {
      void import("../api/mock").then((m) => {
        (window as unknown as { __sanaMock: unknown }).__sanaMock = { simulateRemoteChange: m.simulateRemoteChange };
      });
    }
  }, []);

  return (
    <div className="cab pt-safe min-h-dvh bg-c-bg text-c-ink">
      <UIProvider>
        {IS_MOCK ? <DemoBanner /> : null}
        {children}
        <ReplayNotices />
      </UIProvider>
    </div>
  );
}

function DemoBanner() {
  const t = useTranslations("cab");
  return (
    <div className="bg-c-pms-soft text-c-pms">
      <p className="px-safe py-1.5 text-center text-xs font-medium">{t("demo.banner")}</p>
    </div>
  );
}

function ReplayNotices() {
  const t = useTranslations("cab");
  const locale = useLocale();
  const { replayConflict, droppedOnReplay } = useCabinet();
  const ui = useUI();

  useEffect(() => {
    if (droppedOnReplay > 0) {
      ui.toast(t("sync.dropped", { count: droppedOnReplay }), { tone: "error", ms: 6000 });
      store.ackDropped();
    }
  }, [droppedOnReplay, t, ui]);

  const cmd = replayConflict?.item.cmd;
  return (
    <Sheet
      open={!!replayConflict}
      onClose={() => void store.resolveReplayConflict("discard")}
      title={t("startConfirm.title")}
      labelClose={t("common.close")}
    >
      {replayConflict && cmd?.type === "periodStart" ? (
        <>
          <p className="mb-4 text-base text-c-muted">
            {t("startConfirm.queuedBody", {
              date: fmtDate(cmd.date, locale),
              prev: fmtDate(replayConflict.details.previousStartYmd, locale),
            })}
          </p>
          <div className="flex flex-col gap-2">
            {(["continuation", "spotting", "new_cycle"] as const).map((o) => (
              <Button key={o} variant="outline" block onClick={() => void store.resolveReplayConflict(o)}>
                {t(`startConfirm.${o}`)}
              </Button>
            ))}
            <Button variant="ghost" block onClick={() => void store.resolveReplayConflict("discard")}>
              {t("startConfirm.discard")}
            </Button>
          </div>
        </>
      ) : null}
    </Sheet>
  );
}
