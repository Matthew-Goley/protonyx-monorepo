export const LAUNCH_DATE = "2026-08-05"; // placeholder, easy to change in one place

export const OTP_LENGTH = 4; // change to 3 to test a shorter, more frictionless code

export const HERO = {
  headline: "Actionable Insight for Everyone.",
  subhead:
    "A diagnostic that catches fee drag, concentration risk, and hidden exposure before it costs you.",
};

// Headline words that get the brand gradient, mirroring the frontend/ hero.
export const HERO_ACCENTS = ["Actionable", "Insight", "Everyone."];

export const HOW_IT_WORKS = [
  { title: "Add your positions", detail: "No brokerage login needed" },
  { title: "Get your caution score", detail: "Plain language breakdown" },
  { title: "See what to fix", detail: "Ranked, specific actions" },
];

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

// Human-readable launch date, derived once from LAUNCH_DATE.
export const LAUNCH_DATE_DISPLAY = new Date(
  LAUNCH_DATE + "T00:00:00"
).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

// Shared microcopy. Every layout pulls strings from here, never inline.
export const COPY = {
  eyebrow: "Free access opens",
  emailPlaceholder: "you@example.com",
  emailCta: "Get early access",
  emailInvalid: "Enter a valid email address",
  otpHeading: "Confirm your email",
  otpInstruction: (email: string) =>
    `Enter the ${OTP_LENGTH} digit code we sent to ${email}`,
  otpIncomplete: `Enter all ${OTP_LENGTH} digits`,
  otpVerify: "Verify",
  otpResend: "Resend code",
  otpChangeEmail: "Use a different email",
  verifiedWord: "verified",
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
  maxedLine: "Every tier unlocked. Lifetime Pro starts at launch.",
  referralRowLabel: "Your referral link",
  copyLabel: "Copy",
  copiedLabel: "Copied",
  shareLabel: "Share",
  referralLinkBase: "lensarc.com/r/",
  countdownCaption: "until free access opens",
  countdownUnits: ["days", "hours", "minutes", "seconds"] as const,
  howHeading: "How it works",
  howSub: "Three steps from raw positions to a ranked fix list.",
  previewHeading: "What the diagnostic flags",
  previewSub:
    "A sample readout, the kind of thing lens arc surfaces in a real portfolio.",
  referralHeading: "Refer friends, stack free Pro time",
  referralSub:
    "Everyone starts with a month of Pro free at launch. Each friend who joins from your link extends it.",
  referralUnit: (n: number) => (n === 1 ? "referral" : "referrals"),
  disclaimer:
    "Lens arc is a diagnostic tool for understanding your own portfolio. It is not investment advice.",
  legal: "© 2026 Protonyx",
};

// Mocked report content used by the product-preview and split-screen layouts.
export type FlagSeverity = "high" | "medium" | "low";

export const PREVIEW = {
  reportTitle: "diagnostic report",
  scoreLabel: "Caution score",
  score: 62,
  scoreBand: "elevated",
  scoreCaption: "3 flags across 12 positions",
  flags: [
    {
      severity: "high" as FlagSeverity,
      title: "Concentration risk",
      detail: "41% of equity sits in a single position",
    },
    {
      severity: "medium" as FlagSeverity,
      title: "Fee drag",
      detail: "0.86% average expense ratio across four funds",
    },
    {
      severity: "low" as FlagSeverity,
      title: "Hidden overlap",
      detail: "Two funds share 6 of their top 10 holdings",
    },
  ],
  action: {
    label: "Top ranked action",
    detail: "Review the position holding 41% of equity and set a target weight",
  },
};
