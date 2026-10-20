/* Sana personal cabinet service worker.
 *
 * Scope: /app (or /<locale>/app). Registered by src/cabinet/ui/CabinetRoot.tsx
 * with ?v=<build id>, so every deploy installs a fresh worker and cache.
 *
 * What it does:
 *   - precaches the app shell (all cabinet routes of this scope + their JS/CSS),
 *   - navigations: network first, cached shell when offline,
 *   - /_next/static/*: cache first (immutable, hashed file names),
 *   - icons / manifest: stale-while-revalidate.
 * What it never does:
 *   - cache API responses. Health data is kept by the page itself, encrypted in
 *     IndexedDB, together with the outbox of queued changes (see
 *     src/cabinet/state/store.ts). The page replays the outbox on load,
 *     focus, visibilitychange and online (iOS has no Background Sync).
 *
 * TODO(push): Web Push is not in API contract v1. When the backend exposes
 * VAPID + subscription endpoints, add `push` and `notificationclick` handlers
 * here and a toggle in Settings -> Notifications.
 */

const VERSION = new URL(self.location.href).searchParams.get("v") || "dev";
const SHELL = `sana-shell-${VERSION}`;
const STATIC = `sana-static-${VERSION}`;
const ROUTES = ["", "/today", "/calendar", "/stats", "/settings", "/day", "/login", "/onboarding"];

function basePath() {
  return new URL(self.registration.scope).pathname.replace(/\/$/, "");
}

async function precache() {
  const base = basePath();
  const shell = await caches.open(SHELL);
  const assets = new Set();
  await Promise.all(
    ROUTES.map(async (r) => {
      try {
        const res = await fetch(base + r, { credentials: "same-origin", cache: "no-store" });
        if (!res.ok || res.redirected) return;
        const html = await res.clone().text();
        await shell.put(base + r, res);
        for (const m of html.matchAll(/["'(](\/_next\/static\/[^"'()\s]+)["')]/g)) assets.add(m[1]);
      } catch (_) {
        /* offline during install: skip */
      }
    }),
  );
  const stat = await caches.open(STATIC);
  await Promise.all(
    [...assets].map((a) =>
      stat.match(a).then((hit) => hit || fetch(a).then((res) => res.ok && stat.put(a, res)).catch(() => {})),
    ),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([SHELL, STATIC]);
      for (const k of await caches.keys()) if (k.startsWith("sana-") && !keep.has(k)) await caches.delete(k);
      await self.clients.claim();
    })(),
  );
});

function isRsc(req, url) {
  return req.headers.get("RSC") === "1" || url.searchParams.has("_rsc");
}

async function networkFirstPage(req) {
  const url = new URL(req.url);
  const key = url.pathname.replace(/\/$/, "");
  const shell = await caches.open(SHELL);
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(req, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok && !res.redirected && ROUTES.includes(key.slice(basePath().length))) {
      await shell.put(key, res.clone());
    }
    return res;
  } catch (_) {
    const base = basePath();
    return (
      (await shell.match(key)) ||
      (await shell.match(base + "/today")) ||
      (await shell.match(base)) ||
      new Response(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sana</title><body style="font-family:system-ui;padding:2rem;text-align:center;color:#555">Offline. Open Sana again when you are connected.</body>',
        { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
      )
    );
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  const net = fetch(req)
    .then((res) => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || net;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API and third parties: untouched
  if (url.pathname.startsWith("/api/")) return; // proxied API: never cached

  if (req.mode === "navigate") {
    if (url.pathname === basePath() || url.pathname.startsWith(basePath() + "/")) {
      event.respondWith(networkFirstPage(req));
    }
    return;
  }
  if (isRsc(req, url)) return; // RSC payloads: network only (Next falls back to a full navigation)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(req));
    return;
  }
  if (
    url.pathname.startsWith("/pwa-icon/") ||
    url.pathname === "/app.webmanifest" ||
    url.pathname === "/icon" ||
    url.pathname === "/apple-icon"
  ) {
    event.respondWith(staleWhileRevalidate(req));
  }
});
