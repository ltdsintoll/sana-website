"use client";

import { useTranslations, useLocale } from "next-intl";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, type Command } from "../api/client";
import type { NeedsConfirmationDetails } from "../api/types";
import { fmtDate } from "../lib/dates";
import { store } from "../state/store";
import { undoCommands } from "../state/undo";
import { Button, Sheet } from "./primitives";

type Toast = { id: number; text: string; tone: "info" | "error"; action?: { label: string; run: () => void } };
type ConfirmOpts = { title: string; body?: string; confirmLabel: string; danger?: boolean };
type StartChoice = "continuation" | "spotting" | "new_cycle";

type UI = {
  toast: (text: string, opts?: { tone?: Toast["tone"]; action?: Toast["action"]; ms?: number }) => void;
  confirm: (o: ConfirmOpts) => Promise<boolean>;
  askStartOption: (d: NeedsConfirmationDetails) => Promise<StartChoice | null>;
  /** Runs a cycle command with undo toast, offline queue and the 409/422 flows. */
  exec: (cmd: Command, successText: string) => Promise<boolean>;
};

const Ctx = createContext<UI | null>(null);

export function useUI(): UI {
  const v = useContext(Ctx);
  if (!v) throw new Error("UIProvider missing");
  return v;
}

export function UIProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("cab");
  const locale = useLocale();
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmState, setConfirmState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null);
  const [startState, setStartState] = useState<
    (NeedsConfirmationDetails & { resolve: (v: StartChoice | null) => void }) | null
  >(null);

  const showToast = useCallback<UI["toast"]>((text, opts) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, text, tone: opts?.tone ?? "info", action: opts?.action });
    timer.current = setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), opts?.ms ?? (opts?.action ? 7000 : 3500));
  }, []);

  const confirm = useCallback<UI["confirm"]>(
    (o) => new Promise<boolean>((resolve) => setConfirmState({ ...o, resolve })),
    [],
  );

  const askStartOption = useCallback<UI["askStartOption"]>(
    (d) => new Promise<StartChoice | null>((resolve) => setStartState({ ...d, resolve })),
    [],
  );

  const errorText = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError) {
        if (e.code === "future_date") return t("errors.futureDate");
        if (e.code === "rate_limited" || e.code === "too_many_attempts") return t("errors.rateLimited");
        if (e.code === "forbidden_origin") return t("errors.forbiddenOrigin");
        if (e.status === 401) return t("errors.sessionExpired");
      }
      return t("errors.generic");
    },
    [t],
  );

  const exec: UI["exec"] = useCallback(
    async (cmd: Command, successText: string): Promise<boolean> => {
      let r;
      try {
        r = await store.run(cmd);
      } catch (e) {
        if (e instanceof ApiError && e.code === "needs_confirmation" && cmd.type === "periodStart") {
          const choice = await askStartOption(e.details as NeedsConfirmationDetails);
          if (!choice) return false;
          const text =
            choice === "spotting" ? t("startConfirm.spottingSaved") : choice === "continuation" ? t("startConfirm.continuationSaved") : successText;
          return exec({ ...cmd, as: choice }, text);
        }
        showToast(errorText(e), { tone: "error" });
        return false;
      }
      try {
        navigator.vibrate?.(12);
      } catch {
        /* no haptics */
      }
      if (r.status === "queued") {
        const item = r.item;
        showToast(`${successText}. ${t("sync.savedOffline")}`, {
          action: { label: t("common.undo"), run: () => store.cancelQueued(item.id) },
        });
        return true;
      }
      const undo = undoCommands(cmd, r.before, r.after);
      showToast(successText, {
        action: undo.length
          ? {
              label: t("common.undo"),
              run: async () => {
                try {
                  for (const c of undo) await store.run(c);
                  showToast(t("common.undone"));
                } catch (e) {
                  showToast(errorText(e), { tone: "error" });
                }
              },
            }
          : undefined,
      });
      return true;
    },
    [askStartOption, errorText, showToast, t],
  );

  const value = useMemo(() => ({ toast: showToast, confirm, askStartOption, exec }), [showToast, confirm, askStartOption, exec]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast ? (
        <div className="bottom-tabbar pointer-events-none fixed inset-x-0 z-[60] flex justify-center px-4" role="status" aria-live="polite">
          <div
            className={`fade-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-sm shadow-lg ${
              toast.tone === "error" ? "bg-c-danger text-white" : "bg-c-ink text-c-bg"
            }`}
          >
            <span className="min-w-0 flex-1">{toast.text}</span>
            {toast.action ? (
              <button
                type="button"
                className="-my-2 min-h-11 shrink-0 rounded-xl px-3 font-semibold underline-offset-2 active:opacity-70"
                onClick={() => {
                  const a = toast.action!;
                  setToast(null);
                  a.run();
                }}
              >
                {toast.action.label}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <Sheet
        open={!!confirmState}
        onClose={() => {
          confirmState?.resolve(false);
          setConfirmState(null);
        }}
        title={confirmState?.title ?? ""}
        labelClose={t("common.close")}
      >
        {confirmState?.body ? <p className="mb-5 text-base text-c-muted">{confirmState.body}</p> : null}
        <div className="flex flex-col gap-2">
          <Button
            variant={confirmState?.danger ? "period" : "primary"}
            className={confirmState?.danger ? "!bg-c-danger !text-white" : ""}
            block
            onClick={() => {
              confirmState?.resolve(true);
              setConfirmState(null);
            }}
          >
            {confirmState?.confirmLabel}
          </Button>
          <Button
            variant="ghost"
            block
            onClick={() => {
              confirmState?.resolve(false);
              setConfirmState(null);
            }}
          >
            {t("common.cancel")}
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={!!startState}
        onClose={() => {
          startState?.resolve(null);
          setStartState(null);
        }}
        title={t("startConfirm.title")}
        labelClose={t("common.close")}
      >
        {startState ? (
          <>
            <p className="mb-4 text-base text-c-muted">
              {t("startConfirm.body", { date: fmtDate(startState.previousStartYmd, locale) })}
            </p>
            <div className="flex flex-col gap-2">
              {(["continuation", "spotting", "new_cycle"] as const)
                .filter((o) => startState.options.includes(o))
                .map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => {
                      startState.resolve(o);
                      setStartState(null);
                    }}
                    className="min-h-14 rounded-2xl border border-c-line bg-c-card px-4 py-3 text-left active:bg-c-raised"
                  >
                    <span className="block text-base font-medium text-c-ink">{t(`startConfirm.${o}`)}</span>
                    <span className="block text-sm text-c-muted">{t(`startConfirm.${o}Hint`)}</span>
                  </button>
                ))}
            </div>
          </>
        ) : null}
      </Sheet>
    </Ctx.Provider>
  );
}
