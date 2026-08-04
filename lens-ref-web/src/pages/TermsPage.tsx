import LegalPage from "./LegalPage";
import { LEGAL_PAGES } from "../content";

export default function TermsPage() {
  return <LegalPage title={LEGAL_PAGES.terms.title} />;
}
