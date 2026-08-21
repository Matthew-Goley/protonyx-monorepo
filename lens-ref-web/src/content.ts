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
// REFERRAL_REF_BASE + code by App.tsx, never removed. /login and /signup are
// the same page (LoginPage), differing only in which tab opens first.
export const ROUTES = {
  home: "/",
  engine: "/lens-arc",
  referral: "/referral",
  verify: "/verify",
  login: "/login",
  signup: "/signup",
  account: "/account",
  // Landing path for the emailed verification link. The email is sent by the
  // Fastify backend and its URL is built there (backend/src/email.ts), so this
  // string and that one are a contract: change one and the link 404s into the
  // SPA catch-all, which renders the landing page and silently drops the token.
  verifyEmail: "/verify-email",
} as const;

// Href for the site's own account page. `next` is the path to come back to
// after a successful sign in; only same-origin paths are carried (the page
// re-checks this before redirecting, so a crafted ?next= cannot bounce a user
// off-site). Callers usually pass window.location.pathname.
export const authUrl = (
  mode: "signin" | "signup" = "signin",
  next?: string | null
) => {
  const path = mode === "signup" ? ROUTES.signup : ROUTES.login;
  const clean = next?.trim() ?? "";
  const safe = clean.startsWith("/") && !clean.startsWith("//") && clean !== path;
  return safe ? `${path}?next=${encodeURIComponent(clean)}` : path;
};

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
  headline: "Investing Answers You Can Trust.",
  subhead:
    "Lens Arc is live. If you joined the referral program, verify your email to see the free Pro time you earned and how it redeems.",
};

// Headline words that get the brand gradient, mirroring the frontend/ hero.
export const HERO_ACCENTS = ["Trust."];

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

// The hamburger menu (components/MenuOverlay.tsx). The nav bar itself carries
// only two controls (account slot, menu button) and no links at all, so this is
// the ONE place every page on lens-arc.com is linked from: add a route here in
// the same change that adds it to App.tsx, or it becomes unreachable from the
// nav.
//
// /login and /signup are deliberately absent from the columns: the account slot
// and the menu's own auth action already lead there, and listing them as
// destinations alongside content pages reads oddly.
export const MENU = {
  openLabel: "Open menu",
  closeLabel: "Close menu",
  columns: [
    {
      label: "Navigation",
      links: [
        { label: "Home", href: ROUTES.home },
        { label: NAV.engine.label, href: NAV.engine.href },
        { label: NAV.referral.label, href: NAV.referral.href },
        { label: "Account", href: ROUTES.account },
      ],
    },
    {
      label: "Legal",
      links: [
        { label: LEGAL_PAGES.terms.title, href: LEGAL_PAGES.terms.path },
        { label: LEGAL_PAGES.privacy.title, href: LEGAL_PAGES.privacy.path },
      ],
    },
  ],
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
  // The magic-link sign-in that used to recover this state was removed with the
  // waitlist login, so this no longer points at a popover. It points at the real
  // redemption path instead, which never depended on this site: the backend
  // grants the earned time at signup by matching the email against the waitlist
  // row (backend/src/waitlist.ts).
  programClosedMember:
    "Already joined and verified your email? Your earned Pro time is safe. Create your Lens Arc account with that same email address and it applies automatically.",
  accountSignIn: "Sign in",
  accountTitle: "Your account",
  accountViewStatus: "View referral status",
  disclaimer:
    "Educational tool only. Not investment advice. See full disclaimer in our Terms of Service.",
  legal: "© 2026 Protonyx LLC",
};

// Copy for the account page (src/pages/LoginPage.tsx) and the nav's account
// slot. This is the REAL account system (Fastify `users`), so the wording is
// about a Lens Arc account, never about the referral waitlist.
export const AUTH = {
  signInTab: "Sign in",
  signUpTab: "Create account",
  signInTitle: "Sign in to Lens Arc",
  signUpTitle: "Create your Lens Arc account",
  signInSub: "Use the same account you sign in to the app with.",
  signUpSub: "One account for the app and this site.",
  identifierLabel: "Username or email",
  identifierPlaceholder: "you@example.com",
  usernameLabel: "Username",
  usernamePlaceholder: "yourname",
  emailLabel: "Email",
  passwordLabel: "Password",
  passwordPlaceholder: "••••••••",
  signInCta: "Sign in",
  signUpCta: "Create account",
  working: "One moment...",
  // Signup records acceptance of the current Terms server-side (the /signup
  // route stamps tos_version_accepted), so the form has to say so. There is no
  // checkbox, same as the rest of the platform.
  termsNote: "By creating an account, you agree to our",
  termsLink: "Terms of Service",
  missingFields: "Fill in every field to continue.",
  passwordTooShort: "Use at least 8 characters.",
  switchToSignUp: "No account yet?",
  switchToSignUpCta: "Create one",
  switchToSignIn: "Already have an account?",
  switchToSignInCta: "Sign in",
  signedInAs: (name: string) => `Signed in as ${name}`,
  planLine: (plan: string) => `${plan.charAt(0).toUpperCase()}${plan.slice(1)} plan`,
  backHome: "Back to lens-arc.com",
};

// The account page (src/pages/AccountPage.tsx) and the verification landing.
// Everything a signed-in user can do to their own account lives behind these
// strings; the page itself hardcodes none of them.
export const ACCOUNT = {
  title: "Your account",
  subtitle:
    "Your Lens Arc account details, and everything you can change about them. This is the same account you sign in to the app with.",

  // Profile table
  usernameLabel: "Username",
  emailLabel: "Email",
  planLabel: "Plan",
  memberSinceLabel: "Member since",
  verifiedBadge: "Verified",
  unverifiedBadge: "Not verified",
  planFree: "Free",
  planPro: "Pro",
  proUntil: (date: string) => `Pro until ${date}`,

  // Email verification
  verifyHeading: "Email verification",
  verifyBody:
    "Verifying your email lets us reach you about your account and your earned Pro time.",
  verifyDone: "Your email address is verified. Nothing to do here.",
  verifyCta: "Send verification email",
  verifySending: "Sending...",
  verifySent: "Verification email sent. Check your inbox for the link.",

  // Change password
  passwordHeading: "Change password",
  passwordBody:
    "You will need your current password. Changing it does not sign you out of other devices.",
  currentPasswordLabel: "Current password",
  newPasswordLabel: "New password",
  confirmPasswordLabel: "Confirm new password",
  passwordCta: "Change password",
  passwordSaving: "Saving...",
  passwordChanged: "Password changed.",
  passwordMismatch: "The new passwords do not match.",
  passwordTooShort: "Use at least 8 characters.",
  passwordMissing: "Fill in every field to continue.",

  // Danger zone
  dangerHeading: "Delete account",
  dangerBody:
    "This permanently deletes your account and everything attached to it, including your portfolio and any earned Pro time. It cannot be undone.",
  deleteCta: "Delete account",
  deleteConfirmCta: "Click again to permanently delete",
  deleteDeleting: "Deleting...",

  signOut: "Sign out",
  signedOutRedirect: "You need to sign in to view this page.",

  // Verification landing (src/pages/VerifyEmailPage.tsx)
  verifyPageTitle: "Email verification",
  verifyPageChecking: "Verifying your email...",
  verifyPageSuccess: "Your email address is verified.",
  verifyPageSuccessBody: "You can close this page, or head back to your account.",
  verifyPageFailed: "That verification link did not work.",
  verifyPageFailedBody:
    "The link may have already been used or expired. Send yourself a new one from your account page.",
  verifyPageMissing: "This link is missing its verification token.",
  backToAccount: "Go to your account",
};
