import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, User } from "lucide-react";
import { appOpenUrl, AUTH, authUrl, COPY, ROUTES } from "../content";
import { useAuth } from "../hooks/authContext";

// The nav's account slot, backed by the REAL account system (Fastify `users`,
// the same accounts lens-app uses). Signed out it is a plain link to /login;
// signed in it opens a popover with the account, a link into the app, and Log
// out.
//
// It used to hold a magic-link email form that signed in against the referral
// `waitlist` table. That login is gone: a waitlist row is a mailing-list entry,
// not an account, and a real account needs a username/email/password, which is
// more than a popover can carry. The form moved to the /login page and the
// backing store moved to `users`.
//
// `light` matches the NavBar's adaptive theme (dark trigger text over light
// backgrounds); the popover itself stays dark glass on both.
export default function AccountMenu({ light = false }: { light?: boolean }) {
  const { user, loading, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const triggerClass = `flex h-9 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors duration-300 ${
    light ? "text-slate-500 hover:text-slate-900" : "text-white/60 hover:text-white"
  }`;

  // Hold the slot while the session check settles, so the nav does not flash
  // "Sign in" at someone who is already signed in.
  if (loading) {
    return <span className={triggerClass} aria-hidden="true" />;
  }

  if (!user) {
    // Carries the current path so signing in returns the visitor to the page
    // they were reading, not to the home page.
    return (
      <a href={authUrl("signin", window.location.pathname)} className={triggerClass}>
        <User size={15} />
        {COPY.accountSignIn}
      </a>
    );
  }

  const initial = user.username.charAt(0).toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Account: ${user.username}`}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-sky-400 text-sm font-semibold text-[#111318] transition-colors duration-300"
      >
        {initial}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={COPY.accountTitle}
          className="absolute right-0 top-11 z-50 w-72 rounded-[15px] border border-white/10 bg-[#14171f]/95 p-5 text-left shadow-2xl backdrop-blur-md"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-sky-400 text-sm font-semibold text-[#111318]">
              {initial}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{user.username}</p>
              <p className="truncate text-xs text-white/45">{user.email}</p>
            </div>
          </div>

          <p className="mt-3.5 text-xs text-white/45">{AUTH.planLine(user.plan)}</p>

          <div className="mt-4 space-y-1 text-sm">
            <a
              href={appOpenUrl(user.email)}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-white/75 transition-colors duration-200 hover:bg-white/5 hover:text-white"
            >
              {COPY.openApp}
              <ArrowUpRight size={14} />
            </a>
            <a
              href={ROUTES.referral}
              className="flex items-center justify-between rounded-lg px-2.5 py-2 text-white/75 transition-colors duration-200 hover:bg-white/5 hover:text-white"
            >
              {COPY.accountViewStatus}
              <ArrowUpRight size={14} />
            </a>
          </div>

          <button
            type="button"
            onClick={() => {
              void logout();
              setOpen(false);
            }}
            className="btn-danger mt-4 w-full rounded-[15px] px-4 py-2 text-sm font-medium"
          >
            {COPY.logout}
          </button>
        </div>
      )}
    </div>
  );
}
