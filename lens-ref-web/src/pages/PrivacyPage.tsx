import LegalPage from "./LegalPage";
import { LEGAL_PAGES } from "../content";

export default function PrivacyPage() {
  return <LegalPage title={LEGAL_PAGES.privacy.title} />;
}
