// The deployed Lens Arc web app. External to this site; the nav's primary
// button and every "open the app" link point here.
export const APP_URL = "https://app.lens-arc.com";

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

export const REFERRAL_MILESTONES = [
  { referrals: 0, reward: "1 month free" },
  { referrals: 1, reward: "2 months free" },
  { referrals: 3, reward: "4 months free" },
  { referrals: 5, reward: "6 months free" },
  { referrals: 10, reward: "Lifetime free" },
];

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
    const prize =
      reward === "Lifetime free"
        ? "lifetime access"
        : reward.replace(/ free$/i, "").toLowerCase();
    const friends = remaining === 1 ? "friend" : "friends";
    return `Refer ${remaining}${alreadyReferred ? " more" : ""} ${friends}, unlock ${prize}`;
  },
  maxedLine: "Every tier unlocked. Lifetime Pro is yours.",
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
  rewardSummary: (reward: string) => `You earned ${reward} of Pro`,
  rewardSummaryLifetime: "You earned lifetime free Pro",
  redeemNote:
    "Being redeemed now: your Pro time applies automatically when you sign in to app.lens-arc.com with this same email.",
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
