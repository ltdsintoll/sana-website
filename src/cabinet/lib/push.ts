"use client";

// Web Push on this device (API contract v1.2, section 8).
//
// The browser subscription belongs to one account at a time. We remember the
// owner id next to it (localStorage, no health data) so that a different
// account signing in on this browser never silently inherits the reminders
// of the previous one: it has to switch them on itself.

import { API_BASE, IS_MOCK, api } from "../api/client";
import type { PushDevice, PushSubscriptionJSONBody } from "../api/types";
import { isIOS, isStandalone } from "./install";

const OWNER_KEY = "sana-push-owner";
/** Demo mode has no push service: the "subscription" is simulated. */
const DEMO_KEY = "sana-push-demo-endpoint";
/** Server id of this device (GET /push/subscriptions does not say which one is "here"). */
const DEVICE_KEY = "sana-push-device";

export function thisDeviceId(): string | null {
  return readLS(DEVICE_KEY);
}

export type PushSupport =
  | "supported"
  /** iPhone/iPad Safari tab: Web Push only works after "Add to Home Screen" (iOS 16.4+). */
  | "needs-install"
  | "unsupported";

export function pushSupport(): PushSupport {
  if (typeof window === "undefined") return "unsupported";
  const has = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIOS() && !isStandalone()) return "needs-install";
  return has ? "supported" : "unsupported";
}

export function permission(): NotificationPermission | "unsupported" {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeLS(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

/** The service worker registration of the cabinet (scope /app or /<locale>/app). */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const m = window.location.pathname.match(/^(.*?\/app)(?:\/|$)/);
  const scope = m ? m[1] : "/app";
  const reg = (await navigator.serviceWorker.getRegistration(scope)) ?? null;
  if (reg) return reg;
  // Registered moments ago by CabinetRoot: wait for it (but not forever).
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>((r) => setTimeout(() => r(null), 4000)),
  ]);
}

async function browserSubscription(): Promise<PushSubscription | null> {
  if (IS_MOCK) return null;
  const reg = await registration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/** Endpoint of this browser's subscription (sent with logout). */
export async function currentEndpoint(): Promise<string | null> {
  if (IS_MOCK) return readLS(DEMO_KEY);
  try {
    return (await browserSubscription())?.endpoint ?? null;
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function deviceLabel(): string | undefined {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "Windows";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Linux/.test(ua)) return "Linux";
  return undefined;
}

function toBody(sub: PushSubscription): PushSubscriptionJSONBody {
  const j = sub.toJSON() as { endpoint?: string; expirationTime?: number | null; keys?: { p256dh?: string; auth?: string } };
  return {
    endpoint: j.endpoint ?? sub.endpoint,
    expirationTime: j.expirationTime ?? null,
    keys: { p256dh: j.keys?.p256dh ?? "", auth: j.keys?.auth ?? "" },
  };
}

function demoSubscription(): PushSubscriptionJSONBody {
  let endpoint = readLS(DEMO_KEY);
  if (!endpoint) {
    endpoint = `https://fcm.googleapis.com/fcm/send/demo-${crypto.randomUUID()}`;
    writeLS(DEMO_KEY, endpoint);
  }
  return { endpoint, expirationTime: null, keys: { p256dh: "demo-p256dh", auth: "demo-auth" } };
}

export class PushError extends Error {
  constructor(public code: "denied" | "unsupported" | "needs-install" | "disabled" | "failed") {
    super(code);
  }
}

/**
 * Called from a click only (browsers ignore permission prompts otherwise).
 * Asks for permission, subscribes and registers the device for `ownerId`.
 */
export async function enablePush(vapidPublicKey: string | null | undefined, ownerId: string): Promise<PushDevice> {
  const support = pushSupport();
  if (support !== "supported") throw new PushError(support);
  if (!vapidPublicKey) throw new PushError("disabled");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new PushError("denied");

  let body: PushSubscriptionJSONBody;
  if (IS_MOCK) {
    body = demoSubscription();
  } else {
    const reg = await registration();
    if (!reg) throw new PushError("unsupported");
    let sub = await reg.pushManager.getSubscription();
    try {
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
    } catch {
      // A subscription made with an older server key: start over once.
      await sub?.unsubscribe().catch(() => undefined);
      try {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) });
      } catch {
        throw new PushError("failed");
      }
    }
    body = toBody(sub);
  }
  const r = await api.pushSubscribe(body, deviceLabel());
  writeLS(OWNER_KEY, ownerId);
  writeLS(DEVICE_KEY, r.subscription.id);
  return r.subscription;
}

/** "Turn off on this device": browser unsubscribe + tell the server. */
export async function disablePush(): Promise<void> {
  const endpoint = await currentEndpoint();
  if (!IS_MOCK) await (await browserSubscription().catch(() => null))?.unsubscribe().catch(() => undefined);
  writeLS(DEMO_KEY, null);
  writeLS(OWNER_KEY, null);
  writeLS(DEVICE_KEY, null);
  if (endpoint) await api.pushUnsubscribe(endpoint).catch(() => undefined);
}

/**
 * Forget the subscription locally only (logout, account deletion). The server
 * side is removed by the logout call itself (`pushEndpoint`).
 */
export async function dropLocalPush(): Promise<void> {
  if (!IS_MOCK) await (await browserSubscription().catch(() => null))?.unsubscribe().catch(() => undefined);
  writeLS(DEMO_KEY, null);
  writeLS(OWNER_KEY, null);
  writeLS(DEVICE_KEY, null);
}

/**
 * On every app start (contract 8, step 3): re-send the subscription so key
 * rotations reach the server. Only for the account that switched push on here;
 * for another account the old subscription is dropped instead.
 */
export async function resyncPush(ownerId: string): Promise<void> {
  try {
    const owner = readLS(OWNER_KEY);
    if (!owner) return;
    if (owner !== ownerId) {
      await dropLocalPush();
      return;
    }
    if (permission() !== "granted") return;
    if (IS_MOCK) {
      const endpoint = readLS(DEMO_KEY);
      if (endpoint) {
        const r = await api.pushSubscribe({ endpoint, expirationTime: null, keys: { p256dh: "demo-p256dh", auth: "demo-auth" } }, deviceLabel());
        writeLS(DEVICE_KEY, r.subscription.id);
      }
      return;
    }
    const sub = await browserSubscription();
    if (sub) {
      const r = await api.pushSubscribe(toBody(sub), deviceLabel());
      writeLS(DEVICE_KEY, r.subscription.id);
    }
  } catch {
    /* best effort */
  }
}

/** Is push switched on on this device for this account? */
export async function isPushOnHere(ownerId: string): Promise<boolean> {
  if (readLS(OWNER_KEY) !== ownerId || permission() !== "granted") return false;
  return !!(await currentEndpoint());
}

/** The API origin the service worker should use for notification actions. */
export function swApiOrigin(): string {
  if (IS_MOCK || !API_BASE) return "";
  try {
    return new URL(API_BASE).origin;
  } catch {
    return "";
  }
}

/** Demo mode: route a fake push through the service worker's own handler. */
export async function demoPush(payload: Record<string, unknown>): Promise<void> {
  const reg = await registration();
  const sw = reg?.active ?? navigator.serviceWorker?.controller;
  sw?.postMessage({ type: "sana-demo-push", payload });
}
