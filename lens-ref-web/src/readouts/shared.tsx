import { useEffect, useState } from "react";
import { Check, Copy, Sparkles } from "lucide-react";
import { BRAND, COPY } from "../content";
import {
  nextStepLine,
  useCopyToClipboard,
  type AccountFlow,
} from "../hooks/useAccountFlow";

export const gradient = `linear-gradient(135deg, ${BRAND.gradientFrom}, ${BRAND.gradientTo})`;

// Flips true one paint after mount so entrance transitions have a genuine
// 0-state to animate from instead of snapping in already visible.
export function useEntrance() {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  return shown;
}

// The reward number every layout leads with, e.g. "1 month" or "Lifetime",
// with the sparkle only appearing once every tier is unlocked.
export function RewardText({ flow, className = "" }: { flow: AccountFlow; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {flow.maxed && <Sparkles size={16} className="shrink-0 text-sky-300" />}
      <span className="bg-clip-text text-transparent" style={{ backgroundImage: gradient }}>
        {COPY.rewardShort(flow.currentReward)}
      </span>
    </span>
  );
}

// Icon-only copy affordance shared by every readout: tap to copy the referral
// link, a brief ping burst + checkmark swap for feedback, no text label so it
// never competes with the reward number for attention.
export function CopyChip({ link, className = "" }: { link: string; className?: string }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <button
      type="button"
      onClick={() => copy(link)}
      aria-label={copied ? COPY.copiedLabel : COPY.copyLabel}
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-950 transition hover:opacity-90 ${className}`}
      style={{ backgroundImage: gradient }}
    >
      {copied && (
        <span
          className="absolute inset-0 animate-ping rounded-full opacity-60"
          style={{ backgroundImage: gradient }}
        />
      )}
      {copied ? <Check size={15} /> : <Copy size={15} />}
    </button>
  );
}

// The single "refer X more, unlock Y" nudge, kept to one small muted line so
// it reads as a caption, not a second headline.
export function NextMilestoneLine({
  flow,
  className = "",
}: {
  flow: AccountFlow;
  className?: string;
}) {
  return <p className={className}>{nextStepLine(flow)}</p>;
}
