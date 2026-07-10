import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Check } from "lucide-react";
import {
  BRAND,
  COPY,
  HERO,
  HERO_ACCENTS,
  HOW_IT_WORKS,
  LAUNCH_DATE,
  REFERRAL_MILESTONES,
} from "../content";
import { useAccountFlow, type AccountFlow } from "../hooks/useAccountFlow";
import lensArcDark from "../../assets/lens-arc/lens-arc-dark.png";
import vectorDemo from "../../assets/video/1vector_demo.mp4";
import discoveryEnter from "../../assets/video/discovery_enter.mp4";
import discoveryRead from "../../assets/video/discovery_read.mp4";
import discoveryAct from "../../assets/video/discovery_act.mp4";

// Step videos, in HOW_IT_WORKS order (enter, read, act), same clips frontend/ uses.
const STEP_VIDEOS = [discoveryEnter, discoveryRead, discoveryAct];

const gradient = `linear-gradient(135deg, ${BRAND.gradientFrom}, ${BRAND.gradientTo})`;

function useCountdown() {
  const target = useMemo(() => new Date(LAUNCH_DATE + "T00:00:00").getTime(), []);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  const diff = Math.max(0, target - now);
  return [
    Math.floor(diff / 86400000),
    Math.floor(diff / 3600000) % 24,
    Math.floor(diff / 60000) % 60,
    Math.floor(diff / 1000) % 60,
  ];
}

const pad = (n: number) => String(n).padStart(2, "0");

function Headline() {
  const words = HERO.headline.split(" ");
  return (
    <>
      {words.map((word, i) => (
        <span key={i}>
          {HERO_ACCENTS.includes(word) ? (
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: gradient }}
            >
              {word}
            </span>
          ) : (
            word
          )}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

// Framed demo video, adapted from the frontend/ .demo-window but without the
// macOS-style chrome bar: just the rounded dark frame around the clip.
function DemoWindow({ src, aspect = "aspect-video" }: { src: string; aspect?: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#141922] shadow-2xl">
      <div className={`${aspect} bg-black`}>
        <video
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
        />
      </div>
    </div>
  );
}

function EmailCapture({ flow }: { flow: AccountFlow }) {
  const submit = (e: FormEvent) => {
    e.preventDefault();
    flow.submitEmail();
  };

  return (
    <form onSubmit={submit} noValidate className="max-w-lg">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          value={flow.email}
          onChange={(e) => flow.setEmail(e.target.value)}
          placeholder={COPY.emailPlaceholder}
          aria-label="email address"
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 transition focus:border-teal-500 focus:outline-none"
        />
        <button
          type="submit"
          className="flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-5 py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90"
          style={{ backgroundImage: gradient }}
        >
          {COPY.emailCta}
          <ArrowRight size={15} />
        </button>
      </div>
      {flow.emailError && <p className="mt-2 text-xs text-rose-600">{flow.emailError}</p>}
    </form>
  );
}

function VerifyDialog({ flow }: { flow: AccountFlow }) {
  const [linkResent, setLinkResent] = useState(false);
  const resendLink = () => {
    setLinkResent(true);
    window.setTimeout(() => setLinkResent(false), 1800);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-5 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-2xl">
        <h2 className="font-display text-xl font-bold tracking-tight text-slate-900">
          {COPY.magicHeading}
        </h2>
        <p className="mt-2 break-words text-sm text-slate-600">
          {COPY.magicInstruction(flow.email)}
        </p>
        <button
          type="button"
          onClick={flow.completeVerify}
          className="mt-6 w-full rounded-xl py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90"
          style={{ backgroundImage: gradient }}
        >
          {COPY.magicSimulate}
        </button>
        <p className="mt-3 text-xs text-slate-400">{COPY.magicNote}</p>
        <div className="mt-4 flex justify-center gap-6 text-xs">
          <button
            type="button"
            onClick={resendLink}
            className="text-slate-500 transition hover:text-slate-900"
          >
            {linkResent ? COPY.magicResent : COPY.magicResend}
          </button>
          <button
            type="button"
            onClick={flow.dismissVerify}
            className="text-slate-400 transition hover:text-slate-700"
          >
            {COPY.changeEmail}
          </button>
        </div>
      </div>
    </div>
  );
}

// Sits in the exact slot the email input occupied, same border/padding/height,
// so verifying doesn't jump the layout from a slim input row to a tall card.
function VerifiedBox({ email }: { email: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
      <Check size={16} className="shrink-0 text-teal-600" />
      <span className="truncate">{COPY.verifiedAs(email)}</span>
    </div>
  );
}

export default function Layout4() {
  const parts = useCountdown();
  const flow = useAccountFlow();

  return (
    <div className="bg-[#f6f7f9] font-sans text-slate-900">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <img
          src={lensArcDark}
          alt="Lens Arc"
          className="h-8 w-auto select-none"
          draggable={false}
        />
        <span className="text-sm font-semibold tabular-nums text-slate-900">
          {pad(parts[0])}:{pad(parts[1])}:{pad(parts[2])}:{pad(parts[3])}
        </span>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1fr_1.15fr] lg:pb-28 lg:pt-16">
        <div>
          <h1 className="max-w-xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl xl:text-6xl">
            <Headline />
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
            {HERO.subhead}
          </p>
          <div className="mt-8 max-w-lg">
            {flow.step === "account" ? (
              <VerifiedBox email={flow.email} />
            ) : (
              <EmailCapture flow={flow} />
            )}
          </div>
          <p className="mt-4 text-xs text-slate-500">{COPY.disclaimer}</p>
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute -inset-6 rounded-[2rem] opacity-15 blur-2xl"
            style={{ backgroundImage: gradient }}
          />
          <div className="relative">
            <DemoWindow src={vectorDemo} aspect="aspect-[16/10]" />
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {COPY.howHeading}
          </h2>
          <p className="mt-2 text-slate-600">{COPY.howSub}</p>
          <div className="mx-auto mt-12 max-w-5xl space-y-14 sm:space-y-16">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.title}
                className="grid items-center gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-12"
              >
                <DemoWindow src={STEP_VIDEOS[i]} />
                <div className="text-center lg:text-left">
                  <div className="flex items-center justify-center gap-4 lg:justify-start">
                    <span
                      className="bg-clip-text font-display text-5xl font-semibold leading-none text-transparent sm:text-6xl"
                      style={{ backgroundImage: gradient }}
                    >
                      {i + 1}
                    </span>
                    <h3 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                      {step.title}
                    </h3>
                  </div>
                  <p className="mx-auto mt-3 max-w-md text-slate-600 lg:mx-0">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {COPY.referralHeading}
          </h2>
          <p className="mt-2 max-w-xl text-slate-600">{COPY.referralSub}</p>

          <div className="relative mt-12 hidden md:block">
            <div
              className="absolute left-[10%] right-[10%] top-[15px] h-0.5 opacity-40"
              style={{ backgroundImage: gradient }}
            />
            <div className="relative grid grid-cols-5">
              {REFERRAL_MILESTONES.map((m, i) => {
                const last = i === REFERRAL_MILESTONES.length - 1;
                return (
                  <div key={m.referrals} className="flex flex-col items-center text-center">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-full font-display text-xs font-bold text-slate-950 ring-4 ring-[#f6f7f9]"
                      style={{ backgroundImage: gradient }}
                    >
                      {m.referrals}
                    </span>
                    <p
                      className={`mt-3 font-display text-sm font-semibold ${
                        last ? "bg-clip-text text-transparent" : ""
                      }`}
                      style={last ? { backgroundImage: gradient } : undefined}
                    >
                      {m.reward}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {m.referrals} {COPY.referralUnit(m.referrals)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-8 space-y-2.5 md:hidden">
            {REFERRAL_MILESTONES.map((m, i) => {
              const last = i === REFERRAL_MILESTONES.length - 1;
              return (
                <div
                  key={m.referrals}
                  className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
                >
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-slate-950"
                    style={{ backgroundImage: gradient }}
                  >
                    {m.referrals}
                  </span>
                  <div>
                    <p
                      className={`font-display text-sm font-semibold ${
                        last ? "bg-clip-text text-transparent" : ""
                      }`}
                      style={last ? { backgroundImage: gradient } : undefined}
                    >
                      {m.reward}
                    </p>
                    <p className="text-xs text-slate-500">
                      {m.referrals} {COPY.referralUnit(m.referrals)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 pb-20 pt-10 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <img
            src={lensArcDark}
            alt="Lens Arc"
            className="h-6 w-auto shrink-0 select-none self-start sm:self-center"
            draggable={false}
          />
          <p className="max-w-md leading-relaxed">{COPY.disclaimer}</p>
          <p className="shrink-0">{COPY.legal}</p>
        </div>
      </footer>

      {flow.step === "verifying" && <VerifyDialog flow={flow} />}
    </div>
  );
}
