"use client";

import { useSyncExternalStore } from "react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    notify();
  });
}

function subscribe(l: () => void) {
  listeners.add(l);
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener?.("change", l);
  return () => {
    listeners.delete(l);
    mq.removeEventListener?.("change", l);
  };
}

/** Opened from the Home Screen (iOS) or as an installed app (Android/desktop). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return !!nav.standalone || window.matchMedia("(display-mode: standalone)").matches;
}

/** iPhone/iPad, including iPadOS that reports itself as a Mac. */
export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

export type InstallInfo = {
  standalone: boolean;
  ios: boolean;
  canPrompt: boolean;
  prompt: () => Promise<void>;
};

export function useInstall(): InstallInfo {
  const standalone = useSyncExternalStore(subscribe, isStandalone, () => false);
  const ios = useSyncExternalStore(subscribe, isIOS, () => false);
  const canPrompt = useSyncExternalStore(subscribe, () => !!deferred, () => false);
  return {
    standalone,
    ios,
    canPrompt,
    prompt: async () => {
      if (!deferred) return;
      await deferred.prompt();
      deferred = null;
      notify();
    },
  };
}
