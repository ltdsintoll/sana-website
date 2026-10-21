"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, type ReactNode } from "react";
import { IS_MOCK } from "../api/client";
import { fmtDate } from "../lib/dates";
import { resyncPush, swApiOrigin } from "../lib/push";
import { useCabinet } from "../state/hooks";
import { store } from "../state/store";
import { ConsentGate } from "./consent";
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
  // The worker calls the API itself only for notification actions ("Started today").
  const api = swApiOrigin();
  const url = `/app-sw.js?v=${encodeURIComponent(BUILD_ID)}${api ? `&api=${encodeURIComponent(api)}` : ""}`;
  navigator.serviceWorker
    .register(url, { scope, updateViaCache: "none" })
    .catch(() => {
      /* offline support is optional */
    });
}

export default function CabinetRoot({ children }: { children: ReactNode }) {
  const { auth, me } = useCabinet();
  const meId = auth === "authed" ? me?.id : undefined;

  useEffect(() => {
    void store.start();
    registerServiceWorker();
    // A notification action changed data in the background: refetch.
    const onSwMessage = (e: MessageEvent<{ type?: string }>) => {
      if (e.data?.type === "sana-sync") void store.refresh({ force: true });
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    if (IS_MOCK) {
      void import("../api/mock").then((m) => {
        (window as unknown as { __sanaMock: unknown }).__sanaMock = {
          simulateRemoteChange: m.simulateRemoteChange,
          simulateMergeElsewhere: m.simulateMergeElsewhere,
          expireSession: m.expireSession,
        };
      });
    }
    return () => navigator.serviceWorker?.removeEventListener("message", onSwMessage);
  }, []);

  // Contract 8, step 3: re-send this device's push subscription on every start.
  useEffect(() => {
    if (meId) void resyncPush(meId);
  }, [meId]);

  return (
    <div className="cab pt-safe min-h-dvh bg-c-bg text-c-ink">
      <UIProvider>
        {IS_MOCK ? <DemoBanner /> : null}
        {children}
        <ReplayNotices />
        <ConsentGate />
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
