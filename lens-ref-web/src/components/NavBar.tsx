import { useLayoutEffect, useState } from "react";
import { NAV, ROUTES } from "../content";
import { BtnLink } from "./buttons";
import AccountMenu from "./AccountMenu";
import { useAccount } from "../hooks/accountContext";
import lensArcWhite from "../../assets/lens-arc/lens-arc-white.png";
import lensArcDark from "../../assets/lens-arc/lens-arc-dark.png";

// The persistent site nav: "Hairline", winner of the 3-variant comparison
// (Float and Ledger plus the arrow-key switcher and the lens_nav_variant
// localStorage key were deleted with the loss; git history only). A slim
// translucent bar with gradient underline sweeps, fixed on every page, always
// carrying the same controls: wordmark, Engine, Referral program, the account
// slot, and the Enter Lens Arc CTA.
//
// The bar is THEME-ADAPTIVE: a dark glass bar while a dark section sits under
// it, flipping to a light glass bar with dark text over white content, with
// every color crossfading (300 ms). Dark sections opt in by carrying a
// data-nav-dark attribute (the landing hero + discovery sections today); any
// new dark-background section must set it or the bar will read murky gray on
// top of it. The probe checks which marked section covers the bar's midline
// on every scroll/resize.

const PROBE_Y = 24;

function useNavTheme(): "dark" | "light" {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useLayoutEffect(() => {
    const probe = () => {
      let dark = false;
      document.querySelectorAll("[data-nav-dark]").forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top <= PROBE_Y && r.bottom >= PROBE_Y) dark = true;
      });
      setTheme(dark ? "dark" : "light");
    };
    probe();
    window.addEventListener("scroll", probe, { passive: true });
    window.addEventListener("resize", probe);
    return () => {
      window.removeEventListener("scroll", probe);
      window.removeEventListener("resize", probe);
    };
  }, []);

  return theme;
}

export default function NavBar() {
  const dark = useNavTheme() === "dark";
  // Reads the shared flow (never instantiates one, see accountContext) purely so
  // the app CTA can carry a verified member's email into the sign-up form.
  const flow = useAccount();

  const linkClass = `group relative py-1 transition-colors duration-300 ${
    dark ? "text-white/60 hover:text-white" : "text-slate-500 hover:text-slate-900"
  }`;
  const underline = (
    <span
      aria-hidden="true"
      className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 transition-transform duration-300 ease-out group-hover:scale-x-100"
      style={{ background: "linear-gradient(90deg, #2dd4bf, #38bdf8)" }}
    />
  );

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 border-b backdrop-blur transition-colors duration-300 ${
        dark ? "border-white/10 bg-[#0c0f16]/70" : "border-slate-900/10 bg-white/80"
      }`}
    >
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between px-6">
        <a href={ROUTES.home} aria-label="Lens Arc home" className="relative shrink-0">
          <img
            src={lensArcWhite}
            alt="Lens Arc"
            className={`h-5 w-auto select-none transition-opacity duration-300 ${
              dark ? "opacity-100" : "opacity-0"
            }`}
            draggable={false}
          />
          <img
            src={lensArcDark}
            alt=""
            aria-hidden="true"
            className={`absolute left-0 top-0 h-5 w-auto select-none transition-opacity duration-300 ${
              dark ? "opacity-0" : "opacity-100"
            }`}
            draggable={false}
          />
        </a>
        <nav className="flex items-center gap-3 text-[13px] sm:gap-6">
          <a href={NAV.engine.href} className={`hidden sm:inline ${linkClass}`}>
            {NAV.engine.label}
            {underline}
          </a>
          <a href={NAV.referral.href} className={linkClass}>
            {NAV.referral.label}
            {underline}
          </a>
          <AccountMenu light={!dark} />
          <BtnLink href={flow.appHref} role="primary" size="sm">
            {NAV.app.label}
          </BtnLink>
        </nav>
      </div>
    </header>
  );
}
