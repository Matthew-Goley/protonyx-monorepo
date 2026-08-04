import LegalPage from "./LegalPage";
import { LegalContact, LegalList, LegalSection, LegalTable } from "./legalContent";
import { LEGAL_PAGES } from "../content";

// Text sourced verbatim from legal-raw/lens-arc-referral-terms.md. Do not
// edit the wording here without updating that source doc first, they must
// stay in sync.
export default function TermsPage() {
  return (
    <LegalPage title={LEGAL_PAGES.terms.title} effectiveDate="4 August 2026">
      <p>
        These Referral Program Terms ("Terms") govern participation in the Lens Arc referral
        and waitlist program operated by Protonyx LLC ("Protonyx," "we," "us," or "our") at
        lens-arc.com (the "Program"). By joining the waitlist or using a referral link, you
        agree to these Terms.
      </p>
      <p>
        These Terms cover only the referral program described here. Your use of the Lens Arc
        application itself, once available, will be governed by a separate Terms of Service.
      </p>

      <LegalSection number={1} title="How the Program Works">
        <p>
          You may join the Program by submitting your email address and verifying it through a
          one-time link sent to your inbox. Once verified, you'll receive a unique referral code
          and link. When someone signs up using your link and verifies their own email, that
          counts as a successful referral.
        </p>
      </LegalSection>

      <LegalSection number={2} title="Rewards">
        <p>
          Verified participants earn free access to Lens Arc's paid ("Pro") tier based on their
          total number of successful referrals:
        </p>
        <LegalTable
          headers={["Verified Referrals", "Free Pro Access"]}
          rows={[
            ["0", "1 month"],
            ["1–2", "2 months"],
            ["3–4", "4 months"],
            ["5–9", "6 months"],
            ["10+", "Lifetime"],
          ]}
        />
        <p>
          A referral only counts once the referred person verifies their email. Ten verified
          referrals grants lifetime free access and is the maximum reward available under the
          Program.
        </p>
        <p>
          We reserve the right to change this reward schedule, including for participants who
          joined before a change, if we determine it's necessary to keep the Program sustainable
          or to prevent abuse.
        </p>
      </LegalSection>

      <LegalSection number={3} title="Redemption">
        <p>
          Earned Pro time will be applied to your account when Lens Arc's paid application
          launches, using the same email address you used to join the Program. Use an email
          address you'll continue to have access to. We are not responsible for rewards that go
          unclaimed because a different or inaccessible email address was used.
        </p>
      </LegalSection>

      <LegalSection number={4} title="Fair Use">
        <p>
          The Program is intended for genuine referrals of real, individual users. The following
          are not permitted:
        </p>
        <LegalList
          items={[
            "Referring yourself using your own referral code, or using an account you control to inflate your referral count.",
            "Creating multiple email addresses or accounts to generate referral credit for yourself.",
            "Any other automated, fraudulent, or bad-faith attempt to generate referral credit that isn't a genuine referral of another person.",
          ]}
        />
        <p>
          We may, at our sole discretion, deny, reduce, or revoke rewards obtained through
          activity that violates this section, and may suspend or terminate access to the
          Program for any account involved.
        </p>
      </LegalSection>

      <LegalSection number={5} title="No Cash Value">
        <p>
          Pro time earned through this Program has no cash value and cannot be sold, exchanged,
          transferred to another person or account, or redeemed for anything other than access
          to Lens Arc's Pro tier.
        </p>
      </LegalSection>

      <LegalSection number={6} title="Program Changes and Termination">
        <p>
          We may modify, suspend, or discontinue the Program, including the reward structure
          described above, at any time and without prior notice. If we discontinue the Program,
          we will make reasonable efforts to honor Pro time already earned by verified
          participants as of the discontinuation date.
        </p>
      </LegalSection>

      <LegalSection number={7} title="About Lens Arc">
        <p>
          Lens Arc, once available, is an educational and diagnostic tool. It does not provide
          investment, financial, tax, or legal advice, and nothing on this Site or in the Lens
          Arc application constitutes a recommendation to buy, sell, or hold any security.
        </p>
      </LegalSection>

      <LegalSection number={8} title="Limitation of Liability">
        <p>
          To the fullest extent permitted by law, Protonyx LLC is not liable for any indirect,
          incidental, or consequential damages arising from your participation in the Program.
          Our total liability arising from the Program is limited to the value of any Pro time
          you've earned but not yet redeemed.
        </p>
      </LegalSection>

      <LegalSection number={9} title="Governing Law">
        <p>
          These Terms are governed by the laws of the State of Missouri, without regard to
          conflict-of-law principles.
        </p>
      </LegalSection>

      <LegalSection number={10} title="Changes to These Terms">
        <p>
          We may update these Terms from time to time. Continued participation in the Program
          after changes take effect constitutes acceptance of the updated Terms.
        </p>
      </LegalSection>

      <LegalSection number={11} title="Contact Us">
        <p>Questions about the Program or these Terms can be sent to:</p>
        <LegalContact name="Protonyx LLC" email="legal@protonyxdata.com" />
      </LegalSection>
    </LegalPage>
  );
}
