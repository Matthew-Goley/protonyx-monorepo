import { LineChart } from "lucide-react";
import SimplePage from "../components/SimplePage";
import { BtnLink } from "../components/buttons";
import { appOpenUrl, NAV, ROUTES } from "../content";
import { useAuth } from "../hooks/authContext";
import engineMp4 from "../../assets/video/lens-engine.mp4";
import engineWebm from "../../assets/video/lens-engine.webm";
import enginePoster from "../../assets/video/lens-engine-poster.jpg";

// The /lens-arc page: what the Lens engine does, told by the 40s explainer
// video rather than a wall of text. The video is built in ../video (Remotion)
// from real engine output on a sample portfolio, and its renders are copied
// here by `npm run ship` in that project; do not hand-edit these files. The
// video is silent by design (every key line is on screen), so it autoplays
// muted. Keep the disclaimer paragraph: this page shows specific engine
// actions, and the "not advice" framing must sit next to them.

export default function EnginePage() {
  // Only for the app CTA's href, see LandingPage.
  const { user } = useAuth();
  return (
    <SimplePage
      title="The Lens engine"
      subtitle="Eight checks, one caution score, and a ranked list of actions, shown on a sample portfolio."
      wide
    >
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-[#0a0b0e] shadow-sm">
        <video
          className="block aspect-video w-full"
          poster={enginePoster}
          autoPlay
          muted
          loop
          playsInline
          controls
          preload="metadata"
          aria-label="How the Lens engine reads a sample portfolio: its holdings, eight checks with severity ratings, a caution score, a plain-language brief, and ranked actions."
        >
          {/* MP4 first: H.264 plays everywhere. Safari can claim WebM support
              and then fail to decode VP9, and a decode failure does not fall
              through to the next source, so WebM-first left a dead player. */}
          <source src={engineMp4} type="video/mp4" />
          <source src={engineWebm} type="video/webm" />
        </video>
      </div>
      <p className="text-xs text-slate-400">
        Sample portfolio. Figures shown are real Lens engine output.
      </p>

      <p className="max-w-3xl text-[15px] leading-relaxed text-slate-600">
        Lens Arc is an educational and diagnostic tool. It does not give investment, financial,
        tax, or legal advice, and nothing it produces is a recommendation to buy, sell, or hold
        any security. It shows you what a careful, consistent reading of your portfolio
        surfaces, and leaves the decision where it belongs: with you.
      </p>

      <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-8">
        <BtnLink href={appOpenUrl(user?.email)} role="primary">
          <LineChart size={16} aria-hidden="true" />
          Run it on your portfolio
        </BtnLink>
        <a
          href={ROUTES.referral}
          className="text-sm font-medium text-slate-500 underline-offset-4 transition hover:text-slate-900 hover:underline"
        >
          {NAV.referral.label}
        </a>
      </div>
    </SimplePage>
  );
}
