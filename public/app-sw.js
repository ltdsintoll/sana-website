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
 *   - Web Push (API contract v1.2, section 8): shows the reminders, opens the
 *     cabinet on click, "Started today/yesterday" actions call the API.
 * What it never does:
 *   - cache API responses. Health data is kept by the page itself, encrypted in
 *     IndexedDB, together with the outbox of queued changes (see
 *     src/cabinet/state/store.ts). The page replays the outbox on load,
 *     focus, visibilitychange and online (iOS has no Background Sync).
 */

const SW_URL = new URL(self.location.href);
const VERSION = SW_URL.searchParams.get("v") || "dev";
// Origin of the Sana API for notification actions; "" = same origin (proxied).
const API = (() => {
  try {
    const a = SW_URL.searchParams.get("api");
    return a ? new URL(a).origin : self.location.origin;
  } catch {
    return self.location.origin;
  }
})();
const SHELL = `sana-shell-${VERSION}`;
// Hashed /_next/static files never change, so one cache serves every deploy:
// a page still running the previous build can lazy-load its chunks offline
// after an update. Trimmed to the newest MAX_STATIC entries on activate.
const STATIC = "sana-static";
const MAX_STATIC = 400;
const ROUTES = ["", "/today", "/calendar", "/stats", "/settings", "/day", "/login", "/onboarding", "/partner", "/partner/accept"];

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
      } catch {
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
      const stat = await caches.open(STATIC);
      const keys = await stat.keys();
      for (const k of keys.slice(0, Math.max(0, keys.length - MAX_STATIC))) await stat.delete(k);
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
    if (res.ok && res.type === "basic" && !res.redirected && ROUTES.includes(key.slice(basePath().length))) {
      await shell.put(key, res.clone());
    }
    return res;
  } catch {
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
  if (res.ok && res.type === "basic") cache.put(req, res.clone());
  return res;
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(req);
  const net = fetch(req)
    .then((res) => {
      if (res.ok && res.type === "basic") cache.put(req, res.clone());
      return res;
    })
    .catch(() => hit || Response.error());
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

// ------------------------------------------------------------------ Web Push

const KINDS = new Set([
  "period_late_d1", "period_late_d3", "period_late_d7", "period_today", "period_soon", "pms_soon",
  "fertile_soon", "period_auto_closed", "partner_pms_soon", "nudge_sweets", "nudge_hug", "nudge_ask", "test",
]);
const ACTIONS = new Set(["period_started_today", "period_started_yesterday"]);

/** Only pages of this site are ever opened from a notification. */
function safeUrl(u) {
  try {
    const url = new URL(u, self.registration.scope);
    if (url.origin === self.location.origin) return url.href;
  } catch {
    /* fall through */
  }
  return new URL(basePath() || "/app", self.location.origin).href;
}

function showFromPayload(p) {
  if (!p || typeof p !== "object") p = {};
  const title = typeof p.title === "string" && p.title ? p.title.slice(0, 80) : "Sana";
  const body = typeof p.body === "string" ? p.body.slice(0, 300) : "";
  const kind = KINDS.has(p.kind) ? p.kind : "unknown";
  const actions = Array.isArray(p.actions)
    ? p.actions
        .filter((a) => a && ACTIONS.has(a.action) && typeof a.title === "string")
        .slice(0, 2)
        .map((a) => ({ action: a.action, title: a.title.slice(0, 40) }))
    : [];
  return self.registration.showNotification(title, {
    body,
    tag: typeof p.tag === "string" ? p.tag.slice(0, 64) : "sana",
    data: { url: safeUrl(p.url), kind, actions },
    actions,
    icon: "/pwa-icon/icon-192.png",
    badge: "/pwa-icon/badge-96.png",
    timestamp: typeof p.ts === "number" ? p.ts : Date.now(),
  });
}

self.addEventListener("push", (event) => {
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = { body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(showFromPayload(payload));
});

/** Demo mode and tests: a page of this origin can show the same notification. */
self.addEventListener("message", (event) => {
  const d = event.data;
  if (d && d.type === "sana-demo-push" && event.source && new URL(event.source.url).origin === self.location.origin) {
    event.waitUntil(showFromPayload(d.payload));
  }
});

function ymdOffset(days) {
  const d = new Date(Date.now() + days * 86400000);
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

async function openOrFocus(url) {
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  const scope = self.registration.scope;
  const mine = all.find((c) => c.url.startsWith(scope)) || all.find((c) => new URL(c.url).origin === self.location.origin);
  if (mine) {
    await mine.focus().catch(() => undefined);
    if (mine.url !== url && "navigate" in mine) await mine.navigate(url).catch(() => undefined);
    return;
  }
  await self.clients.openWindow(url);
}

async function notifyClients(msg) {
  const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  for (const c of all) c.postMessage(msg);
}

async function startPeriod(date) {
  const tz = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return undefined;
    }
  })();
  const headers = { "Content-Type": "application/json", Accept: "application/json" };
  if (tz) headers["X-Timezone"] = tz;
  const res = await fetch(`${API}/api/v2/periods/start`, {
    method: "POST",
    credentials: "include",
    headers,
    body: JSON.stringify({ date }),
  });
  return res.ok;
}

self.addEventListener("notificationclick", (event) => {
  const n = event.notification;
  const data = n.data || {};
  const url = safeUrl(data.url);
  n.close();
  event.waitUntil(
    (async () => {
      if (ACTIONS.has(event.action)) {
        const date = ymdOffset(event.action === "period_started_today" ? 0 : -1);
        let done = false;
        try {
          done = await startPeriod(date);
        } catch {
          done = false;
        }
        if (done) {
          await notifyClients({ type: "sana-sync" });
          const a = (data.actions || []).find((x) => x.action === event.action);
          await self.registration.showNotification("Sana", { body: `✓ ${a ? a.title : ""}`.trim(), tag: "sana-cycle", data: { url, kind: "ack" } });
          return;
        }
        // 409 needs_confirmation, offline, signed out...: let the user decide in the app.
      }
      await openOrFocus(url);
    })(),
  );
});

// The push service rotated the subscription: register the new one.
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const old = event.oldSubscription;
      const key = old && old.options ? old.options.applicationServerKey : null;
      const sub = event.newSubscription || (key ? await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key }) : null);
      if (!sub) return;
      await fetch(`${API}/api/v2/push/subscriptions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      }).catch(() => undefined);
    })(),
  );
});
