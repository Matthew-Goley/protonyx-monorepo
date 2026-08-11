// All copy for the / landing page lives here, same rule as src/content.ts:
// components never hardcode text. The page carries three required messages:
//   1. Lens Arc is an investment tool that makes choosing stocks simple.
//   2. User data is secure.
//   3. This is real, tested software, not a concept.
// (This file once held copy for four competing designs; Classic won and the
// NOIR/BRUT/SWISS blocks were deleted with their components.)

import vectorDemo from "../../assets/video/1vector_demo.mp4";
import discoveryEnter from "../../assets/video/discovery_enter.mp4";
import discoveryRead from "../../assets/video/discovery_read.mp4";
import discoveryAct from "../../assets/video/discovery_act.mp4";

// The four product recordings (2K 16:9 re-exports, same files the referral
// page uses). demo is a full product walkthrough; the three discovery clips
// map to the enter / read / act workflow steps.
export const VIDEOS = {
  demo: vectorDemo,
  enter: discoveryEnter,
  read: discoveryRead,
  act: discoveryAct,
} as const;

export const CLASSIC = {
  eyebrow: "Lens Arc",
  headlineTop: "Actionable Insight",
  headlineBottom: "for Everyone.",
  accentWords: ["Actionable", "Insight", "Everyone."],
  subtitle:
    "An investment tool that makes choosing stocks simple. Lens Arc reads your portfolio, ranks what matters most, and explains it in plain language.",
  ctaPrimary: "Enter Lens Arc",
  ctaSecondary: "See the engine",
  workflowHeading: "Three steps. One loop.",
  steps: [
    { num: "1", title: "Enter.", caption: "Add your positions. See your dashboard." },
    { num: "2", title: "Read.", caption: "Scroll through your Lens diagnosis." },
    { num: "3", title: "Act.", caption: "Follow the top action. Check back tomorrow." },
  ],
  trust: [
    {
      label: "Nothing to connect.",
      sub: "No brokerage login, no API keys, no statements to upload. A ticker and a share count per holding is the entire ask.",
    },
    {
      label: "Your data is secure.",
      sub: "Holdings are never sold, never fed to advertisers, and never written to disk in your browser. Sessions and passwords are locked down the boring, correct way.",
    },
  ],
  closingHeading: "Start now.",
  closingSub:
    "Open the app and run your first analysis in minutes. Joined the referral program? Your earned Pro time is waiting.",
  closingCta: "Open Lens Arc",
};

// The savings calculator section (src/landing/SavingsSection.tsx): a slider
// of money invested, a typical 1% AUM advisor fee computed from it, minus
// Lens Arc's flat annual price, equals what switching saves per year. The
// numbers here are the single source of truth for that math.
export const SAVINGS = {
  headingPre: "What switching ",
  headingAccent: "saves",
  headingPost: " you.",
  sub: "Drag to your portfolio size.",
  amountLabel: "Money invested",
  advisorLabel: "Typical financial advisor (1% AUM)*",
  lensLabel: "Lens Arc",
  saveLabel: "You'd save",
  perYear: "/ year",
  footnote:
    "*Assuming a standard 1% assets-under-management fee charged by a financial advisor, billed yearly. Illustrative comparison only.",
  min: 25_000,
  max: 1_000_000,
  step: 5_000,
  initial: 250_000,
  advisorRate: 0.01, // 1% AUM
  lensAnnual: 120, // $ per year
};
