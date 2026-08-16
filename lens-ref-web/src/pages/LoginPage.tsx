import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { APP_URL, AUTH, COPY, LEGAL_PAGES, NAV, ROUTES } from "../content";
import { useAuth } from "../hooks/authContext";
import { Btn, BtnLink } from "../components/buttons";
import lensArcWhite from "../../assets/lens-arc/lens-arc-white.png";

// The site's account page: /login (Sign in tab) and /signup (Create account
// tab), one component. It authenticates against the Fastify `users` table, the
// same accounts lens-app uses, so signing up here creates a real Lens Arc
// account (and, if the email is on the verified referral waitlist, the backend
// grants the earned Pro time during that signup).
//
// It is a full page rather than the old nav popover because a real account
// needs a username, an email and a password, which is more than a popover can
// carry. The dark section is marked data-nav-dark so the persistent NavBar
// renders its dark theme over it.

type Mode = "signin" | "signup";

// Where to land after a successful sign in. Only same-origin absolute paths are
// honoured: an attacker-supplied ?next=https://evil.example would otherwise turn
// the login page into an open redirect. A protocol-relative //host is rejected
// for the same reason.
function safeNext(): string {
  const raw = new URLSearchParams(window.location.search).get("next");
  if (!raw) return ROUTES.home;
  if (!raw.startsWith("/") || raw.startsWith("//")) return ROUTES.home;
  // Never bounce straight back to this page.
  if (raw === ROUTES.login || raw === ROUTES.signup) return ROUTES.home;
  return raw;
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
  autoFocus = false,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-white/60">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="w-full rounded-[15px] border border-white/15 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-white/25 transition-colors duration-200 focus:border-teal-400/60 focus:outline-none"
      />
    </label>
  );
}

export default function LoginPage() {
  const { user, loading, login, signup, logout } = useAuth();

  // The path decides the initial tab; after that it is plain local state, so the
  // user can switch without a navigation.
  const [mode, setMode] = useState<Mode>(() =>
    window.location.pathname.replace(/\/$/, "") === ROUTES.signup ? "signup" : "signin"
  );
  // Prefilled from ?email= so a link that means "claim your Pro time with this
  // address" arrives with the address already in the box.
  const [email, setEmail] = useState(
    () => new URLSearchParams(window.location.search).get("email") ?? ""
  );
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A session established here is the whole point, so land the user back where
  // they came from as soon as one exists. Runs on a fresh sign in and on arriving
  // already signed in.
  useEffect(() => {
    if (user) window.location.assign(safeNext());
  }, [user]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(null);

    if (mode === "signin") {
      if (!identifier.trim() || !password) {
        setError(AUTH.missingFields);
        return;
      }
    } else {
      if (!username.trim() || !email.trim() || !password) {
        setError(AUTH.missingFields);
        return;
      }
      if (password.length < 8) {
        setError(AUTH.passwordTooShort);
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "signin") {
        await login(identifier.trim(), password);
      } else {
        await signup(username.trim(), email.trim(), password);
      }
      // The effect above redirects once `user` lands; keep the button busy until
      // the navigation happens rather than flashing an idle form.
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  const signIn = mode === "signin";

  return (
    <div
      data-nav-dark
      className="relative flex min-h-screen flex-col overflow-hidden bg-[#0c0f16] text-white"
    >
      {/* Same pulsing radial glow as the landing hero, so the page reads as part
          of the site rather than a bolted-on form. */}
      <div
        aria-hidden="true"
        className="hero-pulse pointer-events-none absolute left-1/2 top-0 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/3 rounded-full opacity-25 blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(45,212,191,0.5) 0%, rgba(56,189,248,0.25) 45%, transparent 70%)",
        }}
      />

      <main className="relative flex flex-1 items-center justify-center px-6 pb-16 pt-28">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <img
              src={lensArcWhite}
              alt="Lens Arc"
              className="mx-auto h-7 w-auto select-none"
              draggable={false}
            />
          </div>

          <div className="rounded-[20px] border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-white/50">
                <Loader2 size={20} className="animate-spin" aria-label="Loading" />
              </div>
            ) : user ? (
              // Already signed in and the redirect is in flight (or ?next= sent
              // them straight back here). Show the account rather than an empty
              // form so the state is never ambiguous.
              <div className="space-y-4 text-center">
                <p className="text-sm font-semibold text-white">
                  {AUTH.signedInAs(user.username)}
                </p>
                <p className="text-xs text-white/50">{AUTH.planLine(user.plan)}</p>
                <BtnLink role="primary" href={APP_URL} className="w-full">
                  {NAV.app.label}
                  <ArrowUpRight size={15} />
                </BtnLink>
                <Btn role="danger" onClick={() => void logout()} className="w-full">
                  {COPY.logout}
                </Btn>
              </div>
            ) : (
              <>
                <div className="mb-6 grid grid-cols-2 gap-1 rounded-[15px] border border-white/10 bg-white/5 p-1">
                  {(["signin", "signup"] as const).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => switchMode(m)}
                      className={`rounded-[12px] py-2 text-sm font-medium transition-colors duration-200 ${
                        mode === m
                          ? "bg-white/10 text-white"
                          : "text-white/50 hover:text-white/80"
                      }`}
                    >
                      {m === "signin" ? AUTH.signInTab : AUTH.signUpTab}
                    </button>
                  ))}
                </div>

                <h1 className="text-lg font-semibold tracking-tight">
                  {signIn ? AUTH.signInTitle : AUTH.signUpTitle}
                </h1>
                <p className="mt-1 text-xs leading-relaxed text-white/50">
                  {signIn ? AUTH.signInSub : AUTH.signUpSub}
                </p>

                <form onSubmit={submit} noValidate className="mt-6 space-y-4">
                  {signIn ? (
                    <Field
                      label={AUTH.identifierLabel}
                      type="text"
                      value={identifier}
                      onChange={setIdentifier}
                      placeholder={AUTH.identifierPlaceholder}
                      autoComplete="username"
                      autoFocus
                    />
                  ) : (
                    <>
                      <Field
                        label={AUTH.usernameLabel}
                        type="text"
                        value={username}
                        onChange={setUsername}
                        placeholder={AUTH.usernamePlaceholder}
                        autoComplete="username"
                        autoFocus
                      />
                      <Field
                        label={AUTH.emailLabel}
                        type="email"
                        value={email}
                        onChange={setEmail}
                        placeholder={COPY.emailPlaceholder}
                        autoComplete="email"
                      />
                    </>
                  )}

                  <Field
                    label={AUTH.passwordLabel}
                    type="password"
                    value={password}
                    onChange={setPassword}
                    placeholder={AUTH.passwordPlaceholder}
                    autoComplete={signIn ? "current-password" : "new-password"}
                  />

                  {error && (
                    <p role="alert" className="text-xs leading-relaxed text-rose-400">
                      {error}
                    </p>
                  )}

                  <Btn
                    type="submit"
                    role="primary"
                    disabled={busy}
                    className="w-full"
                  >
                    {busy
                      ? AUTH.working
                      : signIn
                        ? AUTH.signInCta
                        : AUTH.signUpCta}
                  </Btn>

                  {!signIn && (
                    <p className="text-center text-[11px] leading-relaxed text-white/40">
                      {AUTH.termsNote}{" "}
                      <a
                        href={LEGAL_PAGES.terms.path}
                        className="underline underline-offset-2 transition-colors duration-200 hover:text-white/70"
                      >
                        {AUTH.termsLink}
                      </a>
                      .
                    </p>
                  )}
                </form>
              </>
            )}
          </div>

          {!loading && !user && (
            <p className="mt-5 text-center text-xs text-white/45">
              {signIn ? AUTH.switchToSignUp : AUTH.switchToSignIn}{" "}
              <button
                type="button"
                onClick={() => switchMode(signIn ? "signup" : "signin")}
                className="font-medium text-teal-300 underline-offset-4 transition-colors duration-200 hover:underline"
              >
                {signIn ? AUTH.switchToSignUpCta : AUTH.switchToSignInCta}
              </button>
            </p>
          )}

          <p className="mt-8 text-center text-xs text-white/30">
            <a
              href={ROUTES.home}
              className="transition-colors duration-200 hover:text-white/60"
            >
              {AUTH.backHome}
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
