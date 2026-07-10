import { Sparkles } from "lucide-react";
import type { AccountFlow } from "../hooks/useAccountFlow";
import { CopyChip, NextMilestoneLine, gradient, monthsFromReward, useEntrance } from "./shared";

// One rolling digit: a column of 0-9 stacked vertically, translated up by
// `digit` line-heights. Because the move is a CSS transition, changing
// `digit` from e.g. 1 to 4 rolls visibly through 2 and 3 on the way there,
// the "dial" effect, for free, no per-frame JS needed.
function OdometerDigit({ digit }: { digit: number }) {
  return (
    <span className="relative inline-block h-[1em] w-[0.62em] overflow-hidden align-top">
      <span
        className="absolute inset-x-0 top-0 flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ transform: `translateY(-${digit}em)` }}
      >
        {Array.from({ length: 10 }, (_, d) => (
          <span key={d} className="flex h-[1em] items-center justify-center leading-none">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

// Always 2 digits ("00", "01", ... ), zero-padded, odometer style.
function OdometerNumber({ months }: { months: number }) {
  const clamped = Math.max(0, Math.min(99, months));
  return (
    <span className="inline-flex tabular-nums">
      <OdometerDigit digit={Math.floor(clamped / 10)} />
      <OdometerDigit digit={clamped % 10} />
    </span>
  );
}

// Concept: the months number is the whole point, so it's the largest thing on
// the page. It rolls up from 00 on first reveal and rolls again, from
// wherever it last landed, on every milestone change. One slim progress
// line, one link row. Nothing else competes with the number.
export default function SignalReadout({ flow }: { flow: AccountFlow }) {
  const shown = useEntrance();
  const pct = flow.progress * 100;
  const months = monthsFromReward(flow.currentReward);
  const displayMonths = shown && Number.isFinite(months) ? months : 0;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-7 px-8 py-6 text-center">
      <div
        className={`transition-all duration-700 ease-out ${
          shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        {flow.maxed ? (
          <span className="font-display text-8xl font-bold leading-none text-slate-900">&#8734;</span>
        ) : (
          <span className="font-display text-8xl font-bold leading-none text-slate-900">
            <OdometerNumber months={displayMonths} />
          </span>
        )}

        <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-slate-500">
          {flow.maxed ? (
            <>
              <Sparkles size={14} className="text-sky-500" />
              lifetime free
            </>
          ) : (
            `${months === 1 ? "month" : "months"} free`
          )}
        </p>
        <NextMilestoneLine flow={flow} className="mt-1 text-xs text-slate-400" />
      </div>

      <div className="relative h-1 w-full max-w-[260px] rounded-full bg-slate-900/10">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: shown ? `${pct}%` : "0%", backgroundImage: gradient }}
        />
      </div>

      <div
        className={`flex w-full max-w-md items-center gap-2 rounded-full border border-slate-200 bg-white py-2 pl-4 pr-1.5 shadow-sm transition-all delay-150 duration-700 ease-out ${
          shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-left text-sm text-slate-600">
          {flow.referralLink}
        </span>
        <CopyChip link={flow.referralLink} />
      </div>
    </div>
  );
}
