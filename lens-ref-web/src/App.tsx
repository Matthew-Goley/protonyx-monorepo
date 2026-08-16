import LandingPage from "./landing/LandingPage";
import ReferralPage from "./layouts/Layout4";
import EnginePage from "./pages/EnginePage";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import LoginPage from "./pages/LoginPage";
import NavBar from "./components/NavBar";
import { AccountProvider } from "./hooks/accountContext";
import { AuthProvider } from "./hooks/authContext";
import {
  LEGACY_LEGAL_PATHS,
  LEGAL_PAGES,
  REFERRAL_REF_BASE,
  ROUTES,
} from "./content";

// Plain path-based routing, no router library: pages are reached by a real
// navigation (nav/footer <a> tags, full page load), not client-side
// transitions, so there's no path-change state to keep in sync. vercel.json
// rewrites every path to index.html, so all of these resolve on a fresh load.

// Legacy paths that must keep working (shared publicly before the
// restructure). Returns the canonical path to rewrite to, or null.
function legacyRedirect(path: string): string | null {
  // Old share-link forms: /ref/<code> and /r/<code>. The code segment is
  // preserved onto the canonical /referral/ref/<code> route.
  const share = path.match(/^\/(?:ref|r)\/([A-Za-z0-9]{1,16})$/);
  if (share) return REFERRAL_REF_BASE + share[1];
  // Old top-level legal paths: /terms, /privacy.
  if (path in LEGACY_LEGAL_PATHS) {
    return LEGACY_LEGAL_PATHS[path as keyof typeof LEGACY_LEGAL_PATHS];
  }
  return null;
}

function routePage(path: string) {
  if (path === ROUTES.engine) return <EnginePage />;
  if (path === LEGAL_PAGES.terms.path) return <TermsPage />;
  if (path === LEGAL_PAGES.privacy.path) return <PrivacyPage />;

  // One page, two entry paths: /signup just opens on the Create account tab.
  if (path === ROUTES.login || path === ROUTES.signup) return <LoginPage />;

  // The referral page owns the whole waitlist flow: the /referral landing, the
  // /referral/ref/<code> share links, and the /verify?token=... magic-link
  // return path (all consumed by the shared account flow on mount). This is
  // redemption state for the pre-launch program, NOT the site's login, which
  // lives on /login above.
  if (
    path === ROUTES.referral ||
    path.startsWith(REFERRAL_REF_BASE) ||
    path === ROUTES.verify
  ) {
    return <ReferralPage />;
  }

  return <LandingPage />;
}

export default function App() {
  const rawPath = window.location.pathname.replace(/\/$/, "") || "/";

  // Rewrite legacy URLs in place (before any page mounts, so the account
  // flow's on-mount referral-code capture sees the canonical path).
  // replaceState is idempotent, safe under StrictMode's double render.
  const redirected = legacyRedirect(rawPath);
  if (redirected) {
    window.history.replaceState(null, "", redirected + window.location.search);
  }
  const path = redirected ?? rawPath;

  // AuthProvider holds the real account session (Fastify `users`, shared with
  // lens-app) and wraps everything, because the NavBar's account slot reads it
  // on every page. AccountProvider mounts the ONE shared referral-flow instance
  // (see hooks/accountContext.tsx), which now serves only the /referral page.
  // NavBar is the persistent site nav, rendered above the routed content.
  return (
    <AuthProvider>
      <AccountProvider>
        <NavBar />
        {routePage(path)}
      </AccountProvider>
    </AuthProvider>
  );
}
