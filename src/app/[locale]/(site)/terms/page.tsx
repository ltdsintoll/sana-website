import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import LegalLayout from "@/components/LegalLayout";

export const metadata: Metadata = {
  title: "Terms of Service — Sana",
  description:
    "The ground rules for using Sana. Be decent, don't abuse the service, and you're good.",
};

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="Last updated: April 22, 2026">
      <p>
        These Terms of Service (&quot;Terms&quot;) govern your use of Sana
        (&quot;Service&quot;), provided via Telegram and the website{" "}
        <strong>sanacycle.com</strong>. By using the Service, you agree to
        these Terms.
      </p>

      <h2>1. What Sana is</h2>
      <p>
        Sana is a cycle-tracking service designed as a Telegram Mini App. It
        helps you log and understand your menstrual cycle, share selected info
        with a partner you trust, and receive gentle reminders and predictions.
      </p>
      <p>
        <strong>Sana is not a medical device.</strong> Predictions are based on
        statistical patterns, not medical diagnoses. Do not rely on Sana for
        contraception, fertility treatment, or medical decisions. Always consult
        a qualified healthcare professional.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 13 years old to use Sana. If you are under 18, you
        should have your parent or guardian&apos;s permission to use the
        Service.
      </p>

      <h2>3. Your account</h2>
      <p>
        Sana uses your Telegram account for authentication. You are responsible
        for keeping your Telegram account secure. We are not responsible for
        unauthorized access resulting from compromised Telegram accounts.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any illegal purpose.</li>
        <li>Attempt to access accounts or data belonging to others.</li>
        <li>Interfere with, disrupt, or reverse-engineer the Service.</li>
        <li>
          Use automated means to access the Service without permission.
        </li>
        <li>Impersonate others or misrepresent your identity.</li>
        <li>
          Abuse the partner-mode feature to monitor someone without consent.
        </li>
      </ul>

      <h2>5. Partner mode</h2>
      <p>
        Partner mode is an opt-in feature. You choose what to share and can
        revoke access at any time. Using partner mode to surveil or control
        another person is a violation of these Terms and may violate local laws.
      </p>

      <h2>6. Fees</h2>
      <p>
        Sana&apos;s core features are free. Optional premium features may be
        introduced in the future with separate terms and transparent pricing.
        You will always be able to use the core Service for free.
      </p>

      <h2>7. Intellectual property</h2>
      <p>
        The Service, including its design, code, and content, is owned by us
        and protected by copyright and trademark law. You retain full ownership
        of the data you enter.
      </p>

      <h2>8. Your data</h2>
      <p>
        How we handle your data is described in our{" "}
        <Link href="/privacy">Privacy Policy</Link>
        . You can export or delete your data at any time.
      </p>

      <h2>9. Service availability</h2>
      <p>
        We aim for high availability but do not guarantee uninterrupted
        service. We may update, modify, or discontinue features with reasonable
        notice.
      </p>

      <h2>10. Disclaimers</h2>
      <p>
        The Service is provided &quot;as is&quot;, without warranties of any
        kind, express or implied. To the maximum extent permitted by law, we
        disclaim all warranties including fitness for a particular purpose and
        non-infringement.
      </p>

      <h2>11. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Sana and its operators are not
        liable for indirect, incidental, special, or consequential damages
        arising from your use of the Service.
      </p>

      <h2>12. Termination</h2>
      <p>
        You can stop using Sana at any time by deleting your data in the app.
        We may suspend or terminate accounts that violate these Terms.
      </p>

      <h2>13. Changes to these Terms</h2>
      <p>
        We may update these Terms occasionally. Material changes will be
        announced in the app or via email if you&apos;ve subscribed. Continued
        use after changes means you accept the updated Terms.
      </p>

      <h2>14. Governing law</h2>
      <p>
        These Terms are governed by the laws of the European Union and the
        applicable member state where the operator resides, without regard to
        conflict-of-law rules.
      </p>

      <h2>15. Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href="mailto:hello@sanacycle.com">hello@sanacycle.com</a>
      </p>
    </LegalLayout>
  );
}
