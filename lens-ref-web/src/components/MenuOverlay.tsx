import { useEffect } from "react";
import { appOpenUrl, authUrl, COPY, MENU, NAV } from "../content";
import { useAuth } from "../hooks/authContext";
import { BtnLink } from "./buttons";

// The hamburger menu, styled after frontend/'s .menu-overlay: a full-bleed dark
// panel of oversized links that wipe in on a stagger. The animation lives in
// index.css (see the .menu-overlay block); this file is structure only.
//
// It has NO header of its own. The NavBar stays on top of it (z-50 over this
// panel's z-40) carrying both the wordmark and the menu button, which doubles
// as the close control. That is what keeps the button in one place: it is one
// element in one layout, never a hamburger here and a close button there.
// The panel just pads past the bar.
//
// It stays MOUNTED and toggles .open rather than unmounting, which is what lets
// the fade run in both directions. Everything inside is inert while closed
// (visibility: hidden + pointer-events: none), and aria-hidden + inert keep it
// out of the accessibility tree and tab order so a closed menu cannot be
// tabbed into behind the page.
export default function MenuOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();

  // Lock the page behind the panel and wire Escape, both only while open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <div
      className={`menu-overlay ${open ? "open" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Site menu"
      aria-hidden={!open}
      inert={!open}
      // Backdrop click, guarded on the target being the overlay itself so a
      // click that lands on a link or the panel's own padding does not close it.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* pt clears the fixed h-12 bar above, which supplies the wordmark and
          the close control. */}
      <div className="mx-auto flex min-h-full w-[90%] max-w-[1100px] flex-col px-5 pt-28">
        <div className="flex flex-1 flex-col gap-10 sm:flex-row sm:items-start sm:gap-16">
          {MENU.columns.map((column) => (
            <div key={column.label} className="menu-column flex flex-col gap-4">
              <p className="menu-label">{column.label}</p>
              {column.links.map((link) => (
                <a key={link.href} href={link.href} className="menu-link-reveal">
                  {link.label}
                </a>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom row: the app CTA (moved out of the nav bar, so this is now the
            only place it lives) and the auth action, styled like the original's
            logout button. Signed out it carries the current path so signing in
            returns here. */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-4 pb-12 pt-10">
          <BtnLink href={appOpenUrl(user?.email)} role="primary">
            {NAV.app.label}
          </BtnLink>
          {user ? (
            <button
              type="button"
              onClick={() => {
                void logout();
                onClose();
              }}
              className="menu-auth-action"
            >
              {COPY.logout}
            </button>
          ) : (
            <a
              href={authUrl("signin", window.location.pathname)}
              className="menu-auth-action"
            >
              {COPY.accountSignIn}
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
