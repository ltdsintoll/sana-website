"use client";

import { useLocale } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, IS_MOCK, NetworkError, api } from "../api/client";
import type { MergeDetails, Me, TelegramWidgetUser } from "../api/types";

export type DeepLinkState =
  | { kind: "idle" }
  | { kind: "starting" }
  | { kind: "waiting"; botUrl: string; pollToken: string; intervalMs: number; expiresAt: number }
  | { kind: "merge"; pollToken: string; details: MergeDetails }
  | { kind: "expired" }
  | { kind: "cancelled" }
  | { kind: "error"; code: string };

/**
 * Telegram login/link through the bot deep link (best on phones): start ->
 * open t.me link -> user confirms in the bot -> we poll until confirmed.
 * Polling pauses while the tab is hidden (the user is in Telegram) and resumes
 * immediately when they come back.
 */
export function useTelegramDeepLink(purpose: "login" | "link", onConfirmed: (user: Me) => void) {
  const [state, setState] = useState<DeepLinkState>({ kind: "idle" });
  const confirmedRef = useRef(onConfirmed);
  confirmedRef.current = onConfirmed;

  const start = useCallback(async () => {
    setState({ kind: "starting" });
    try {
      const r = await api.telegramStart(purpose);
      setState({
        kind: "waiting",
        botUrl: r.botUrl,
        pollToken: r.pollToken,
        intervalMs: Math.max(1000, r.pollIntervalMs || 2000),
        expiresAt: Date.parse(r.expiresAt) || Date.now() + 600_000,
      });
    } catch (e) {
      setState({ kind: "error", code: e instanceof ApiError ? e.code : "network" });
    }
  }, [purpose]);

  const poll = useCallback(async (pollToken: string, merge: boolean): Promise<"again" | "stop"> => {
    try {
      const r = await api.telegramPoll(pollToken, merge);
      if (r.status === "confirmed") {
        setState({ kind: "idle" });
        confirmedRef.current(r.user);
        return "stop";
      }
      if (r.status === "expired" || r.status === "cancelled") {
        setState({ kind: r.status });
        return "stop";
      }
      return "again";
    } catch (e) {
      if (e instanceof ApiError && e.code === "merge_required") {
        setState({ kind: "merge", pollToken, details: e.details as MergeDetails });
        return "stop";
      }
      if (e instanceof NetworkError) return "again";
      setState({ kind: "error", code: e instanceof ApiError ? e.code : "unknown" });
      return "stop";
    }
  }, []);

  useEffect(() => {
    if (state.kind !== "waiting") return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const tick = async () => {
      timer = null;
      if (stopped) return;
      if (Date.now() > state.expiresAt) {
        setState({ kind: "expired" });
        return;
      }
      if (document.visibilityState === "hidden") return; // resumed by visibilitychange
      const next = await poll(state.pollToken, false);
      if (!stopped && next === "again") timer = setTimeout(tick, state.intervalMs);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && !timer) void tick();
    };
    timer = setTimeout(tick, state.intervalMs);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [state, poll]);

  const confirmMerge = useCallback(async () => {
    if (state.kind !== "merge") return;
    await poll(state.pollToken, true);
  }, [state, poll]);

  const reset = useCallback(() => setState({ kind: "idle" }), []);

  return { state, start, confirmMerge, reset };
}

/**
 * Telegram Login Widget (desktop). Requires BotFather /setdomain for the site.
 * In demo mode a stand-in button is shown instead of the external script.
 */
export function TelegramWidget({
  botUsername,
  onAuth,
  demoLabel,
}: {
  botUsername: string;
  onAuth: (u: TelegramWidgetUser) => void;
  demoLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const cb = useRef(onAuth);
  cb.current = onAuth;

  useEffect(() => {
    if (IS_MOCK || !ref.current || !botUsername) return;
    const w = window as unknown as { __sanaTgAuth?: (u: TelegramWidgetUser) => void };
    w.__sanaTgAuth = (u) => cb.current(u);
    const s = document.createElement("script");
    s.async = true;
    s.src = "https://telegram.org/js/telegram-widget.js?22";
    s.setAttribute("data-telegram-login", botUsername);
    s.setAttribute("data-size", "large");
    s.setAttribute("data-radius", "14");
    s.setAttribute("data-userpic", "false");
    s.setAttribute("data-request-access", "write");
    s.setAttribute("data-lang", locale);
    s.setAttribute("data-onauth", "__sanaTgAuth(user)");
    const host = ref.current;
    host.innerHTML = "";
    host.appendChild(s);
    return () => {
      host.innerHTML = "";
    };
  }, [botUsername, locale]);

  if (IS_MOCK) {
    return (
      <button
        type="button"
        className="min-h-12 rounded-2xl bg-[#54a9eb] px-5 text-base font-medium text-white"
        onClick={() =>
          onAuth({ id: 100200300, first_name: "Anna", username: "anna", auth_date: Math.floor(Date.now() / 1000), hash: "demo" })
        }
      >
        {demoLabel}
      </button>
    );
  }
  return <div ref={ref} className="flex min-h-12 justify-center" />;
}
