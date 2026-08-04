import Layout4 from "./layouts/Layout4";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import { LEGAL_PAGES } from "./content";

// Plain path-based routing, no router library: these are reached by a real
// navigation (footer <a> tags, full page load), not a client-side transition,
// so there's no path-change state to keep in sync. vercel.json rewrites every
// path to index.html, so this resolves correctly on a fresh load too.
export default function App() {
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  if (path === LEGAL_PAGES.terms.path) return <TermsPage />;
  if (path === LEGAL_PAGES.privacy.path) return <PrivacyPage />;
  return <Layout4 />;
}
