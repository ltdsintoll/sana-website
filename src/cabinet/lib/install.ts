"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

export type InstallInfo = {
  standalone: boolean;
  ios: boolean;
  canPrompt: boolean;
  prompt: () => Promise<void>;
};

export function useInstall(): InstallInfo {
  const [, force] = useState(0);
  const [env, setEnv] = useState({ standalone: false, ios: false });
  useEffect(() => {
    const l = () => force((n) => n + 1);
    listeners.add(l);
    const nav = navigator as Navigator & { standalone?: boolean };
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    setEnv({
      standalone: !!nav.standalone || window.matchMedia("(display-mode: standalone)").matches,
      ios,
    });
    return () => {
      listeners.delete(l);
    };
  }, []);
  return {
    ...env,
    canPrompt: !!deferred,
    prompt: async () => {
      if (!deferred) return;
      await deferred.prompt();
      deferred = null;
      force((n) => n + 1);
    },
  };
}
