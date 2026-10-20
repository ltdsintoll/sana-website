# Sana Website

Landing page for sanacycle.com — Telegram Mini App for cycle tracking.

- App repo: https://github.com/ltdsintoll/hercycle
- App: https://t.me/HerCycleBot
- Stack: Next.js 16 App Router + Tailwind v4 + next-intl

## Dev

`npm run dev`

## Deploy

Auto-deploy from main via Vercel.

## Personal cabinet (`/app`)

The cabinet lives under `/[locale]/app` (`/app`, `/ru/app`, ...): login (email code or Telegram),
onboarding, Today, Calendar, Day log, Stats, Settings. It is a client of the Sana API in
`ltdsintoll/hercycle` (contract: `GET/POST /api/auth/*`, `/api/v2/*`, `/api/symptoms`), so the
data is the same as in the Telegram bot and Mini App. All cycle calculations come from the API.

| Env var | Meaning |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | API origin, e.g. `https://api.sanacycle.com`. `""` = same origin (use with `API_PROXY_TARGET`). **Not set = demo mode** with built-in fixtures. |
| `API_PROXY_TARGET` | Optional. Proxies `/api/*` (except local routes like `/api/subscribe`) to this origin, e.g. `https://hercycle-production.up.railway.app`. |
| `NEXT_PUBLIC_API_MOCK` | `1` forces demo mode even when the base URL is set. |

Code: `src/cabinet/` (API client, store with offline outbox, screens), routes in
`src/app/[locale]/app/`, PWA manifest `src/app/app.webmanifest/route.ts`, icons
`src/app/pwa-icon/`, service worker `public/app-sw.js`. Cabinet strings: `messages/cabinet/*.json`.

Routes besides the main tabs: `/app/partner` (a partner's view of a shared cycle) and
`/app/partner/accept?invite=<uuid>` (accepting an invite link from Settings → Partner).
`/api/email/unsubscribe` is a local route handler for the unsubscribe link in reminder emails: GET
only shows a confirmation button, POST forwards the token to the API (`API_PROXY_TARGET`, else the
origin of `NEXT_PUBLIC_API_BASE_URL`).

API contract features used (hercycle `api-contract.md` v1.3):
- Web Push (§8): enabled per device in Settings → Notifications. Needs VAPID keys on the API
  (`/api/auth/config` returns `vapidPublicKey`). On iPhone/iPad push only works after
  "Add to Home Screen" (iOS 16.4+); the page explains this.
- Notification channels (§9): browser push, Telegram, opt-in email fallback.
- Partners (§10): invites, permissions, partner view, advice and nudges; no more bot link.
- GDPR consent (§12): health-data writes answer `403 consent_required` until consent is accepted.
  New accounts accept in onboarding; on any `403 consent_required` the consent sheet opens and the
  write (or the queued offline change) is sent again after "Agree".

Demo mode: any email, code `123456`; `new@…`, `period@…`, `late@…`, `pregnant@…` show other states,
`merge…@…` triggers the account-merge confirmation, `partner…@…` already sees a demo partner's cycle,
`locked…@…` shows the email-code lockout (429), `noconsent…@…` has data but no consent yet.

## Checks

| Command | What |
|---|---|
| `npm run lint` | ESLint (Next core-web-vitals + TypeScript) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run i18n:check` | Same keys, placeholders and plural forms in en/ru/uk/es |
| `npm run test:e2e` | Playwright e2e in demo mode (builds and starts the app on port 3100) |

E2E needs Chromium once per machine/CI runner: `npx playwright install --with-deps chromium`.
`E2E_BASE_URL=http://localhost:3100` reuses a running server; `E2E_SCREENSHOTS=<dir>` saves review screenshots.

Privacy: no analytics on `/app` (Google Analytics is only in the marketing layout), `noindex`,
no health data in URLs or logs, the offline cache is AES-GCM encrypted in IndexedDB and wiped on logout.
