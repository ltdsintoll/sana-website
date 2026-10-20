import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

// Optional: proxy the Sana API through this site (same-origin cookies). Set
// API_PROXY_TARGET=https://hercycle-production.up.railway.app and
// NEXT_PUBLIC_API_BASE_URL="" to use it. Local route handlers such as
// /api/subscribe keep priority (rewrites run after the filesystem).
const API_PROXY_TARGET = process.env.API_PROXY_TARGET?.replace(/\/+$/, "");

const APP_ROUTES = ["/app", "/app/:path*", "/:locale(en|ru|uk|es)/app", "/:locale(en|ru|uk|es)/app/:path*"];

const nextConfig: NextConfig = {
  env: {
    // Versions the cabinet service worker and its caches per deploy.
    NEXT_PUBLIC_BUILD_ID: (process.env.VERCEL_GIT_COMMIT_SHA ?? String(Date.now())).slice(0, 12),
  },
  async headers() {
    return [
      {
        source: "/app-sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      ...APP_ROUTES.map((source) => ({
        source,
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      })),
    ];
  },
  async rewrites() {
    if (!API_PROXY_TARGET) return [];
    return [{ source: "/api/:path*", destination: `${API_PROXY_TARGET}/api/:path*` }];
  },
};

export default withNextIntl(nextConfig);
