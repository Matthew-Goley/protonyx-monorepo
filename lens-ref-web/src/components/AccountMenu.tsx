import { User } from "lucide-react";
import { authUrl, COPY, ROUTES } from "../content";
import { useAuth } from "../hooks/authContext";

// The nav account slot, backed by the REAL account system (Fastify `users`, the
// same accounts lens-app uses). Signed out it links to /login; signed in the
// avatar links to /account, the full profile page.
//
// It used to open a popover holding a magic-link email form against the
// referral `waitlist` table, then a read-only account summary. Both are gone:
// the waitlist is a mailing list rather than an account store, and everything
// the summary showed (plus verification, password change and deletion) now
// lives on /account, where there is room for it. A popover duplicating a page
// is a second thing to keep in sync for no gain.
//
// `light` matches the NavBar adaptive theme (dark trigger text over light
// backgrounds).
export default function AccountMenu({ light = false }: { light?: boolean }) {
  const { user } = useAuth();

  const triggerClass = `flex h-9 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors duration-300 ${
    light ? "text-slate-500 hover:text-slate-900" : "text-white/60 hover:text-white"
  }`;

  // Render "Sign in" immediately while the session check is still in flight,
  // rather than holding an empty slot. The slot used to stay blank until GET
  // /me resolved, which meant the nav looked broken for as long as that call
  // took, and indefinitely whenever the API was slow or unreachable.
  //
  // Nothing is lost by guessing "signed out" here: a returning signed-in
  // visitor is painted from the sessionStorage cache (see authContext), so for
  // them `user` is already set on the very first render and this branch never
  // runs. The only case that can briefly show the wrong control is a first-ever
  // page load in a new tab with a live cookie, which corrects itself the moment
  // /me lands.
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

  return (
    <a
      href={ROUTES.account}
      aria-label={`${COPY.accountTitle}: ${user.username}`}
      title={user.username}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-sky-400 text-sm font-semibold text-[#111318] transition-opacity duration-200 hover:opacity-85"
    >
      {user.username.charAt(0).toUpperCase()}
    </a>
  );
}
