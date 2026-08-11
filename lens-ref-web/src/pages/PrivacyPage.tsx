import SimplePage from "../components/SimplePage";
import { LegalContact, LegalList, LegalSection } from "./legalContent";
import { LEGAL_PAGES } from "../content";

// Text sourced verbatim from legal-raw/lens-arc-referral-privacy-policy.md.
// Do not edit the wording here without updating that source doc first, they
// must stay in sync.
export default function PrivacyPage() {
  return (
    <SimplePage title={LEGAL_PAGES.privacy.title} effectiveDate="4 August 2026" serif>
      <p>
        This Privacy Policy explains how Protonyx LLC ("Protonyx," "we," "us," or "our")
        collects, uses, and protects information on the Lens Arc referral and waitlist site
        located at lens-arc.com (the "Site"). This policy covers only the Site described here.
        Once the Lens Arc application itself is available, use of the app will be governed by
        its own separate Privacy Policy.
      </p>

      <LegalSection number={1} title="Information We Collect">
        <p>When you use the Site, we collect:</p>
        <LegalList
          items={[
            <>
              <strong>Email address</strong> — the email you provide to join the waitlist.
            </>,
            <>
              <strong>Referral information</strong> — if you arrive via a referral link, we
              record which referral code brought you here, and once you're verified, we
              generate a unique referral code for you to share.
            </>,
            <>
              <strong>Verification status and timestamps</strong> — whether your email has been
              verified, when you signed up, and when (if ever) your earned Pro time is redeemed.
            </>,
          ]}
        />
        <p>
          We do <strong>not</strong> collect your name, phone number, mailing address, or any
          payment information through this Site.
        </p>
        <p>
          We do <strong>not</strong> collect or store your IP address or browser/device
          information. The only place your IP address is briefly touched is a rate-limiting
          safeguard that keeps signups from being spammed; it's used momentarily to enforce that
          limit and is never written to a database or log.
        </p>
      </LegalSection>

      <LegalSection number={2} title="Cookies and Local Storage">
        <p>
          This Site does not use cookies. After you verify your email, your referral code and
          email are saved in your browser's local storage so the Site can show you your referral
          status without asking you to re-verify every visit. This stays on your device and
          isn't something we access directly, it's just how your browser remembers your status.
          It's cleared automatically if you log out or clear your browser data.
        </p>
      </LegalSection>

      <LegalSection number={3} title="How We Use Your Information">
        <p>We use the information above to:</p>
        <LegalList
          items={[
            'Send you a one-time verification link ("magic link") to confirm your email.',
            "Track referrals so we can calculate the free Pro time you've earned.",
            "Apply that earned Pro time to your account once the full Lens Arc application launches.",
          ]}
        />
        <p>
          We do not sell your information, and we do not use it for advertising or marketing
          beyond the referral program itself.
        </p>
      </LegalSection>

      <LegalSection number={4} title="Third-Party Services">
        <LegalList
          items={[
            <>
              <strong>Resend</strong> — we use Resend to deliver verification and referral
              emails. Resend processes your email address on our behalf to send these messages.
            </>,
            <>
              <strong>Google Fonts</strong> — this Site loads fonts directly from Google's
              servers, which means Google may see your IP address when the page loads. This is a
              standard part of how web fonts are delivered and isn't something we control
              directly.
            </>,
          ]}
        />
        <p>We do not use any analytics, advertising, or tracking tools on this Site.</p>
      </LegalSection>

      <LegalSection number={5} title="How Your Information Is Stored">
        <p>
          Your information is stored in a PostgreSQL database that is shared with other parts of
          our infrastructure. Verification links are never stored as plain text: only a hashed
          version is kept, each link expires after 30 minutes, and each link can only be used
          once.
        </p>
      </LegalSection>

      <LegalSection number={6} title="Data Retention">
        <p>
          We currently retain waitlist records, including signups that are never verified, for
          as long as the referral program is active. When the referral program formally closes,
          we plan to delete this data. Until then, records are not automatically purged.
        </p>
      </LegalSection>

      <LegalSection number={7} title="Your Rights">
        <p>
          You can request that we delete your data at any time by emailing us at{" "}
          <a
            href="mailto:legal@protonyxdata.com"
            className="text-teal-600 transition hover:underline"
          >
            legal@protonyxdata.com
          </a>
          . We process deletion requests manually and aim to complete them within 30 days.
        </p>
      </LegalSection>

      <LegalSection number={8} title="Children's Privacy">
        <p>
          This Site is not directed at children under 13, and we do not knowingly collect
          information from children under 13. If you believe a child has provided us
          information, contact us at{" "}
          <a
            href="mailto:legal@protonyxdata.com"
            className="text-teal-600 transition hover:underline"
          >
            legal@protonyxdata.com
          </a>{" "}
          and we will delete it.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Changes to This Policy">
        <p>
          We may update this Privacy Policy from time to time. The "Effective Date" above
          reflects the most recent version. Material changes will be reflected here.
        </p>
      </LegalSection>

      <LegalSection number={10} title="Contact Us">
        <p>Questions about this policy or your data can be sent to:</p>
        <LegalContact name="Protonyx LLC" email="legal@protonyxdata.com" />
      </LegalSection>
    </SimplePage>
  );
}
