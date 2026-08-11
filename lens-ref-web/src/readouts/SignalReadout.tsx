import { Sparkles } from "lucide-react";
import type { AccountFlow } from "../hooks/useAccountFlow";
import { useEntrance } from "./shared";

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
// the page. It rolls up from 00 on first reveal and rolls again, from wherever
// it last landed, if the count ever changes.
//
// With the referral program closed, this is now ONLY a statement of what the
// member already earned. Every forward-looking affordance was removed, because
// no one can act on any of them: the share-link row (nobody new can join through
// it), the "refer 1 more friend, unlock N months" next-milestone caption, and the
// progress bar (it tracked referrals toward the 12-month cap, so a partly filled
// bar would imply headroom that no longer exists). Their building blocks are kept
// dormant in ./shared (CopyChip, NextMilestoneLine) and on the flow itself
// (referralLink, nextMilestone, progress) so reopening the program is a matter of
// putting these back, not rebuilding them.
export default function SignalReadout({ flow }: { flow: AccountFlow }) {
  const shown = useEntrance();
  // Straight from the flow's granted-months number. This used to parse the digits
  // back out of the reward string, which yielded NaN for the old "Lifetime free"
  // tier; that tier is gone (the backend caps at 12 months and never grants
  // lifetime), so the count is always a real number now.
  const months = flow.earnedMonths;
  const displayMonths = shown ? months : 0;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-7 px-8 py-6 text-center">
      <div
        className={`transition-all duration-700 ease-out ${
          shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <span className="font-display text-8xl font-bold leading-none text-slate-900">
          <OdometerNumber months={displayMonths} />
        </span>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-sm text-slate-500">
          {flow.maxed && <Sparkles size={14} className="text-sky-500" />}
          {`${months === 1 ? "month" : "months"} free`}
        </p>
      </div>
    </div>
  );
}
