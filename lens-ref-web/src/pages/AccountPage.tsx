import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ACCOUNT, authUrl, ROUTES } from "../content";
import { useAuth } from "../hooks/authContext";
import * as authApi from "../lib/authApi";
import SimplePage from "../components/SimplePage";
import { Btn } from "../components/buttons";

// The signed-in account page: everything a user can do to their own account in
// one place. Backed by the Fastify `users` table, so a change here is a change
// to the same account they sign in to the app with.
//
// Field styling follows the frontend/ account page, which did it well: a
// two-column definition list with uppercase wide-tracked labels and a hairline
// between rows, the tinted verified/unverified email pill in the same greens and
// reds, and an arm-then-confirm delete button rather than a modal.

type Status = { kind: "idle" | "working" | "ok" | "error"; message?: string };

const IDLE: Status = { kind: "idle" };

// One row of the profile table. Renders a dt/dd pair straight into the parent
// grid so labels and values keep their own columns and share a baseline.
//
// The rule sits on the dt at every width but on the dd only from `sm` up:
// stacked into one column, a border on the dd would draw a line between a label
// and its own value instead of between rows.
function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="flex items-center border-t border-slate-200 pb-1 pr-6 pt-4 text-xs uppercase tracking-[0.12em] text-slate-500 sm:py-4">
        {label}
      </dt>
      <dd className="flex flex-wrap items-center gap-3 border-slate-200 pb-4 text-base text-slate-900 sm:border-t sm:py-4">
        {children}
      </dd>
    </>
  );
}

function Section({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 pt-8">
      <h2 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h2>
      <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-slate-600">{body}</p>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-xs uppercase tracking-[0.12em] text-slate-500">
        {label}
      </span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        className="h-10 w-full rounded-[15px] border border-slate-300 bg-white px-4 text-sm text-slate-900 transition-colors duration-200 focus:border-teal-500 focus:outline-none"
      />
    </label>
  );
}

// Inline status line shared by every action on the page, so a success and a
// failure always read the same way whichever control produced them.
function StatusLine({ status }: { status: Status }) {
  if (status.kind === "idle" || !status.message) return null;
  return (
    <p
      role="status"
      aria-live="polite"
      className={`mt-3 text-sm ${
        status.kind === "error" ? "text-[#b3463f]" : "text-[#2f7d5b]"
      }`}
    >
      {status.message}
    </p>
  );
}

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "-"
    : d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function AccountPage() {
  const { user, loading, logout } = useAuth();

  const [verifyStatus, setVerifyStatus] = useState<Status>(IDLE);
  const [pwStatus, setPwStatus] = useState<Status>(IDLE);
  const [deleteStatus, setDeleteStatus] = useState<Status>(IDLE);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Two-click delete: the first click arms the button, the second commits.
  const [armed, setArmed] = useState(false);

  // The page is meaningless without a session, but wait for the check to settle
  // before redirecting or a slow /me would bounce a signed-in user to /login.
  useEffect(() => {
    if (!loading && !user) {
      window.location.replace(authUrl("signin", ROUTES.account));
    }
  }, [loading, user]);

  // Disarm on its own so the delete button cannot sit primed indefinitely and
  // catch a stray click minutes later.
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 5000);
    return () => window.clearTimeout(t);
  }, [armed]);

  if (!user) {
    return (
      <SimplePage title={ACCOUNT.title}>
        <p className="text-slate-500">{loading ? "" : ACCOUNT.signedOutRedirect}</p>
      </SimplePage>
    );
  }

  const verified = user.email_verified === true;

  const sendVerification = async () => {
    setVerifyStatus({ kind: "working", message: ACCOUNT.verifySending });
    try {
      await authApi.resendVerification();
      setVerifyStatus({ kind: "ok", message: ACCOUNT.verifySent });
    } catch (err) {
      setVerifyStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Could not send the email.",
      });
    }
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (pwStatus.kind === "working") return;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPwStatus({ kind: "error", message: ACCOUNT.passwordMissing });
      return;
    }
    if (newPassword.length < 8) {
      setPwStatus({ kind: "error", message: ACCOUNT.passwordTooShort });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwStatus({ kind: "error", message: ACCOUNT.passwordMismatch });
      return;
    }

    setPwStatus({ kind: "working", message: ACCOUNT.passwordSaving });
    try {
      await authApi.changePassword(currentPassword, newPassword);
      setPwStatus({ kind: "ok", message: ACCOUNT.passwordChanged });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPwStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Could not change the password.",
      });
    }
  };

  const removeAccount = async () => {
    if (!armed) {
      setArmed(true);
      return;
    }
    setDeleteStatus({ kind: "working", message: ACCOUNT.deleteDeleting });
    try {
      await authApi.deleteAccount();
      // The row is gone, so drop the local session too rather than leaving the
      // nav showing an account that no longer exists, then leave the page.
      await logout();
      window.location.assign(ROUTES.home);
    } catch (err) {
      setArmed(false);
      setDeleteStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Could not delete the account.",
      });
    }
  };

  const planLabel =
    user.plan?.toLowerCase() === "pro"
      ? user.plan_expires_at
        ? ACCOUNT.proUntil(formatDate(user.plan_expires_at))
        : ACCOUNT.planPro
      : ACCOUNT.planFree;

  return (
    <SimplePage title={ACCOUNT.title} subtitle={ACCOUNT.subtitle}>
      <div className="space-y-10">
        <dl className="grid grid-cols-1 sm:grid-cols-[200px_1fr]">
          <InfoRow label={ACCOUNT.usernameLabel}>{user.username}</InfoRow>
          <InfoRow label={ACCOUNT.emailLabel}>
            <span className="break-all">{user.email}</span>
            <span
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium ${
                verified
                  ? "border-[rgba(58,140,110,0.4)] bg-[rgba(58,140,110,0.1)] text-[#2f7d5b]"
                  : "border-[rgba(179,70,63,0.4)] bg-[rgba(179,70,63,0.1)] text-[#b3463f]"
              }`}
            >
              {verified ? ACCOUNT.verifiedBadge : ACCOUNT.unverifiedBadge}
            </span>
          </InfoRow>
          <InfoRow label={ACCOUNT.planLabel}>{planLabel}</InfoRow>
          <InfoRow label={ACCOUNT.memberSinceLabel}>
            {formatDate(user.member_since)}
          </InfoRow>
        </dl>

        <Section title={ACCOUNT.verifyHeading} body={ACCOUNT.verifyBody}>
          {verified ? (
            <p className="text-sm text-slate-600">{ACCOUNT.verifyDone}</p>
          ) : (
            <>
              <Btn
                role="secondary"
                onClick={() => void sendVerification()}
                disabled={verifyStatus.kind === "working" || verifyStatus.kind === "ok"}
              >
                {ACCOUNT.verifyCta}
              </Btn>
              <StatusLine status={verifyStatus} />
            </>
          )}
        </Section>

        <Section title={ACCOUNT.passwordHeading} body={ACCOUNT.passwordBody}>
          <form onSubmit={submitPassword} noValidate className="max-w-sm space-y-4">
            <PasswordField
              label={ACCOUNT.currentPasswordLabel}
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
            <PasswordField
              label={ACCOUNT.newPasswordLabel}
              value={newPassword}
              onChange={setNewPassword}
              autoComplete="new-password"
            />
            <PasswordField
              label={ACCOUNT.confirmPasswordLabel}
              value={confirmPassword}
              onChange={setConfirmPassword}
              autoComplete="new-password"
            />
            <Btn type="submit" role="primary" disabled={pwStatus.kind === "working"}>
              {ACCOUNT.passwordCta}
            </Btn>
          </form>
          <StatusLine status={pwStatus} />
        </Section>

        <Section title={ACCOUNT.dangerHeading} body={ACCOUNT.dangerBody}>
          <Btn
            role="danger"
            onClick={() => void removeAccount()}
            disabled={deleteStatus.kind === "working"}
            className={armed ? "bg-[#f16b6b] text-white" : ""}
          >
            {armed ? ACCOUNT.deleteConfirmCta : ACCOUNT.deleteCta}
          </Btn>
          <StatusLine status={deleteStatus} />
        </Section>

        <div className="flex justify-end border-t border-slate-200 pt-8">
          <Btn
            role="secondary"
            onClick={() => {
              void logout().then(() => window.location.assign(ROUTES.home));
            }}
          >
            {ACCOUNT.signOut}
          </Btn>
        </div>
      </div>
    </SimplePage>
  );
}
