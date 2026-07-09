import { useEffect, useId, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, Check, Copy, Layers, Percent, Share2, ShieldAlert, Sparkles } from "lucide-react";
import {
  BRAND,
  COPY,
  HERO,
  HOW_IT_WORKS,
  LAUNCH_DATE,
  LAUNCH_DATE_DISPLAY,
  PREVIEW,
  REFERRAL_MILESTONES,
  type FlagSeverity,
} from "../content";
import {
  nextStepLine,
  useAccountFlow,
  useCopyToClipboard,
  useShare,
  type AccountFlow,
} from "../hooks/useAccountFlow";
import { useOtpInput } from "../hooks/useOtpInput";

const gradient = `linear-gradient(135deg, ${BRAND.gradientFrom}, ${BRAND.gradientTo})`;

function ApertureMark({ size = 26 }: { size?: number }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor={BRAND.gradientFrom} />
          <stop offset="1" stopColor={BRAND.gradientTo} />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="11" stroke={`url(#${id})`} strokeWidth="2" />
      <circle cx="16" cy="16" r="5.5" stroke={`url(#${id})`} strokeWidth="1.5" />
      <circle cx="16" cy="16" r="1.8" fill={`url(#${id})`} />
      <line x1="16" y1="1" x2="16" y2="4.5" stroke={`url(#${id})`} strokeWidth="1.5" />
      <line x1="16" y1="27.5" x2="16" y2="31" stroke={`url(#${id})`} strokeWidth="1.5" />
      <line x1="1" y1="16" x2="4.5" y2="16" stroke={`url(#${id})`} strokeWidth="1.5" />
      <line x1="27.5" y1="16" x2="31" y2="16" stroke={`url(#${id})`} strokeWidth="1.5" />
    </svg>
  );
}

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

const SEVERITY: Record<
  FlagSeverity,
  { label: string; chip: string; Icon: typeof ShieldAlert }
> = {
  high: {
    label: "high",
    chip: "border-rose-400/25 bg-rose-400/10 text-rose-300",
    Icon: ShieldAlert,
  },
  medium: {
    label: "medium",
    chip: "border-amber-400/25 bg-amber-400/10 text-amber-300",
    Icon: Percent,
  },
  low: {
    label: "low",
    chip: "border-sky-400/25 bg-sky-400/10 text-sky-300",
    Icon: Layers,
  },
};

function CautionGauge() {
  return (
    <div className="relative flex flex-col items-center">
      <svg width="150" height="86" viewBox="0 0 120 68" fill="none" aria-hidden="true">
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          stroke="rgba(255,255,255,0.09)"
          strokeWidth="9"
          strokeLinecap="round"
          pathLength={100}
        />
        <path
          d="M 10 60 A 50 50 0 0 1 110 60"
          stroke="#fbbf24"
          strokeWidth="9"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${PREVIEW.score} ${100 - PREVIEW.score}`}
        />
      </svg>
      <div className="absolute bottom-1 flex flex-col items-center">
        <span className="font-display text-3xl font-bold tabular-nums text-white">
          {PREVIEW.score}
        </span>
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

function OtpDialog({ flow }: { flow: AccountFlow }) {
  const otp = useOtpInput();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (otp.validate()) flow.completeVerify();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-5 backdrop-blur-sm"
    >
      <form
        onSubmit={submit}
        noValidate
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-2xl"
      >
        <span
          className="mx-auto flex h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundImage: gradient }}
        >
          <Check size={18} className="text-slate-950" />
        </span>
        <h2 className="mt-4 font-display text-xl font-bold tracking-tight text-slate-900">
          {COPY.otpHeading}
        </h2>
        <p className="mt-2 break-words text-sm text-slate-600">
          {COPY.otpInstruction(flow.email)}
        </p>
        <div className="mt-6 flex justify-center gap-2.5">
          {otp.digits.map((d, i) => (
            <input
              key={i}
              ref={otp.setRef(i)}
              value={d}
              onChange={(e) => otp.handleChange(i, e.target.value)}
              onKeyDown={(e) => otp.handleKeyDown(i, e)}
              onPaste={(e) => otp.handlePaste(i, e)}
              inputMode="numeric"
              autoComplete="one-time-code"
              aria-label={`digit ${i + 1}`}
              className="h-14 w-12 rounded-xl border border-slate-300 bg-white text-center font-display text-2xl font-bold text-slate-900 shadow-sm transition focus:border-teal-500 focus:outline-none"
            />
          ))}
        </div>
        {otp.error && <p className="mt-3 text-xs text-rose-600">{otp.error}</p>}
        <button
          type="submit"
          className="mt-6 w-full rounded-xl py-3 text-sm font-semibold text-slate-950 transition hover:opacity-90"
          style={{ backgroundImage: gradient }}
        >
          {COPY.otpVerify}
        </button>
        <div className="mt-4 flex justify-center gap-6 text-xs">
          <button
            type="button"
            onClick={otp.reset}
            className="text-slate-500 transition hover:text-slate-900"
          >
            {COPY.otpResend}
          </button>
          <button
            type="button"
            onClick={flow.dismissVerify}
            className="text-slate-400 transition hover:text-slate-700"
          >
            {COPY.otpChangeEmail}
          </button>
        </div>
      </form>
    </div>
  );
}

function Dial({ flow, size = 120 }: { flow: AccountFlow; size?: number }) {
  const id = useId();
  const pct = flow.progress * 100;
  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg
        className={flow.maxed ? "dial-max" : undefined}
        width={size}
        height={size}
        viewBox="0 0 120 120"
        fill="none"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="120" y2="120" gradientUnits="userSpaceOnUse">
            <stop stopColor={BRAND.gradientFrom} />
            <stop offset="1" stopColor={BRAND.gradientTo} />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="52" stroke="#e2e8f0" strokeWidth="8" />
        {pct > 0 && (
          <circle
            cx="60"
            cy="60"
            r="52"
            stroke={`url(#${id})`}
            strokeWidth="8"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${pct} ${100 - pct}`}
            transform="rotate(-90 60 60)"
            className="transition-all duration-700"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {flow.maxed && <Sparkles size={15} className="text-sky-500" />}
        <span
          className={`px-3 font-display text-sm font-bold leading-tight ${
            flow.maxed ? "bg-clip-text text-transparent" : "text-slate-900"
          }`}
          style={flow.maxed ? { backgroundImage: gradient } : undefined}
        >
          {COPY.rewardShort(flow.currentReward)}
        </span>
        <span className="text-[10px] text-slate-500">{COPY.unlockedWord}</span>
      </div>
    </div>
  );
}

function ReferralRow({ flow }: { flow: AccountFlow }) {
  const { copied, copy } = useCopyToClipboard();
  const { canShare, share } = useShare();

  return (
    <div>
      <p className="text-[11px] text-slate-500">{COPY.referralRowLabel}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <span className="min-w-0 flex-1 truncate rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm">
          {flow.referralLink}
        </span>
        <button
          type="button"
          onClick={() => copy(flow.referralLink)}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold text-slate-950 transition hover:opacity-90"
          style={{ backgroundImage: gradient }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? COPY.copiedLabel : COPY.copyLabel}
        </button>
        {canShare && (
          <button
            type="button"
            onClick={() => share("https://" + flow.referralLink)}
            aria-label={COPY.shareLabel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm transition hover:border-teal-500"
          >
            <Share2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

function AccountView({ flow }: { flow: AccountFlow }) {
  return (
    <div className="max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Check size={13} className="shrink-0 text-teal-600" />
        <span className="truncate">{flow.email}</span>
        <span className="text-slate-300">&middot;</span> {COPY.verifiedWord}
      </p>
      <div className="mt-4 flex flex-col items-center gap-5 sm:flex-row">
        <Dial flow={flow} />
        <div className="min-w-0 flex-1">
          <p className="text-center text-sm font-medium text-slate-800 sm:text-left">
            {nextStepLine(flow)}
          </p>
          <div className="mt-3">
            <ReferralRow flow={flow} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Layout4() {
  const parts = useCountdown();
  const flow = useAccountFlow();

  return (
    <div className="bg-[#f6f7f9] font-sans text-slate-900">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2.5">
          <ApertureMark />
          <span className="font-display text-lg font-semibold tracking-tight">
            {BRAND.wordmark}
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-600 shadow-sm">
          <span className="hidden sm:inline">{COPY.eyebrow}</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {pad(parts[0])}:{pad(parts[1])}:{pad(parts[2])}:{pad(parts[3])}
          </span>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-6 pb-20 pt-10 lg:grid-cols-[1fr_1.15fr] lg:pb-28 lg:pt-16">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundImage: gradient }} />
            {COPY.eyebrow} {LAUNCH_DATE_DISPLAY}
          </p>
          <h1 className="mt-6 max-w-xl font-display text-4xl font-bold leading-tight tracking-tight sm:text-5xl xl:text-6xl">
            {HERO.headline}
          </h1>
          <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600 sm:text-lg">
            {HERO.subhead}
          </p>
          <div className="mt-8">
            {flow.step === "account" ? <AccountView flow={flow} /> : <EmailCapture flow={flow} />}
          </div>
          <p className="mt-4 text-xs text-slate-500">{COPY.disclaimer}</p>
        </div>

        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute -inset-6 rounded-[2rem] opacity-15 blur-2xl"
            style={{ backgroundImage: gradient }}
          />
          <div className="relative overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1020] shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-white/5 px-4 py-3">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="ml-3 text-xs text-slate-500">
                {BRAND.wordmark} &middot; {PREVIEW.reportTitle}
              </span>
            </div>

            <div className="grid gap-3 p-4 sm:grid-cols-[auto_1fr] sm:p-5">
              <div className="flex flex-col items-center rounded-xl border border-white/5 bg-white/[0.03] px-6 py-4">
                <p className="text-xs font-medium text-slate-400">{PREVIEW.scoreLabel}</p>
                <CautionGauge />
                <span className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-0.5 text-xs font-semibold text-amber-300">
                  <ShieldAlert size={12} />
                  {PREVIEW.scoreBand}
                </span>
                <p className="mt-2 text-center text-[11px] text-slate-500">
                  {PREVIEW.scoreCaption}
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                {PREVIEW.flags.map((flag) => {
                  const sev = SEVERITY[flag.severity];
                  return (
                    <div
                      key={flag.title}
                      className="flex-1 rounded-xl border border-white/5 bg-white/[0.03] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-100">{flag.title}</p>
                        <span
                          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${sev.chip}`}
                        >
                          <sev.Icon size={11} />
                          {sev.label}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">{flag.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="relative mx-4 mb-4 overflow-hidden rounded-xl bg-white/[0.04] p-3.5 sm:mx-5 sm:mb-5">
              <div
                className="absolute inset-y-0 left-0 w-1"
                style={{ backgroundImage: gradient }}
              />
              <p
                className="bg-clip-text text-xs font-semibold text-transparent"
                style={{ backgroundImage: gradient }}
              >
                {PREVIEW.action.label}
              </p>
              <p className="mt-1 text-sm text-slate-300">{PREVIEW.action.detail}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            {COPY.howHeading}
          </h2>
          <p className="mt-2 text-slate-600">{COPY.howSub}</p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-2xl border border-slate-200 bg-[#f6f7f9] p-6"
              >
                <span
                  className="flex h-9 w-9 items-center justify-center rounded-full font-display text-sm font-bold text-slate-950"
                  style={{ backgroundImage: gradient }}
                >
                  {i + 1}
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-slate-600">{step.detail}</p>
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
          <div className="flex items-center gap-2">
            <ApertureMark size={20} />
            <span className="font-display font-semibold text-slate-700">{BRAND.wordmark}</span>
          </div>
          <p className="max-w-md leading-relaxed">{COPY.disclaimer}</p>
          <p className="shrink-0">{COPY.legal}</p>
        </div>
      </footer>

      {flow.step === "verifying" && <OtpDialog flow={flow} />}
    </div>
  );
}
