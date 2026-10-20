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

Demo mode: any email, code `123456`; `new@…`, `period@…`, `late@…`, `pregnant@…` show other states,
`merge…@…` triggers the account-merge confirmation.

Privacy: no analytics on `/app` (Google Analytics is only in the marketing layout), `noindex`,
no health data in URLs or logs, the offline cache is AES-GCM encrypted in IndexedDB and wiped on logout.
