import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  CalendarClock,
  Coins,
  Layers,
  LineChart,
  PieChart,
  Scale,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import SimplePage from "../components/SimplePage";
import { BtnLink } from "../components/buttons";
import { APP_URL, NAV, ROUTES } from "../content";

// The /lens-arc page: a deeper, plain-language walkthrough of what the Lens
// engine actually does, written for a non-technical investor who wants to know
// the tool is real before trusting it. Every claim here is grounded in the
// engine as documented in lens-api/CLAUDE.md (the 8 analyzers, the caution
// score formula, the CTA engine, risk tiers, Monte Carlo, the parity harness).
// Do not add capabilities or numbers the engine does not have.

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-slate-600">
        {children}
      </div>
    </section>
  );
}

const ANALYZERS = [
  {
    icon: TrendingUp,
    name: "Trend",
    detail: "Which direction each holding, and the portfolio as a whole, has been moving.",
  },
  {
    icon: Activity,
    name: "Volatility",
    detail: "How sharply each position swings, and whether the swings fit your risk tier.",
  },
  {
    icon: PieChart,
    name: "Concentration",
    detail: "Whether too much of the portfolio rides on a single stock or a single sector.",
  },
  {
    icon: CalendarClock,
    name: "Earnings",
    detail: "Upcoming earnings dates that could move positions you hold.",
  },
  {
    icon: Coins,
    name: "Dividends",
    detail: "Dividend timing across your holdings, so payouts never catch you off guard.",
  },
  {
    icon: Scale,
    name: "Beta",
    detail: "How much your portfolio amplifies, or cushions, moves in the broader market.",
  },
  {
    icon: BarChart3,
    name: "Performance",
    detail: "Which holdings are pulling their weight and which have gone quiet.",
  },
  {
    icon: Layers,
    name: "Index funds",
    detail:
      "Recognizes index ETFs, so a diversified fund is never flagged like a single concentrated stock.",
  },
];

export default function EnginePage() {
  return (
    <SimplePage
      title="The Lens engine"
      subtitle="Lens Arc is built on one thing: a diagnostic engine that reads your portfolio the way a careful analyst would, and explains what it sees in plain language. This page walks through exactly how it works."
      wide
    >
      <div className="max-w-3xl space-y-12">
        <Section title="What happens when you run an analysis">
          <p>
            You give Lens Arc two things per holding: a ticker and a share count. No brokerage
            login, no account linking, no statements to upload. The engine pulls public market
            data for those tickers, runs its full analysis pass, and returns three things: a
            short written brief, a caution score, and a ranked list of specific actions.
          </p>
          <p>
            The whole pass is deterministic. The same portfolio, at the same moment, always
            produces the same reading. Nothing is randomized, reworded on a whim, or generated
            differently between runs, so you can trust that a change in your readout reflects a
            change in your portfolio or the market, not noise.
          </p>
        </Section>

        <Section title="Eight analyzers, one picture">
          <p>
            Every analysis runs eight independent analyzers. Each one scores every holding and
            the portfolio as a whole, and grades what it finds on a five-step severity scale
            from "nothing to note" to "critical". Flags only raise when a threshold is actually
            crossed:
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {ANALYZERS.map((a) => (
              <div
                key={a.name}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 transition hover:border-slate-300"
              >
                <div className="flex items-center gap-2.5">
                  <a.icon size={17} className="shrink-0 text-teal-600" aria-hidden="true" />
                  <h3 className="font-display text-sm font-semibold text-slate-900">
                    {a.name}
                  </h3>
                </div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-600">{a.detail}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="The caution score">
          <p>
            Everything the analyzers find is distilled into a single number from 1 to 99. It
            answers one question: how much of your portfolio needs attention right now?
          </p>
          <p>
            It is not a vibe. The score is computed from the dollar value of the actions the
            engine proposes relative to your total equity, with a floor that reflects how much
            of your portfolio is sitting in flagged positions. A low score means the engine
            looked and found little worth acting on. A high score means a meaningful share of
            your money is tied up in things it flagged. Either way, you can see exactly which
            flags produced the number.
          </p>
        </Section>

        <Section title="The brief and the action list">
          <p>
            The brief is three sentences in plain English: where the portfolio stands, what is
            coming up that could move it, and the single most useful thing to look at next. No
            jargon, no wall of charts to decode first.
          </p>
          <p>
            Below it sits the action list. Each item is specific and sized to your portfolio:
            which position, what kind of action (trim, rebalance, add, or hold), and a dollar
            amount proportional to what you actually hold. The list is prioritized through
            eleven ranked levels, so the most urgent finding is always first. Suggestions to
            diversify are sector-aware: the engine never proposes adding to the very sector it
            just flagged as overweight, and it prunes actions too small to matter.
          </p>
        </Section>

        <Section title="Your risk tier shapes everything">
          <p>
            During onboarding you pick a risk tier: low, regular, or high. The engine reads the
            same portfolio differently for each one. A cautious investor gets tighter
            volatility thresholds and smaller, gentler position adjustments; an aggressive one
            gets more headroom before a flag raises. The tier is not a label on your profile,
            it is an input to every analyzer, every threshold, and every proposed dollar
            amount.
          </p>
        </Section>

        <Section title="Projections, honestly framed">
          <p>
            Lens Arc can project your portfolio forward, including Monte Carlo simulation that
            runs many possible market paths and shows you the range of outcomes rather than a
            single confident line. Projections also model what the engine's proposed actions
            would do to the portfolio's makeup, so you can compare "as is" against "if I acted
            on this" before touching anything.
          </p>
          <p>
            Projections are estimates and are labelled as estimates in the app. The engine
            never claims to predict the market.
          </p>
        </Section>

        <Section title="Tested like software, because it is software">
          <p>
            The Lens engine is not a launch-week prototype. It was built and refined inside
            Vector, our desktop analytics product, before Lens Arc brought it to the web, and
            the same engine core powers both.
          </p>
          <p>
            Because the engine is deterministic, we hold it to a strict standard: a regression
            harness runs it against a fixed set of 50 portfolios across all three risk tiers,
            and any change to the engine must reproduce the expected output exactly,
            byte-for-byte, before it ships. When we tune a threshold, it is a deliberate,
            versioned decision, not drift.
          </p>
        </Section>

        <Section title="Your data">
          <p>
            The engine needs remarkably little from you, and that is by design. Your positions
            are tickers and share counts, stored in your account and used to run your analysis.
            We never ask for brokerage credentials, so there is no brokerage connection to
            secure in the first place. Sessions use httpOnly cookies that page scripts cannot
            read, passwords are stored only as bcrypt hashes, and your raw holdings are
            deliberately excluded from the data the app caches in your browser at rest.
          </p>
          <p className="flex items-start gap-2 rounded-xl border border-teal-100 bg-teal-50/60 p-4 text-[13px] text-slate-700">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-teal-600" aria-hidden="true" />
            <span>
              We do not sell your data, and the analysis runs for you, not on you: nothing
              about your portfolio is used for advertising.
            </span>
          </p>
        </Section>

        <Section title="What Lens Arc is not">
          <p>
            Lens Arc is an educational and diagnostic tool. It does not give investment,
            financial, tax, or legal advice, and nothing it produces is a recommendation to
            buy, sell, or hold any security. It shows you what a careful, consistent reading
            of your portfolio surfaces, and leaves the decision where it belongs: with you.
          </p>
        </Section>

        <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-8">
          <BtnLink href={APP_URL} role="primary">
            <LineChart size={16} aria-hidden="true" />
            Run it on your portfolio
          </BtnLink>
          <a
            href={ROUTES.referral}
            className="text-sm font-medium text-slate-500 underline-offset-4 transition hover:text-slate-900 hover:underline"
          >
            {NAV.referral.label}
          </a>
        </div>
      </div>
    </SimplePage>
  );
}
