import createIntlMiddleware from "next-intl/middleware";
import { NextRequest } from "next/server";
import { routing } from "./i18n/routing";

const intl = createIntlMiddleware(routing);

/** Personal cabinet routes: /app, /app/..., /<locale>/app, /<locale>/app/... */
const APP_PATH = /^\/(?:(?:en|ru|uk|es)\/)?app(?:\/|$)/;

function origin(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

const API_ORIGIN = origin(process.env.NEXT_PUBLIC_API_BASE_URL);
const IS_MOCK = process.env.NEXT_PUBLIC_API_MOCK === "1" || process.env.NEXT_PUBLIC_API_BASE_URL === undefined;
const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Strict, nonce-based CSP for the cabinet (pages there are rendered per
 * request anyway). Next.js reads the nonce from the request header and puts
 * it on its own scripts; 'strict-dynamic' lets those load their chunks and the
 * Telegram Login Widget script.
 *
 * 'unsafe-eval' is only there because the Telegram Login Widget runs its
 * `data-onauth` handler with `new Function` (and React needs eval in dev).
 * It is left out in demo mode, where the widget is not loaded.
 */
function cabinetCsp(nonce: string, https: boolean): string {
  const evalSrc = IS_DEV || !IS_MOCK ? " 'unsafe-eval'" : "";
  const connect = ["'self'", API_ORIGIN, IS_DEV ? "ws: wss:" : null].filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evalSrc} https://telegram.org`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://telegram.org https://t.me https://*.telegram.org",
    "font-src 'self'",
    `connect-src ${connect}`,
    "frame-src https://oauth.telegram.org",
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    https ? "upgrade-insecure-requests" : null,
  ]
    .filter(Boolean)
    .join("; ");
}

export function proxy(request: NextRequest) {
  if (!APP_PATH.test(request.nextUrl.pathname)) return intl(request);

  const nonce = btoa(crypto.randomUUID());
  const https = (request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "")) === "https";
  const csp = cabinetCsp(nonce, https);
  const headers = new Headers(request.headers);
  headers.set("content-security-policy", csp);
  headers.set("x-nonce", nonce);

  // next-intl forwards the request headers to the page render, where Next.js
  // picks the nonce up from the Content-Security-Policy request header.
  const response = intl(new NextRequest(request, { headers }));
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Metadata image routes (/icon, /apple-icon, /opengraph-image) and the PWA
  // icons have no file extension: without them here the locale middleware
  // rewrote them to /<locale>/icon, a 404 (no favicon, no share preview).
  matcher: ["/((?!api|_next|_vercel|_static|pwa-icon|icon$|apple-icon$|opengraph-image$|.*\\..*).*)"],
};
