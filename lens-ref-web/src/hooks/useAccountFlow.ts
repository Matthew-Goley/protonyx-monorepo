import { useEffect, useRef, useState } from "react";
import {
  appOpenUrl,
  BRAND,
  COPY,
  earnedMonths,
  monthsLabel,
  REFERRAL_BASE_MONTHS,
  REFERRAL_MAX_MONTHS,
  ROUTES,
} from "../content";
import * as api from "../lib/api";

export type Step = "signup" | "verifying" | "account";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// localStorage keys. Persisting the server-issued referral code (not the raw
// holdings, there are none here) is what lets a verified visitor stay verified
// across refreshes: on load we restore the account view and re-fetch the live
// count via GET /status.
const LS_CODE = "lens_ref_code";
const LS_EMAIL = "lens_ref_email";

// Referrals needed to reach the 12-month cap: one month is the verification
// base, so every remaining month is one referral.
const MAX_REFERRALS = REFERRAL_MAX_MONTHS - REFERRAL_BASE_MONTHS;

// Pull a referral code out of the current URL: the canonical
// /referral/ref/<code> share-link path, either legacy form (/ref/<code>,
// /r/<code>, both already shared publicly and normally rewritten to the
// canonical path by App.tsx before this runs), or a ?ref=<code> query param.
// Returns null if none is present.
function referralCodeFromUrl(): string | null {
  const path = window.location.pathname.match(
    /^\/(?:referral\/ref|ref|r)\/([a-z0-9]{1,16})/i
  );
  if (path) return path[1].toLowerCase();
  const q = new URLSearchParams(window.location.search).get("ref");
  return q ? q.trim().toLowerCase() : null;
}

export function useAccountFlow() {
  const [step, setStep] = useState<Step>("signup");
  const [email, setEmailState] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState("");
  const [referralCount, setReferralCount] = useState(0);

  // The code this visitor arrived under (from a /r/<code> link), sent to /join.
  const pendingReferral = useRef<string | null>(null);

  const setEmail = (value: string) => {
    setEmailState(value);
    if (emailError) setEmailError(null);
  };

  const enterAccount = (code: string, verifiedEmail: string, count: number) => {
    setReferralCode(code);
    setReferralCount(count);
    setEmailState(verifiedEmail);
    setStep("account");
    try {
      localStorage.setItem(LS_CODE, code);
      localStorage.setItem(LS_EMAIL, verifiedEmail);
    } catch {
      // storage unavailable (private mode): session-only, still works this load
    }
  };

  // On mount: consume a magic-link token, or capture an inbound referral code,
  // or restore a previously verified session.
  useEffect(() => {
    let cancelled = false;
    const token = new URLSearchParams(window.location.search).get("token");
    const onVerifyRoute = window.location.pathname.replace(/\/$/, "") === "/verify";

    if (token && onVerifyRoute) {
      api
        .verify(token)
        .then((res) => {
          if (cancelled) return;
          enterAccount(res.referral_code, res.email, res.entitlement.referral_count);
        })
        .catch(() => {
          // Invalid/expired link: drop the user on a clean signup page.
        })
        .finally(() => {
          window.history.replaceState(null, "", ROUTES.referral);
        });
      return () => {
        cancelled = true;
      };
    }

    const inbound = referralCodeFromUrl();
    if (inbound) {
      pendingReferral.current = inbound;
      window.history.replaceState(null, "", ROUTES.referral);
    }

    let storedCode: string | null = null;
    let storedEmail: string | null = null;
    try {
      storedCode = localStorage.getItem(LS_CODE);
      storedEmail = localStorage.getItem(LS_EMAIL);
    } catch {
      storedCode = null;
    }
    if (storedCode) {
      setReferralCode(storedCode);
      if (storedEmail) setEmailState(storedEmail);
      setStep("account");
      api
        .status(storedCode)
        .then((res) => {
          if (!cancelled) setReferralCount(res.referral_count);
        })
        .catch(() => {
          // Stale/unknown code (e.g. DB reset): clear it and fall back to signup.
          if (cancelled) return;
          try {
            localStorage.removeItem(LS_CODE);
            localStorage.removeItem(LS_EMAIL);
          } catch {
            /* ignore */
          }
          setStep("signup");
          setReferralCode("");
        });
    }

    return () => {
      cancelled = true;
    };
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sends the magic-link email. Returns whether it opened the verifying step, so
  // the footer email box can react only on real success (e.g. scroll to top).
  const submitEmail = async (): Promise<boolean> => {
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError(COPY.emailInvalid);
      return false;
    }
    setEmailError(null);
    try {
      await api.join(email.trim(), pendingReferral.current);
      setStep("verifying");
      return true;
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : COPY.emailInvalid);
      return false;
    }
  };

  // Re-request the magic link for the same email (the "Resend link" button).
  const resendEmail = async (): Promise<boolean> => {
    try {
      await api.join(email.trim(), pendingReferral.current);
      return true;
    } catch {
      return false;
    }
  };

  const dismissVerify = () => setStep("signup");

  // DEV-only preview: jump straight to the account view without a real token, so
  // the readout can be eyeballed without a running backend. The code is a
  // placeholder and does not resolve server-side. In production the account view
  // is only ever reached by clicking the emailed link (the /verify route above).
  const devSimulateVerify = () => {
    setReferralCode("preview");
    setReferralCount(0);
    setStep("account");
  };

  const logout = () => {
    try {
      localStorage.removeItem(LS_CODE);
      localStorage.removeItem(LS_EMAIL);
    } catch {
      /* ignore */
    }
    setStep("signup");
    setEmailState("");
    setEmailError(null);
    setReferralCode("");
    setReferralCount(0);
  };

  // The number the backend will actually grant at signup. Derived from the same
  // linear formula as backend/src/waitlist.ts, NOT looked up in a milestone
  // table: a table lookup rounds an in-between count down to the nearest tier,
  // which is what made this site show 2 months for an account granted 3.
  const months = earnedMonths(referralCount);
  const currentReward = monthsLabel(months);
  const maxed = months >= REFERRAL_MAX_MONTHS;

  // Linear formula, so the next step is always exactly one more referral for one
  // more month, right up to the cap.
  const nextMilestone = maxed
    ? null
    : { remaining: 1, reward: monthsLabel(months + 1) };

  return {
    step,
    email,
    setEmail,
    emailError,
    submitEmail,
    resendEmail,
    dismissVerify,
    devSimulateVerify,
    logout,
    referralCount,
    progress: Math.min(referralCount / MAX_REFERRALS, 1),
    maxed,
    /** Months the backend will grant. The single number every surface must show. */
    earnedMonths: months,
    currentReward,
    nextMilestone,
    referralCode,
    referralLink: COPY.referralLinkBase + referralCode,
    /** Href for generic "open the app" CTAs: carries the verified email so the
     *  sign-up form is prefilled, without forcing the sign-up tab. Falls back to
     *  the bare app URL when there is no verified email to carry. */
    appHref: appOpenUrl(step === "account" ? email : null),
  };
}

export type AccountFlow = ReturnType<typeof useAccountFlow>;

// One-line helper for the next-step sentence so every layout words it identically.
export function nextStepLine(flow: AccountFlow): string {
  return flow.nextMilestone
    ? COPY.nextStep(
        flow.nextMilestone.remaining,
        flow.nextMilestone.reward,
        flow.referralCount > 0
      )
    : COPY.maxedLine;
}

export function useCopyToClipboard(timeoutMs = 1800) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), timeoutMs);
  };

  return { copied, copy };
}

export function useShare() {
  const canShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  const share = async (url: string) => {
    try {
      await navigator.share({ title: BRAND.wordmark, url });
    } catch {
      // user dismissed the share sheet, nothing to do
    }
  };
  return { canShare, share };
}
