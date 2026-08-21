import { useState } from "react";
import type { FormEvent } from "react";
import { AUTH, COPY, ROUTES } from "../content";
import * as authApi from "../lib/authApi";
import { AuthError, AuthField, AuthNotice, AuthShell } from "../components/AuthShell";
import { Btn } from "../components/buttons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Step 1 of signed-out password recovery: ask for the address, POST
// /forgot-password, and tell the user to check their mail.
//
// The backend returns the SAME 200 envelope whether or not the address is
// registered, so this page must too. Reporting "no account with that email"
// would turn the form into an account-enumeration oracle, which is exactly what
// that endpoint is written to avoid. The success copy is therefore conditional
// ("if that email is registered") rather than a confirmation.
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || sent) return;

    if (!EMAIL_RE.test(email.trim())) {
      setError(AUTH.forgotInvalid);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (err) {
      // Only a transport or server failure lands here; an unknown address still
      // resolves successfully by design.
      setError(err instanceof Error ? err.message : "Could not send the reset link.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h1 className="mt-10 text-lg font-semibold tracking-tight">{AUTH.forgotTitle}</h1>
      <p className="mt-1 text-sm leading-relaxed text-white/45">{AUTH.forgotSub}</p>

      {sent ? (
        <div className="mt-8 space-y-5">
          <AuthNotice message={AUTH.forgotSent} />
          <p className="text-center text-sm text-white/40">
            <a
              href={ROUTES.login}
              className="font-medium text-teal-300 underline-offset-4 transition-colors duration-200 hover:underline"
            >
              {AUTH.backToSignIn}
            </a>
          </p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-8 space-y-5">
          <AuthField
            label={AUTH.emailLabel}
            type="email"
            value={email}
            onChange={(v) => {
              setEmail(v);
              if (error) setError(null);
            }}
            placeholder={COPY.emailPlaceholder}
            autoComplete="email"
            autoFocus
          />

          {error && <AuthError message={error} />}

          <Btn type="submit" role="primary" disabled={busy} className="w-full">
            {busy ? AUTH.forgotSending : AUTH.forgotCta}
          </Btn>

          <p className="text-center text-sm text-white/40">
            <a
              href={ROUTES.login}
              className="font-medium text-teal-300 underline-offset-4 transition-colors duration-200 hover:underline"
            >
              {AUTH.backToSignIn}
            </a>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
