import { useState } from "react";
import type { FormEvent } from "react";
import { ACCOUNT, AUTH, ROUTES } from "../content";
import * as authApi from "../lib/authApi";
import { AuthError, AuthField, AuthNotice, AuthShell } from "../components/AuthShell";
import { Btn } from "../components/buttons";

// Step 2 of signed-out password recovery: the landing for the emailed link.
// Reads ?token= and spends it via POST /reset-password.
//
// Unauthenticated on purpose. The link is opened from an inbox, possibly in
// another browser or on a phone, so there is no session to rely on; holding the
// token IS the proof, and the backend enforces the one-hour window in SQL
// (reset_token_expires_at > NOW()) rather than trusting any client clock.
//
// The path is a contract with backend/src/email.ts, which builds the URL as
// ${SITE_URL}/reset-password?token=. Any other path falls through the SPA
// catch-all onto the landing page, which renders fine and silently drops the
// token, so recovery fails with no error shown anywhere.
export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || !token) return;

    if (!password || !confirm) {
      setError(ACCOUNT.passwordMissing);
      return;
    }
    if (password.length < 8) {
      setError(AUTH.passwordTooShort);
      return;
    }
    if (password !== confirm) {
      setError(ACCOUNT.passwordMismatch);
      return;
    }

    setError(null);
    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      // The backend answers 400 for an invalid AND an expired token, since both
      // fail the same lookup. Surface its message, which says as much.
      setError(err instanceof Error ? err.message : AUTH.resetExpired);
      setBusy(false);
    }
  };

  // No token at all: nothing to spend, so never POST. Send them back to request
  // a fresh link rather than showing a form that cannot succeed.
  if (!token) {
    return (
      <AuthShell>
        <h1 className="mt-10 text-lg font-semibold tracking-tight">{AUTH.resetTitle}</h1>
        <div className="mt-8 space-y-5">
          <AuthError message={AUTH.resetNoToken} />
          <p className="text-center text-sm text-white/40">
            <a
              href={ROUTES.forgotPassword}
              className="font-medium text-teal-300 underline-offset-4 transition-colors duration-200 hover:underline"
            >
              {AUTH.requestNewLink}
            </a>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <h1 className="mt-10 text-lg font-semibold tracking-tight">{AUTH.resetTitle}</h1>
      <p className="mt-1 text-sm leading-relaxed text-white/45">{AUTH.resetSub}</p>

      {done ? (
        <div className="mt-8 space-y-5">
          <AuthNotice message={AUTH.resetDone} />
          <Btn
            role="primary"
            className="w-full"
            onClick={() => window.location.assign(ROUTES.login)}
          >
            {AUTH.signInNow}
          </Btn>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="mt-8 space-y-5">
          <AuthField
            label={ACCOUNT.newPasswordLabel}
            type="password"
            value={password}
            onChange={(v) => {
              setPassword(v);
              if (error) setError(null);
            }}
            placeholder={AUTH.passwordPlaceholder}
            autoComplete="new-password"
            autoFocus
          />
          <AuthField
            label={ACCOUNT.confirmPasswordLabel}
            type="password"
            value={confirm}
            onChange={(v) => {
              setConfirm(v);
              if (error) setError(null);
            }}
            placeholder={AUTH.passwordPlaceholder}
            autoComplete="new-password"
          />

          {error && <AuthError message={error} />}

          <Btn type="submit" role="primary" disabled={busy} className="w-full">
            {busy ? AUTH.resetSaving : AUTH.resetCta}
          </Btn>

          <p className="text-center text-sm text-white/40">
            <a
              href={ROUTES.forgotPassword}
              className="font-medium text-teal-300 underline-offset-4 transition-colors duration-200 hover:underline"
            >
              {AUTH.requestNewLink}
            </a>
          </p>
        </form>
      )}
    </AuthShell>
  );
}
