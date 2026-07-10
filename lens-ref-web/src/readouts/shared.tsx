import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
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

// Pulls the leading number out of a reward string ("2 months free" -> 2),
// NaN for the non-numeric top tier ("Lifetime free").
export function monthsFromReward(reward: string): number {
  const match = reward.match(/\d+/);
  return match ? parseInt(match[0], 10) : NaN;
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
