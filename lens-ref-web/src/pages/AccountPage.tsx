import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ACCOUNT, authUrl, ROUTES } from "../content";
import { useAuth } from "../hooks/authContext";
import * as authApi from "../lib/authApi";
import SimplePage from "../components/SimplePage";
import { Btn } from "../components/buttons";

// The signed-in account page: everything a user can do to their own account.
// Backed by the Fastify `users` table, so a change here is a change to the same
// account they sign in to the app with.
//
// The layout follows frontend/'s account page closely, because that page got the
// density right: ONE definition list carries the whole account, and each row's
// action sits inline on the right of its own value rather than in a separate
// stacked section. Email verification lives on the email row, the password
// change opens from the password row. Only the two account-level actions
// (delete, sign out) sit outside the list, in a single row beneath it.
//
// Field styling is lifted from the same place: uppercase wide-tracked labels, a
// hairline between rows, the tinted verified/unverified pill in the same greens
// and reds, and a small quiet button per row.

type Status = { kind: "idle" | "working" | "ok" | "error"; message?: string };

const IDLE: Status = { kind: "idle" };

// One row of the account list. Renders a dt/dd pair straight into the parent
// grid so labels and values keep their own columns and share a baseline.
//
// `action` is the row's own control, pushed to the right edge of the value cell
// (frontend/'s dd.email-cell / dd.password-cell space-between). The rule sits on
// the dt at every width but on the dd only from `sm` up: stacked into one
// column, a border on the dd would draw a line between a label and its own value
// instead of between rows.
function Row({
  label,
  action,
  children,
}: {
  label: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <>
      <dt className="flex items-center border-t border-slate-200 pb-1 pr-6 pt-3 text-xs uppercase tracking-[0.12em] text-slate-500 sm:py-3">
        {label}
      </dt>
      <dd className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-slate-200 pb-3 text-[15px] text-slate-900 sm:border-t sm:py-3">
        <span className="flex flex-wrap items-center gap-2.5">{children}</span>
        {action}
      </dd>
    </>
  );
}

// Small, non-dominant row button (frontend/'s .btn-verify sizing).
function RowBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <Btn role="secondary" size="sm" onClick={onClick} disabled={disabled}>
      {children}
    </Btn>
  );
}

// Inline row status, 0.8rem, green on success and red on failure, matching
// frontend/'s .verify-message.
function StatusText({ status }: { status: Status }) {
  if (status.kind === "idle" || !status.message) return null;
  return (
    <span
      role="status"
      aria-live="polite"
      className={`text-[13px] ${
        status.kind === "error" ? "text-[#b3463f]" : "text-[#2f7d5b]"
      }`}
    >
      {status.message}
    </span>
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
        className="h-9 w-full rounded-[15px] border border-slate-300 bg-white px-3.5 text-sm text-slate-900 transition-colors duration-200 focus:border-teal-500 focus:outline-none"
      />
    </label>
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

  const [pwOpen, setPwOpen] = useState(false);
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
      setPwOpen(false);
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
      <p className="text-xs uppercase tracking-[0.12em] text-slate-400">
        {ACCOUNT.profileLabel}
      </p>

      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-[180px_1fr]">
        <Row label={ACCOUNT.usernameLabel}>{user.username}</Row>

        <Row
          label={ACCOUNT.emailLabel}
          action={
            verified ? undefined : (
              <span className="flex flex-wrap items-center gap-3">
                <StatusText status={verifyStatus} />
                <RowBtn
                  onClick={() => void sendVerification()}
                  disabled={
                    verifyStatus.kind === "working" || verifyStatus.kind === "ok"
                  }
                >
                  {ACCOUNT.verifyCta}
                </RowBtn>
              </span>
            )
          }
        >
          <span className="break-all">{user.email}</span>
          <span
            className={`rounded-lg border px-2 py-0.5 text-xs font-medium ${
              verified
                ? "border-[rgba(58,140,110,0.4)] bg-[rgba(58,140,110,0.1)] text-[#2f7d5b]"
                : "border-[rgba(179,70,63,0.4)] bg-[rgba(179,70,63,0.1)] text-[#b3463f]"
            }`}
          >
            {verified ? ACCOUNT.verifiedBadge : ACCOUNT.unverifiedBadge}
          </span>
        </Row>

        {/* The password is never returned by /me, so the value is a static mask
            and the row's job is purely to open the change form. */}
        <Row
          label={ACCOUNT.passwordLabel}
          action={
            <span className="flex flex-wrap items-center gap-3">
              {!pwOpen && <StatusText status={pwStatus} />}
              <RowBtn
                onClick={() => {
                  setPwOpen((o) => !o);
                  setPwStatus(IDLE);
                }}
              >
                {pwOpen ? ACCOUNT.cancel : ACCOUNT.passwordCta}
              </RowBtn>
            </span>
          }
        >
          <span className="tracking-[0.15em] text-slate-900">{ACCOUNT.passwordMask}</span>
        </Row>

        {/* Spans both columns so the form sits directly under the password row
            rather than being squeezed into the value column. */}
        {pwOpen && (
          <div className="border-t border-slate-200 py-4 sm:col-span-2">
            <form onSubmit={submitPassword} noValidate className="max-w-sm space-y-3">
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
              <div className="flex items-center gap-3 pt-1">
                <Btn
                  type="submit"
                  role="primary"
                  size="sm"
                  disabled={pwStatus.kind === "working"}
                >
                  {ACCOUNT.passwordSave}
                </Btn>
                <StatusText status={pwStatus} />
              </div>
            </form>
          </div>
        )}

        <Row label={ACCOUNT.planLabel}>{planLabel}</Row>
        <Row label={ACCOUNT.memberSinceLabel}>{formatDate(user.member_since)}</Row>
      </dl>

      {/* The only actions that are not about a single field: destructive on the
          left, ordinary on the right (frontend/'s .account-actions-row). */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5">
        <span className="flex flex-wrap items-center gap-3">
          <Btn
            role="danger"
            size="sm"
            onClick={() => void removeAccount()}
            disabled={deleteStatus.kind === "working"}
            className={armed ? "bg-[#f16b6b] text-white" : ""}
          >
            {armed ? ACCOUNT.deleteConfirmCta : ACCOUNT.deleteCta}
          </Btn>
          <StatusText status={deleteStatus} />
        </span>
        <Btn
          role="secondary"
          size="sm"
          onClick={() => {
            void logout().then(() => window.location.assign(ROUTES.home));
          }}
        >
          {ACCOUNT.signOut}
        </Btn>
      </div>
    </SimplePage>
  );
}
