// Reminder-email unsubscribe link (API contract v1.2, section 9).
//
// The backend builds the link on API_PUBLIC_URL, or on the website when that is
// not set. Route handlers win over the /api rewrite, so this page answers on
// the website in both setups: GET only shows a confirmation (mail scanners
// prefetch links), POST (the button, or RFC 8058 one-click from the mail app)
// forwards to the API, which checks the signed token and turns the emails off.

export const dynamic = "force-dynamic";

const TEXT = {
  en: { ask: "Turn off Sana reminder emails?", button: "Turn off", done: "Done. Reminder emails are off.", invalid: "This link is invalid or has expired.", error: "Something went wrong. Please try again later.", demo: "Demo mode: no emails are sent." },
  ru: { ask: "Отключить письма-напоминания Sana?", button: "Отключить", done: "Готово, письма-напоминания отключены.", invalid: "Ссылка недействительна или устарела.", error: "Что-то пошло не так. Попробуйте позже.", demo: "Демо-режим: письма не отправляются." },
  uk: { ask: "Вимкнути листи-нагадування Sana?", button: "Вимкнути", done: "Готово, листи-нагадування вимкнено.", invalid: "Посилання недійсне або застаріле.", error: "Щось пішло не так. Спробуйте пізніше.", demo: "Демо-режим: листи не надсилаються." },
  es: { ask: "¿Desactivar los correos de recordatorio de Sana?", button: "Desactivar", done: "Listo, los correos de recordatorio están desactivados.", invalid: "El enlace no es válido o ha caducado.", error: "Algo salió mal. Inténtalo más tarde.", demo: "Modo demo: no se envían correos." },
} as const;
type Lang = keyof typeof TEXT;

function lang(req: Request): Lang {
  const header = req.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const code = part.trim().slice(0, 2).toLowerCase();
    if (code in TEXT) return code as Lang;
  }
  return "en";
}

/** Same format checks as the backend: a user uuid and a 32-char base64url token. */
function params(req: Request): { u: string; t: string } | null {
  const q = new URL(req.url).searchParams;
  const u = q.get("u") ?? "";
  const t = q.get("t") ?? "";
  return /^[0-9a-f-]{36}$/.test(u) && /^[A-Za-z0-9_-]{32}$/.test(t) ? { u, t } : null;
}

function apiOrigin(req: Request): string | null {
  const raw = process.env.API_PROXY_TARGET || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!raw) return null;
  try {
    const o = new URL(raw).origin;
    return o === new URL(req.url).origin ? null : o; // never call ourselves
  } catch {
    return null;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function page(l: Lang, status: number, body: string): Response {
  const html =
    `<!doctype html><html lang="${l}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<meta name="robots" content="noindex"><title>Sana</title><style>` +
    `body{font-family:-apple-system,"Segoe UI",Roboto,sans-serif;background:#f7f6fb;color:#1a1a1f;margin:0;padding:48px 16px}` +
    `main{max-width:420px;margin:0 auto;background:#fff;border-radius:24px;padding:28px}` +
    `.logo{width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,#8B7FD6,#6B5FB8);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;font-size:24px;margin-bottom:16px}` +
    `p{font-size:17px;line-height:1.5;margin:0 0 20px}button{min-height:48px;padding:0 22px;border:0;border-radius:16px;background:#6457b3;color:#fff;font-size:16px;font-weight:500;cursor:pointer}` +
    `button:focus-visible{outline:3px solid #1a1a1f;outline-offset:2px}` +
    `@media (prefers-color-scheme:dark){body{background:#111015;color:#f2f1f7}main{background:#1b1a21}button{background:#a99ef2;color:#15131c}}` +
    `</style></head><body><main><div class="logo" aria-hidden="true">S</div>${body}</main></body></html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
    },
  });
}

export function GET(req: Request) {
  const l = lang(req);
  const p = params(req);
  if (!p) return page(l, 400, `<p>${TEXT[l].invalid}</p>`);
  const action = `?u=${encodeURIComponent(p.u)}&t=${encodeURIComponent(p.t)}`;
  return page(l, 200, `<p>${TEXT[l].ask}</p><form method="post" action="${esc(action)}"><button type="submit">${TEXT[l].button}</button></form>`);
}

export async function POST(req: Request) {
  const l = lang(req);
  const p = params(req);
  if (!p) return page(l, 400, `<p>${TEXT[l].invalid}</p>`);
  const origin = apiOrigin(req);
  if (!origin) return page(l, 200, `<p>${TEXT[l].demo}</p>`);
  try {
    const r = await fetch(`${origin}/api/email/unsubscribe?u=${encodeURIComponent(p.u)}&t=${encodeURIComponent(p.t)}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "List-Unsubscribe=One-Click",
      cache: "no-store",
      redirect: "error",
    });
    if (r.ok) return page(l, 200, `<p>${TEXT[l].done}</p>`);
    return page(l, r.status === 400 ? 400 : 502, `<p>${r.status === 400 ? TEXT[l].invalid : TEXT[l].error}</p>`);
  } catch {
    return page(l, 502, `<p>${TEXT[l].error}</p>`);
  }
}
