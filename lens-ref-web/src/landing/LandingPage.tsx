import { ArrowRight, ShieldCheck, Unplug } from "lucide-react";
import { appOpenUrl, COPY, LEGAL_PAGES, NAV } from "../content";
import { CLASSIC, VIDEOS } from "./landingContent";
import { Clip, Reveal } from "./shared";
import SavingsSection from "./SavingsSection";
import { HeroButton } from "../components/buttons";
import { useAuth } from "../hooks/authContext";
import lensArcDark from "../../assets/lens-arc/lens-arc-dark.png";

// One icon per trust item, in CLASSIC.trust order.
const TRUST_ICONS = [Unplug, ShieldCheck];

// The / landing page: the established Protonyx house style, ported from
// frontend/ (index.html + landing.css) and the pre-launch lens-ref-web page.
// Dark #0c0f16 hero with the pulsing radial glow, IBM Plex Mono type, the
// teal/blue accent gradient, macOS-framed demo windows, the dark three-step
// discovery walkthrough, and the light trust strip.
//
// This was "Design 1 (Classic)" of a four-design comparison cycled with arrow
// keys; it won and the other three (Noir, Brutalist, Swiss) plus the switcher
// were deleted outright, the same build-several-delete-the-losers pattern as
// the old layout and readout explorations. They are in git history, not a
// reference to build from.

const grad = "linear-gradient(135deg, #2dd4bf, #38bdf8)";

function Accent({ children }: { children: string }) {
  return (
    <span className="bg-clip-text text-transparent" style={{ backgroundImage: grad }}>
      {children}
    </span>
  );
}

// One hero headline line, gradient-accenting the words CLASSIC.accentWords
// names so the copy (and which words glow) stays in landingContent.ts.
function HeadlineLine({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <span key={i}>
          {CLASSIC.accentWords.includes(word) ? <Accent>{word}</Accent> : word}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

// The frontend/ .demo-window, faithfully: traffic-light chrome bar + clip.
function DemoWindow({ src }: { src: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141922] shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
      <div className="flex items-center gap-1.5 border-b border-white/5 bg-white/5 px-3.5 py-2.5">
        <span className="h-[11px] w-[11px] rounded-full bg-[#ff5f57]" />
        <span className="h-[11px] w-[11px] rounded-full bg-[#febc2e]" />
        <span className="h-[11px] w-[11px] rounded-full bg-[#28c840]" />
      </div>
      <div className="aspect-video bg-black">
        <Clip src={src} />
      </div>
    </div>
  );
}

export default function LandingPage() {
  // Only for the app CTAs' href: a signed-in visitor carries their email into
  // the app's sign-up form, so an account is never accidentally created under a
  // second address (which is what earned Pro time is keyed to).
  const { user } = useAuth();
  const appHref = appOpenUrl(user?.email);
  return (
    <div className="min-h-screen bg-[#f2f1ee] font-sans text-[#1f2230]">
      {/* The persistent NavBar (mounted in App.tsx) floats over this hero.
          data-nav-dark on the dark sections drives its adaptive theme. */}
      {/* Hero: dark, two-column, pulsing radial glow */}
      <section
        data-nav-dark
        className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-[#0c0f16] px-[3.5%] pb-24 pt-40"
      >
        <div
          aria-hidden="true"
          className="hero-pulse pointer-events-none absolute -top-[20%] left-1/2 h-[1800px] w-[1800px] -translate-x-1/2"
          style={{
            background:
              "radial-gradient(circle, rgba(45,212,191,0.13) 0%, rgba(56,189,248,0.08) 40%, transparent 70%)",
          }}
        />
        <div className="relative z-10 mx-auto grid w-full max-w-[1840px] items-center gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-7">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white">
              {CLASSIC.eyebrow}
            </p>
            <h1 className="text-[clamp(2.6rem,4.8vw,5.75rem)] font-semibold leading-[1.05] tracking-tight text-white">
              <HeadlineLine text={CLASSIC.headlineTop} />
              <br />
              <HeadlineLine text={CLASSIC.headlineBottom} />
            </h1>
            <p className="max-w-[640px] text-[clamp(1.05rem,1.2vw,1.4rem)] leading-relaxed text-white/60">
              {CLASSIC.subtitle}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-7">
              <HeroButton href={appHref}>
                {CLASSIC.ctaPrimary}
                <ArrowRight size={17} />
              </HeroButton>
              {/* Deliberately quiet next to the hero CTA: a bare text link */}
              <a
                href={NAV.engine.href}
                className="text-base font-medium text-white/50 underline-offset-4 transition-colors duration-200 hover:text-white hover:underline"
              >
                {CLASSIC.ctaSecondary}
              </a>
            </div>
          </div>
          <DemoWindow src={VIDEOS.demo} />
        </div>
      </section>

      {/* Discovery: dark three-step video walkthrough */}
      <section data-nav-dark className="bg-[#0c0f16] px-[3.5%] py-32">
        <div className="mx-auto flex max-w-[1840px] flex-col items-center gap-12 text-center">
          <h2 className="text-[clamp(2rem,3.4vw,3.75rem)] font-semibold leading-tight tracking-tight text-white">
            {CLASSIC.workflowHeading}
          </h2>
          <div className="mx-auto grid w-full max-w-[1400px] gap-20">
            {CLASSIC.steps.map((step, i) => (
              <Reveal key={step.num}>
                <div className="grid items-center gap-8 text-left lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] lg:gap-14">
                  <DemoWindow src={[VIDEOS.enter, VIDEOS.read, VIDEOS.act][i]} />
                  <div className="flex flex-col gap-5 text-center lg:text-left">
                    <div className="flex items-baseline justify-center gap-6 lg:justify-start">
                      <span
                        className="bg-clip-text text-[clamp(2.4rem,3.6vw,4.25rem)] font-semibold leading-none text-transparent"
                        style={{ backgroundImage: grad }}
                      >
                        {step.num}
                      </span>
                      <p className="text-[clamp(2rem,3.2vw,3.5rem)] font-semibold leading-[1.05] tracking-tight text-white">
                        {step.title}
                      </p>
                    </div>
                    <p className="mx-auto max-w-[460px] text-[clamp(1rem,1.15vw,1.35rem)] leading-relaxed text-white/60 lg:mx-0">
                      {step.caption}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Savings calculator: the switching-math headline element */}
      <SavingsSection />

      {/* Trust strip: light, narrow divider */}
      <section className="border-t border-[#1f2230]/10 bg-[#f2f1ee] px-[3.5%] py-12">
        <Reveal>
          <div className="mx-auto flex max-w-[1840px] flex-wrap items-start justify-center gap-x-16 gap-y-8">
            {CLASSIC.trust.map((item, i) => {
              const Icon = TRUST_ICONS[i];
              return (
                <div key={item.label} className="flex max-w-[420px] items-start gap-4">
                  <Icon
                    size={30}
                    strokeWidth={1.8}
                    className="mt-0.5 shrink-0 text-[#2dd4bf]"
                    aria-hidden="true"
                  />
                  <div>
                    <p className="text-[1.02rem] font-semibold leading-tight">{item.label}</p>
                    <p className="mt-1 text-[0.92rem] leading-relaxed text-[#1f2230]/60">
                      {item.sub}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Reveal>
      </section>

      {/* Closing CTA: light */}
      <section className="border-t border-[#1f2230]/10 bg-[#f2f1ee] px-[3.5%] py-28">
        <Reveal>
          <div className="mx-auto flex max-w-[1840px] flex-col items-center gap-7 text-center">
            <h2 className="text-[clamp(2.2rem,4vw,4.25rem)] font-semibold leading-[1.1] tracking-tight">
              <Accent>{CLASSIC.closingHeading}</Accent>
            </h2>
            <p className="max-w-[880px] text-[clamp(0.95rem,1.1vw,1.25rem)] leading-relaxed text-[#1f2230]/70">
              {CLASSIC.closingSub}
            </p>
            <HeroButton href={NAV.app.href}>
              {CLASSIC.closingCta}
              <ArrowRight size={17} />
            </HeroButton>
          </div>
        </Reveal>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#1f2230]/10 bg-[#f2f1ee] px-[3.5%] py-10">
        <div className="mx-auto flex max-w-[1840px] flex-col items-center justify-between gap-4 text-sm text-[#1f2230]/55 sm:flex-row">
          <img
            src={lensArcDark}
            alt="Lens Arc"
            className="h-6 w-auto select-none"
            draggable={false}
          />
          <p className="max-w-xl text-center text-xs sm:text-right">{COPY.disclaimer}</p>
          <div className="flex items-center gap-5 text-xs">
            {Object.values(LEGAL_PAGES).map((page) => (
              <a
                key={page.path}
                href={page.path}
                className="transition hover:text-[#1f2230]"
              >
                {page.title}
              </a>
            ))}
            <span>{COPY.legal}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
