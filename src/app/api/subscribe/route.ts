import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  email?: string;
  locale?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  const locale = (body.locale ?? "en").slice(0, 5);

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const apiKey = process.env.BREVO_API_KEY;
  const listId = Number(process.env.BREVO_LIST_ID);
  const templateId = Number(process.env.BREVO_TEMPLATE_ID);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sanacycle.com";

  if (!apiKey || !listId || !templateId) {
    console.error("[subscribe] Missing Brevo env vars");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      "https://api.brevo.com/v3/contacts/doubleOptinConfirmation",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify({
          email,
          includeListIds: [listId],
          templateId,
          redirectionUrl: `${siteUrl}/${locale === "en" ? "" : locale}?subscribed=1`,
          attributes: { LOCALE: locale, SOURCE: "landing" },
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error("[subscribe] Brevo error", res.status, text);
      if (res.status === 400 && text.includes("already")) {
        return NextResponse.json({ ok: true, already: true });
      }
      return NextResponse.json({ error: "Subscription failed" }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[subscribe] Unexpected error", err);
    return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
  }
}
