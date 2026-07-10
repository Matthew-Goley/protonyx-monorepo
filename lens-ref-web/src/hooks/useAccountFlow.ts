import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { BRAND, COPY, REFERRAL_MILESTONES } from "../content";

export type Step = "signup" | "verifying" | "account";

// Tiny external store for the demo referral count so the dev control in
// App.tsx can drive whichever layout is currently mounted.
let demoReferralCount = 0;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function setDemoReferralCount(n: number) {
  demoReferralCount = n;
  listeners.forEach((cb) => cb());
}

export function useDemoReferralCount() {
  return useSyncExternalStore(subscribe, () => demoReferralCount);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// FNV-1a hash of the email, base36. Only needs to look plausible.
function codeFromEmail(email: string): string {
  let h = 2166136261;
  for (let i = 0; i < email.length; i++) {
    h ^= email.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).padStart(6, "0").slice(0, 6);
}

const MAX_REFERRALS =
  REFERRAL_MILESTONES[REFERRAL_MILESTONES.length - 1].referrals;

export function useAccountFlow() {
  const [step, setStep] = useState<Step>("signup");
  const [email, setEmailState] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const referralCount = useDemoReferralCount();

  const setEmail = (value: string) => {
    setEmailState(value);
    if (emailError) setEmailError(null);
  };

  // Returns whether it actually opened the verifying step, so a second entry
  // point (the footer's email box) can react only on real success, e.g. to
  // scroll back up to it, without re-running the validation itself.
  const submitEmail = () => {
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError(COPY.emailInvalid);
      return false;
    }
    setEmailError(null);
    setStep("verifying");
    return true;
  };

  const dismissVerify = () => setStep("signup");
  const completeVerify = () => setStep("account");
  // Just resets to a fresh signup state, there's no real session to end.
  const logout = () => {
    setStep("signup");
    setEmailState("");
    setEmailError(null);
  };

  let currentReward = REFERRAL_MILESTONES[0].reward;
  for (const m of REFERRAL_MILESTONES) {
    if (referralCount >= m.referrals) currentReward = m.reward;
  }
  const next = REFERRAL_MILESTONES.find((m) => m.referrals > referralCount) ?? null;
  const nextMilestone = next
    ? { remaining: next.referrals - referralCount, reward: next.reward }
    : null;

  const referralCode = useMemo(
    () => codeFromEmail(email.trim().toLowerCase() || BRAND.wordmark),
    [email]
  );

  return {
    step,
    email,
    setEmail,
    emailError,
    submitEmail,
    dismissVerify,
    completeVerify,
    logout,
    referralCount,
    progress: Math.min(referralCount / MAX_REFERRALS, 1),
    maxed: nextMilestone === null,
    currentReward,
    nextMilestone,
    referralCode,
    referralLink: COPY.referralLinkBase + referralCode,
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
