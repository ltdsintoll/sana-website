import type { Metadata } from "next";
import LegalLayout from "@/components/LegalLayout";
import { pageMetadata, toLocale } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = toLocale((await params).locale);
  return pageMetadata({
    locale,
    path: "/privacy",
    title: "Privacy Policy — Sana",
    description:
      "How Sana handles your data. Short version: we don't sell it, we don't track you, and you can delete everything anytime.",
  });
}

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="Last updated: April 22, 2026">
      <p>
        This Privacy Policy explains how Sana (&quot;we&quot;, &quot;us&quot;)
        collects, uses, and protects information when you use our cycle-tracking
        service via Telegram and the website{" "}
        <strong>sanacycle.com</strong> (the &quot;Service&quot;).
      </p>
      <p>
        <strong>Short version:</strong> we do not sell your data, we do not run
        ads, and we use the minimum data needed to run the Service. You can
        export or delete everything at any time.
      </p>

      <h2>1. Who we are</h2>
      <p>
        Sana is operated as a personal project. For any privacy-related
        questions, contact us at{" "}
        <a href="mailto:privacy@sanacycle.com">privacy@sanacycle.com</a>.
      </p>

      <h2>2. Data we collect</h2>
      <h3>Data you provide directly</h3>
      <ul>
        <li>
          Cycle data (period dates, symptoms, moods, notes) you enter in the
          app.
        </li>
        <li>
          Telegram user ID and first name (provided by Telegram when you open
          the Mini App).
        </li>
        <li>
          Email address, if you subscribe to launch updates on our website.
        </li>
        <li>Partner-mode connections you explicitly create.</li>
      </ul>

      <h3>Data collected automatically</h3>
      <ul>
        <li>
          Basic analytics (page views, approximate country) via Google
          Analytics 4 with IP anonymization.
        </li>
        <li>
          Server logs (request time, status, user agent) retained up to 30
          days for security and debugging.
        </li>
      </ul>

      <h2>3. How we use your data</h2>
      <ul>
        <li>
          To provide the Service: predictions, reminders, partner sharing.
        </li>
        <li>
          To improve the Service (aggregated, non-identifying metrics only).
        </li>
        <li>
          To send launch updates, if you subscribed (double opt-in, unsubscribe
          anytime).
        </li>
        <li>To comply with legal obligations where required.</li>
      </ul>
      <p>
        We do <strong>not</strong> sell, rent, or trade your personal data. We
        do <strong>not</strong> use your cycle data for advertising. We do{" "}
        <strong>not</strong> share data with data brokers or &quot;research
        partners&quot;.
      </p>

      <h2>4. Legal basis (GDPR)</h2>
      <p>
        If you are in the European Economic Area, UK, or Switzerland, we
        process your data on these bases:
      </p>
      <ul>
        <li>
          <strong>Consent</strong> — for email marketing and optional analytics.
        </li>
        <li>
          <strong>Contract</strong> — to provide the Service you signed up for.
        </li>
        <li>
          <strong>Legitimate interest</strong> — for security, fraud prevention,
          and basic service analytics.
        </li>
      </ul>

      <h2>5. Data storage and security</h2>
      <p>
        Your data is stored on servers located in the European Union. Data in
        transit is encrypted via HTTPS. Sensitive fields are encrypted at rest.
        Access to production systems is limited and logged.
      </p>

      <h2>6. Third parties</h2>
      <ul>
        <li>
          <strong>Telegram</strong> — the platform Sana runs on. Governed by
          Telegram&apos;s own privacy policy.
        </li>
        <li>
          <strong>Brevo</strong> — email service provider (for launch-updates
          list, EU-based, GDPR-compliant).
        </li>
        <li>
          <strong>Google Analytics 4</strong> — website analytics with IP
          anonymization enabled.
        </li>
        <li>
          <strong>Vercel</strong> — hosting provider for the website.
        </li>
      </ul>

      <h2>7. Your rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>
          <strong>Access</strong> your data (one-tap export in the app).
        </li>
        <li>
          <strong>Rectify</strong> any inaccurate data.
        </li>
        <li>
          <strong>Erase</strong> your data (one-tap delete in the app).
        </li>
        <li>
          <strong>Object to</strong> or <strong>restrict</strong> processing.
        </li>
        <li>
          <strong>Withdraw consent</strong> for emails via the unsubscribe link
          in every email.
        </li>
        <li>
          <strong>Lodge a complaint</strong> with your local data protection
          authority.
        </li>
      </ul>
      <p>
        To exercise any of these rights, email{" "}
        <a href="mailto:privacy@sanacycle.com">privacy@sanacycle.com</a>. We
        respond within 30 days.
      </p>

      <h2>8. Data retention</h2>
      <p>
        We keep your data as long as your account is active. If you delete your
        account, all personal data is removed within 30 days, except where law
        requires longer retention.
      </p>

      <h2>9. Children</h2>
      <p>
        Sana is intended for users aged 13 and older. If you believe a child
        under 13 has provided us with data, please contact us and we will delete
        it.
      </p>

      <h2>10. Changes to this policy</h2>
      <p>
        We&apos;ll post changes on this page and update the &quot;Last
        updated&quot; date above. Material changes will also be announced in
        the app or via email if you&apos;ve subscribed.
      </p>

      <h2>11. Contact</h2>
      <p>
        Email:{" "}
        <a href="mailto:privacy@sanacycle.com">privacy@sanacycle.com</a>
      </p>
    </LegalLayout>
  );
}
