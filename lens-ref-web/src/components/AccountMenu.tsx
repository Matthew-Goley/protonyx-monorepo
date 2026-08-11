import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, Check, Mail, User } from "lucide-react";
import { APP_URL, COPY, ROUTES } from "../content";
import { useAccount } from "../hooks/accountContext";

// The nav's account slot. Signed out it offers the magic-link sign-in
// (email -> /join -> check-your-email) right in the popover, so an account
// can be entered from any page, including the landing page; signed in it
// shows the verified email, the earned Pro time, and the redemption note.
// State comes from the shared AccountProvider, so the same account shows on
// every page of the site. `light` matches the NavBar's adaptive theme (dark
// trigger text over light backgrounds); the popover itself stays dark glass
// on both.
export default function AccountMenu({ light = false }: { light?: boolean }) {
  const flow = useAccount();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
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

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    setSending(true);
    try {
      await flow.submitEmail();
    } finally {
      setSending(false);
    }
  };

  const signedIn = flow.step === "account";
  const initial = signedIn && flow.email ? flow.email[0].toUpperCase() : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={signedIn ? `Account: ${flow.email}` : COPY.accountSignIn}
        className={`flex h-9 items-center justify-center rounded-full text-sm font-medium transition-colors duration-300 ${
          signedIn
            ? "w-9 bg-gradient-to-br from-teal-400 to-sky-400 text-[#111318]"
            : `gap-1.5 px-3.5 ${
                light
                  ? "text-slate-500 hover:text-slate-900"
                  : "text-white/60 hover:text-white"
              }`
        }`}
      >
        {signedIn ? (
          <span className="font-semibold">{initial}</span>
        ) : (
          <>
            <User size={15} />
            {COPY.accountSignIn}
          </>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={COPY.accountTitle}
          className="absolute right-0 top-11 z-50 w-80 rounded-[15px] border border-white/10 bg-[#14171f]/95 p-5 text-left shadow-2xl backdrop-blur-md"
        >
          {signedIn ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-400 to-sky-400 text-sm font-semibold text-[#111318]">
                  {initial}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{flow.email}</p>
                  <p className="text-xs text-white/45">
                    {COPY.accountReferralsLine(flow.referralCount)}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-teal-400/25 bg-teal-400/10 p-3.5">
                <p className="flex items-center gap-2 text-sm font-semibold text-teal-300">
                  <Check size={15} className="shrink-0" />
                  {flow.currentReward === "Lifetime free"
                    ? COPY.rewardSummaryLifetime
                    : COPY.rewardSummary(
                        flow.currentReward.replace(/ free$/i, "").toLowerCase()
                      )}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-white/55">
                  {COPY.redeemNote}
                </p>
              </div>

              <div className="space-y-1 text-sm">
                <a
                  href={APP_URL}
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
                  flow.logout();
                  setOpen(false);
                }}
                className="btn-danger w-full rounded-[15px] px-4 py-2 text-sm font-medium"
              >
                {COPY.logout}
              </button>
            </div>
          ) : flow.step === "verifying" ? (
            <div className="space-y-3 text-center">
              <Mail size={22} className="mx-auto text-teal-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-white">{COPY.magicHeading}</p>
              <p className="break-words text-xs leading-relaxed text-white/55">
                {COPY.magicInstruction(flow.email)}
              </p>
              <div className="flex justify-center gap-5 text-xs">
                <button
                  type="button"
                  onClick={() => void flow.resendEmail()}
                  className="text-white/55 transition-colors duration-200 hover:text-white"
                >
                  {COPY.magicResend}
                </button>
                <button
                  type="button"
                  onClick={flow.dismissVerify}
                  className="text-white/40 transition-colors duration-200 hover:text-white/70"
                >
                  {COPY.changeEmail}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} noValidate className="space-y-3">
              <p className="text-sm font-semibold text-white">{COPY.accountTitle}</p>
              <p className="text-xs leading-relaxed text-white/55">
                {COPY.accountSignInHint}
              </p>
              <input
                type="email"
                value={flow.email}
                onChange={(e) => flow.setEmail(e.target.value)}
                placeholder={COPY.emailPlaceholder}
                aria-label="email address"
                className="w-full rounded-[15px] border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 transition-colors duration-200 focus:border-teal-400/60 focus:outline-none"
              />
              {flow.emailError && (
                <p className="text-xs text-rose-400">{flow.emailError}</p>
              )}
              <button
                type="submit"
                disabled={sending}
                className="btn-primary w-full rounded-[15px] px-4 py-2.5 text-sm font-medium disabled:pointer-events-none disabled:opacity-50"
              >
                {COPY.accountSendLink}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
