import type { AccountFlow } from "../hooks/useAccountFlow";
import { CopyChip, NextMilestoneLine, RewardText, gradient, useEntrance } from "./shared";

// Concept: one big number, one slim progress line, one link row. Nothing else.
export default function SignalReadout({ flow }: { flow: AccountFlow }) {
  const shown = useEntrance();
  const pct = flow.progress * 100;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 px-8 py-6 text-center">
      <div
        className={`transition-all duration-700 ease-out ${
          shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <RewardText flow={flow} className="font-display text-5xl font-bold leading-none" />
        <NextMilestoneLine flow={flow} className="mt-3 text-xs text-slate-400" />
      </div>

      <div className="relative h-1 w-full max-w-[220px] rounded-full bg-white/10">
        <div
          className="h-full rounded-full transition-[width] duration-1000 ease-out"
          style={{ width: shown ? `${pct}%` : "0%", backgroundImage: gradient }}
        />
      </div>

      <div
        className={`flex w-full max-w-sm items-center gap-2 rounded-full border border-white/10 bg-white/5 py-1.5 pl-4 pr-1.5 transition-all delay-150 duration-700 ease-out ${
          shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
        }`}
      >
        <span className="min-w-0 flex-1 truncate text-left text-xs text-slate-300">
          {flow.referralLink}
        </span>
        <CopyChip link={flow.referralLink} />
      </div>
    </div>
  );
}
