import { useLayoutEffect, useState } from "react";
import { MENU, ROUTES } from "../content";
import AccountMenu from "./AccountMenu";
import MenuOverlay from "./MenuOverlay";
import lensArcWhite from "../../assets/lens-arc/lens-arc-white.png";
import lensArcDark from "../../assets/lens-arc/lens-arc-dark.png";

// The persistent site nav: "Hairline", winner of the 3-variant comparison
// (Float and Ledger plus the arrow-key switcher and the lens_nav_variant
// localStorage key were all deleted with the loss; git history only). A slim
// translucent bar, fixed on every page except the auth route (see App.tsx).
//
// It carries exactly TWO controls: the account slot and the hamburger. Every
// link, including the "Enter Lens Arc" CTA, lives in the menu overlay instead.
// Do not promote a link back into the bar; add it to MENU in content.ts.
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

// Two bars, not three, crossing into an X while the panel is open. Square white
// tile with dark bars over dark sections, inverting over light ones, same as
// frontend/'s .navbar-menu-button and its .navbar--light override.
//
// This is a TOGGLE, not an open button: the same element closes the menu, so
// there is no separate close control anywhere and nothing can drift between the
// two states. Geometry and the X transform live in index.css (.menu-button);
// only the theme colors are here.
function MenuButton({
  dark,
  open,
  onClick,
}: {
  dark: boolean;
  open: boolean;
  onClick: () => void;
}) {
  const bar = `menu-bar ${dark ? "bg-black" : "bg-white"}`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? MENU.closeLabel : MENU.openLabel}
      aria-expanded={open}
      className={`menu-button ${open ? "open" : ""} ${
        dark ? "bg-white hover:bg-white/85" : "bg-[#111318] hover:bg-[#111318]/85"
      }`}
    >
      <span aria-hidden="true" className={bar} />
      <span aria-hidden="true" className={bar} />
    </button>
  );
}

export default function NavBar() {
  const sectionDark = useNavTheme() === "dark";
  const [menuOpen, setMenuOpen] = useState(false);

  // While the panel is open the bar sits on top of its #0c0f16 fill, so it has
  // to read dark whatever section happens to be underneath it.
  const dark = sectionDark || menuOpen;

  return (
    <>
      {/* The bar stays visible and on TOP of the open panel (z-50 over the
          overlay's z-40), losing only its own fill and border so it reads as
          part of the panel. That is deliberate: keeping the same bar mounted in
          the same layout is what holds the menu button in one place across
          open/close. Fading the bar out and giving the panel its own close
          button, as frontend/ did, is exactly what let the control move. */}
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,backdrop-filter] duration-300 ${
          menuOpen
            ? "border-transparent bg-transparent"
            : `backdrop-blur ${
                dark
                  ? "border-white/10 bg-[#0c0f16]/70"
                  : "border-slate-900/10 bg-white/80"
              }`
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

          {/* Both controls are 36px tall, so they sit on one baseline. */}
          <nav className="flex items-center gap-2 sm:gap-3">
            <AccountMenu light={!dark} />
            <MenuButton
              dark={dark}
              open={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            />
          </nav>
        </div>
      </header>

      <MenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
    </>
  );
}
