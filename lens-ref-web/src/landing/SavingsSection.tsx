import { useState } from "react";
import { SAVINGS } from "./landingContent";
import { Reveal } from "./shared";

// The savings calculator, a headline element of the landing page: drag the
// invested amount, watch a typical 1% AUM advisor fee grow with it, subtract
// Lens Arc's flat year price, and the difference (the reason to switch) is
// the big gradient number. All copy and math constants live in SAVINGS in
// landingContent.ts; the asterisk footnote carries the 1% AUM assumption.

const grad = "linear-gradient(135deg, #2dd4bf, #38bdf8)";

const fmt = (n: number) => "$" + Math.round(n).toLocaleString("en-US");

export default function SavingsSection() {
  const [amount, setAmount] = useState(SAVINGS.initial);
  const advisor = amount * SAVINGS.advisorRate;
  const saved = Math.max(0, advisor - SAVINGS.lensAnnual);
  const pct =
    ((amount - SAVINGS.min) / (SAVINGS.max - SAVINGS.min)) * 100;

  return (
    <section className="bg-[#f2f1ee] px-[3.5%] py-28">
      <Reveal>
        <div className="mx-auto flex max-w-[1840px] flex-col items-center gap-4 text-center">
          <h2 className="text-[clamp(2rem,3.4vw,3.75rem)] font-semibold leading-tight tracking-tight">
            {SAVINGS.headingPre}
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: grad }}
            >
              {SAVINGS.headingAccent}
            </span>
            {SAVINGS.headingPost}
          </h2>
          <p className="text-[clamp(0.95rem,1.1vw,1.25rem)] text-[#1f2230]/60">
            {SAVINGS.sub}
          </p>

          <div className="mt-8 w-full max-w-2xl rounded-2xl border border-[#1f2230]/15 bg-white p-7 text-left shadow-[0_10px_40px_rgba(31,34,48,0.08)] sm:p-9">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm text-[#1f2230]/60">{SAVINGS.amountLabel}</span>
              <span className="text-3xl font-semibold tabular-nums sm:text-4xl">
                {fmt(amount)}
              </span>
            </div>
            <input
              type="range"
              min={SAVINGS.min}
              max={SAVINGS.max}
              step={SAVINGS.step}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              aria-label={SAVINGS.amountLabel}
              className="savings-slider mt-6 w-full"
              style={{
                background: `linear-gradient(90deg, #2dd4bf, #38bdf8 ${pct}%, #e6e4df ${pct}%, #e6e4df 100%)`,
              }}
            />

            <div className="mt-9 space-y-3.5 text-sm">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[#1f2230]/60">{SAVINGS.advisorLabel}</span>
                <span className="whitespace-nowrap font-semibold tabular-nums">
                  {fmt(advisor)}{" "}
                  <span className="font-normal text-[#1f2230]/45">{SAVINGS.perYear}</span>
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-[#1f2230]/60">{SAVINGS.lensLabel}</span>
                <span className="whitespace-nowrap font-semibold tabular-nums">
                  {fmt(SAVINGS.lensAnnual)}{" "}
                  <span className="font-normal text-[#1f2230]/45">{SAVINGS.perYear}</span>
                </span>
              </div>
            </div>

            <div className="mt-7 flex flex-wrap items-baseline justify-between gap-2 border-t border-[#1f2230]/10 pt-7">
              <span className="text-base font-semibold">{SAVINGS.saveLabel}</span>
              <span
                className="whitespace-nowrap bg-clip-text text-4xl font-semibold tabular-nums text-transparent sm:text-5xl"
                style={{ backgroundImage: grad }}
              >
                {fmt(saved)}{" "}
                <span className="text-lg font-medium">{SAVINGS.perYear}</span>
              </span>
            </div>
          </div>

          <p className="mt-4 max-w-xl text-xs leading-relaxed text-[#1f2230]/50">
            {SAVINGS.footnote}
          </p>
        </div>
      </Reveal>
    </section>
  );
}
