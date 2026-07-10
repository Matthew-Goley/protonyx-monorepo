export const LAUNCH_DATE = "2026-08-05"; // placeholder, easy to change in one place

export const HERO = {
  headline: "Actionable Insight for Everyone.",
  subhead:
    "A diagnostic that catches fee drag, concentration risk, and hidden exposure before it costs you.",
};

// Headline words that get the brand gradient, mirroring the frontend/ hero.
export const HERO_ACCENTS = ["Actionable", "Insight", "Everyone."];

export const HOW_IT_WORKS = [
  { title: "Add your positions", detail: "No brokerage login needed" },
  { title: "Get your brief", detail: "Plain language breakdown" },
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
  changeEmail: "Use a different email",
  magicHeading: "Check your email",
  magicInstruction: (email: string) =>
    `We sent a link to ${email}. Click it and you've got a free month of Pro.`,
  magicSimulate: "I clicked the link",
  magicNote:
    "In production this happens automatically once you click the emailed link.",
  magicResend: "Resend link",
  magicResent: "Link sent",
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
    "Educational tool only. Not investment advice. See full disclaimer in our Terms of Service.",
  legal: "© 2026 Protonyx",
};

