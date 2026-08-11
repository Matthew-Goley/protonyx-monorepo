// The deployed Lens Arc web app. External to this site; the nav's primary
// button and every "open the app" link point here.
export const APP_URL = "https://app.lens-arc.com";

// Any query-carrying app link MUST target /login directly, never bare APP_URL.
// lens-app's router ends in <Route path="*" element={<Navigate to="/login" />} />,
// and that redirect does NOT preserve search params, so `${APP_URL}?email=...`
// would arrive stripped. (It is also why every plain APP_URL button below lands
// on a bare /login with no query string: correct, they never carried one.)
const APP_LOGIN_URL = `${APP_URL}/login`;

// Deep link into the app's SIGN-UP tab with the email prefilled, for CTAs that
// explicitly mean "create your account". Earned Pro time is keyed to the email
// address, so the claim CTA has to carry it across; the app's Login page reads
// ?mode=signup and ?email= independently on mount. Falls back to a bare
// ?mode=signup when the address is unknown rather than emitting a dangling
// `email=`, which would prefill the form with an empty string.
export const appSignupUrl = (email?: string | null) => {
  const clean = email?.trim() ?? "";
  return clean
    ? `${APP_LOGIN_URL}?mode=signup&email=${encodeURIComponent(clean)}`
    : `${APP_LOGIN_URL}?mode=signup`;
};

// Generic "open the app" href, for the Enter/Open Lens Arc buttons. Deliberately
// does NOT force the sign-up tab: a member who already has an app account wants
// to sign in. It still carries the verified email so the sign-up form is
// prefilled if they do switch tabs, which is what keeps earned Pro time attached
// to the right address instead of being silently lost to a typo'd second email.
export const appOpenUrl = (email?: string | null) => {
  const clean = email?.trim() ?? "";
  return clean ? `${APP_LOGIN_URL}?email=${encodeURIComponent(clean)}` : APP_URL;
};

// Route paths, single source of truth for App.tsx's matcher and every internal
// link. The referral signup flow lives under /referral; the legacy /ref/<code>
// and /r/<code> share paths (already distributed publicly) are redirected to
// REFERRAL_REF_BASE + code by App.tsx, never removed.
export const ROUTES = {
  home: "/",
  engine: "/lens-arc",
  referral: "/referral",
  verify: "/verify",
} as const;

// Base path for the canonical referral share route: /referral/ref/<code>.
export const REFERRAL_REF_BASE = "/referral/ref/";

// Persistent nav content. Every nav variant renders these same items; only
// the styling differs between variants. The app CTA deliberately says
// "Enter", not "Get started free": the product is paid now.
export const NAV = {
  engine: { label: "Engine", href: ROUTES.engine },
  referral: { label: "Referral program", href: ROUTES.referral },
  app: { label: "Enter Lens Arc", href: APP_URL },
} as const;

export const HERO = {
  headline: "Actionable Insight for Everyone.",
  subhead:
    "Lens Arc is live. If you joined the referral program, verify your email to see the free Pro time you earned and how it redeems.",
};

// Headline words that get the brand gradient, mirroring the frontend/ hero.
export const HERO_ACCENTS = ["Actionable", "Insight", "Everyone."];

// Earned Pro time. This mirrors the ONE formula that actually grants anything:
// backend/src/waitlist.ts (BASE_MONTHS + one month per verified referral, capped
// at MAX_MONTHS). It is LINEAR.
//
// It used to be a step function (0/1/3/5/10 thresholds, topping out at
// "Lifetime free"), which rounded an in-between count DOWN to the nearest tier:
// an account with 2 verified referrals was shown "2 months" while the backend
// granted 3, and the 10-referral lifetime tier was a promise the backend could
// never honour (it caps at 12 months). Do not reintroduce thresholds here.
// Change these only in lockstep with backend/src/waitlist.ts and
// referral-service/entitlement.py.
export const REFERRAL_BASE_MONTHS = 1;
export const REFERRAL_MAX_MONTHS = 12;

/** Months of Pro a verified member with this many verified referrals will be granted. */
export const earnedMonths = (referralCount: number): number =>
  Math.min(REFERRAL_BASE_MONTHS + Math.max(0, referralCount), REFERRAL_MAX_MONTHS);

export const monthsLabel = (months: number): string =>
  `${months} ${months === 1 ? "month" : "months"} free`;

// Display points along that line for the /referral stepper. Every reward label is
// derived from earnedMonths(), so the stepper cannot drift from the real formula.
// The top node is the cap: 11 referrals is the first count that reaches 12 months.
export const REFERRAL_MILESTONES = [0, 1, 3, 5, 11].map((referrals) => ({
  referrals,
  reward: monthsLabel(earnedMonths(referrals)),
}));

export const BRAND = {
  gradientFrom: "#14b8a6",
  gradientTo: "#38bdf8",
  wordmark: "lens arc",
};

// Simple standalone pages (not part of the marketing layout), linked from the
// footer and the shared SimplePage nav. path + title live together here so the
// link href, the route match in App.tsx, and the page's own heading can never
// drift apart.
export const LEGAL_PAGES = {
  terms: { path: "/legal/terms", title: "Terms of Service" },
  privacy: { path: "/legal/privacy", title: "Privacy Policy" },
} as const;

// Legacy legal paths (pre-restructure), redirected by App.tsx.
export const LEGACY_LEGAL_PATHS = {
  "/terms": LEGAL_PAGES.terms.path,
  "/privacy": LEGAL_PAGES.privacy.path,
} as const;

// Shared microcopy. Every page pulls strings from here, never inline.
export const COPY = {
  emailPlaceholder: "you@example.com",
  emailCta: "Continue with email",
  emailInvalid: "Enter a valid email address",
  changeEmail: "Use a different email",
  magicHeading: "Check your email",
  magicInstruction: (email: string) =>
    `We sent a link to ${email}. Click it to verify your email and see your Pro time.`,
  magicSimulate: "I clicked the link",
  magicNote:
    "In production this happens automatically once you click the emailed link.",
  magicResend: "Resend link",
  magicResent: "Link sent",
  verifiedAs: (email: string) => `Verified as ${email}`,
  logout: "Log out",
  unlockedWord: "unlocked",
  rewardShort: (reward: string) => reward.replace(/ free$/i, ""),
  dialCaption: (n: number) => `${n} ${n === 1 ? "referral" : "referrals"} so far`,
  nextStep: (remaining: number, reward: string, alreadyReferred: boolean) => {
    const prize = reward.replace(/ free$/i, "").toLowerCase();
    const friends = remaining === 1 ? "friend" : "friends";
    return `Refer ${remaining}${alreadyReferred ? " more" : ""} ${friends}, unlock ${prize}`;
  },
  maxedLine: "Maximum reached. 12 months of Pro is yours.",
  referralRowLabel: "Your referral link",
  copyLabel: "Copy",
  copiedLabel: "Copied",
  shareLabel: "Share",
  referralLinkBase: "lens-arc.com" + REFERRAL_REF_BASE,
  referralHeading: "The referral program",
  referralSub:
    "Pro time earned through referrals, by verified referral count. Verify your email to see where you landed and how your time redeems.",
  referralUnit: (n: number) => (n === 1 ? "referral" : "referrals"),
  openApp: "Open Lens Arc",
  alreadyHaveAccount: "Already verified?",
  // Takes the month count itself, not a pre-formatted reward string. The old
  // string form forced every caller to strip " free" and special-case a
  // "Lifetime free" tier, which is how the displayed number drifted from the
  // granted one in the first place.
  rewardSummary: (months: number) =>
    `You earned ${months} ${months === 1 ? "month" : "months"} of Pro`,
  redeemNote:
    "Being redeemed now: your Pro time applies automatically when you sign in to app.lens-arc.com with this same email.",
  claimNote:
    "No app account yet? Your Pro time is claimed by creating one with this same email address. Sign up with a different address and the time will not follow.",
  claimCta: "Create your account",
  // Shown in place of the email capture now that the program has ended. It must
  // still tell an existing member how to get back in, because clearing browser
  // storage is the normal way someone lands here with no restore state.
  programClosedHeading: "The referral program has closed",
  programClosedBody:
    "Lens Arc is live, and the referral program is no longer accepting new participants.",
  programClosedMember:
    "Already joined and verified your email? Your earned Pro time is safe. Use Sign in above to get a link and claim it.",
  accountSignIn: "Sign in",
  accountTitle: "Your account",
  accountSignInHint:
    "Enter the email you used for the referral program and we'll send you a sign-in link.",
  accountSendLink: "Send link",
  accountReferralsLine: (n: number) =>
    `${n} verified ${n === 1 ? "referral" : "referrals"}`,
  accountViewStatus: "View referral status",
  accountLoggedOut: "Not signed in",
  disclaimer:
    "Educational tool only. Not investment advice. See full disclaimer in our Terms of Service.",
  legal: "© 2026 Protonyx LLC",
};
