import { BRAND, REFERRAL_MILESTONES } from "./content";
import { setDemoReferralCount, useDemoReferralCount } from "./hooks/useAccountFlow";
import Layout4 from "./layouts/Layout4";

// Dev-only helper: steps the demo referral count through the milestone
// breakpoints so the account dial and next-step message can be previewed.
function DemoReferralControl() {
  const count = useDemoReferralCount();
  return (
    <div className="fixed bottom-4 right-3 z-50 flex items-center gap-1 rounded-full border border-white/10 bg-slate-950/85 px-2 py-1 text-[10px] text-slate-400 shadow-lg shadow-black/30 backdrop-blur">
      <span className="pl-1 pr-0.5">referrals</span>
      {REFERRAL_MILESTONES.map((m) => (
        <button
          key={m.referrals}
          type="button"
          onClick={() => setDemoReferralCount(m.referrals)}
          className={`h-6 w-6 rounded-full tabular-nums transition ${
            count === m.referrals
              ? "font-semibold text-slate-950"
              : "text-slate-300 hover:bg-white/10"
          }`}
          style={
            count === m.referrals
              ? {
                  backgroundImage: `linear-gradient(135deg, ${BRAND.gradientFrom}, ${BRAND.gradientTo})`,
                }
              : undefined
          }
        >
          {m.referrals}
        </button>
      ))}
    </div>
  );
}

export default function App() {
  return (
    <>
      <Layout4 />
      {import.meta.env.DEV && <DemoReferralControl />}
    </>
  );
}
