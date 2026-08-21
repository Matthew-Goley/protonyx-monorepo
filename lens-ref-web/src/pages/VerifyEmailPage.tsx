import { useEffect, useRef, useState } from "react";
import { ACCOUNT, ROUTES } from "../content";
import * as authApi from "../lib/authApi";
import SimplePage from "../components/SimplePage";
import { BtnLink } from "../components/buttons";

// Landing page for the link in the verification email. It consumes the
// single-use token by calling GET /verify-email?token=, then says what happened.
//
// It is deliberately UNAUTHENTICATED: the link is opened from an inbox, which
// may be a different browser (or a phone) with no session. The token alone is
// the proof, which is why the backend route takes no auth either.
//
// Before this page existed the emailed link resolved to lens-arc.com and hit
// the SPA catch-all, so it rendered the landing page and dropped the token in
// silence: verification could never complete. ROUTES.verifyEmail and the URL
// built in backend/src/email.ts are a contract; change one and it breaks that
// way again, with no error anywhere.

type State =
  | { kind: "checking" }
  | { kind: "missing" }
  | { kind: "ok" }
  | { kind: "failed"; message: string };

export default function VerifyEmailPage() {
  const [state, setState] = useState<State>({ kind: "checking" });

  // The token is single-use, so it must be spent exactly once. StrictMode
  // double-invokes effects in dev, and without this guard the second call would
  // consume nothing and report failure over a success that already happened.
  const spent = useRef(false);

  useEffect(() => {
    if (spent.current) return;
    spent.current = true;

    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) {
      setState({ kind: "missing" });
      return;
    }

    authApi
      .verifyEmail(token)
      .then(() => setState({ kind: "ok" }))
      .catch((err: unknown) =>
        setState({
          kind: "failed",
          message: err instanceof Error ? err.message : ACCOUNT.verifyPageFailedBody,
        })
      );
  }, []);

  const body = () => {
    switch (state.kind) {
      case "checking":
        return <p className="text-slate-600">{ACCOUNT.verifyPageChecking}</p>;
      case "missing":
        return <p className="text-[#b3463f]">{ACCOUNT.verifyPageMissing}</p>;
      case "ok":
        return (
          <>
            <p className="text-base font-semibold text-[#2f7d5b]">
              {ACCOUNT.verifyPageSuccess}
            </p>
            <p className="mt-2 text-slate-600">{ACCOUNT.verifyPageSuccessBody}</p>
          </>
        );
      case "failed":
        return (
          <>
            <p className="text-base font-semibold text-[#b3463f]">
              {ACCOUNT.verifyPageFailed}
            </p>
            <p className="mt-2 text-slate-600">{ACCOUNT.verifyPageFailedBody}</p>
            <p className="mt-1 text-sm text-slate-500">{state.message}</p>
          </>
        );
    }
  };

  return (
    <SimplePage title={ACCOUNT.verifyPageTitle}>
      {body()}
      <div className="pt-4">
        <BtnLink role="secondary" href={ROUTES.account}>
          {ACCOUNT.backToAccount}
        </BtnLink>
      </div>
    </SimplePage>
  );
}
