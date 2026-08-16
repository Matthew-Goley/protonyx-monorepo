import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ArrowUpRight } from "lucide-react";
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
  // Label above a flat bordered input, lens-app's Field shape. The input's 1px
  // border is the ONLY box on this page; nothing wraps it.
  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-medium text-white/55">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        className="h-10 w-full rounded-[15px] border border-white/12 bg-transparent px-4 text-sm text-white placeholder:text-white/25 transition-colors duration-200 focus:border-teal-400/70 focus:outline-none"
      />
    </label>
  );
}

export default function LoginPage() {
  const { user, login, signup, logout } = useAuth();

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
    // Flat surface, nothing layered on it: no radial glow, no card, no tab pill.
    // The page borrows lens-app's sign-in shape (top-anchored column, wordmark,
    // underline tabs, labelled fields, full-width primary) in the site's own
    // palette, so the only bordered element left is the inputs themselves.
    //
    // No data-nav-dark marker: that attribute exists for the NavBar's adaptive
    // theme probe, and the NavBar is not mounted on this route at all.
    //
    // The top offset is PADDING on this wrapper, never a margin on the child.
    // With no top padding or border here, a child's margin-top collapses out of
    // this element and shifts it down instead, which left a white strip of bare
    // body above the dark background.
    <div className="min-h-screen bg-[#0c0f16] px-6 pb-16 pt-24 text-white">
      {/* No NavBar on this route (see App.tsx), so the wordmark is the only way
          back out and has to be a link. */}
      <main className="mx-auto w-full max-w-md">
        <div className="text-center">
          <a href={ROUTES.home} aria-label="Lens Arc home" className="inline-block">
            <img
              src={lensArcWhite}
              alt="Lens Arc"
              className="h-9 w-auto select-none"
              draggable={false}
            />
          </a>
        </div>

        {/* The form renders immediately and never waits on the session check.
            Blocking it behind a spinner meant a slow or unreachable API left
            the page with nothing on it; a visitor who turns out to already be
            signed in is redirected by the effect above the moment /me lands
            (or instantly, from the cached account). */}
        {user ? (
          // Already signed in and the redirect is in flight (or ?next= sent them
          // straight back here). Show the account rather than an empty form so
          // the state is never ambiguous.
          <div className="mt-10 space-y-4 text-center">
            <p className="text-sm font-semibold text-white">
              {AUTH.signedInAs(user.username)}
            </p>
            <p className="text-xs text-white/45">{AUTH.planLine(user.plan)}</p>
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
            {/* Underline tabs rather than a segmented pill: a pill is a box, and
                boxing the tabs inside a card inside the page was the stacking
                this page is deliberately free of. */}
            <div className="mt-10 flex border-b border-white/10">
              {(["signin", "signup"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMode(m)}
                  className={`flex-1 border-b-2 pb-3 text-sm font-medium transition-colors duration-200 ${
                    mode === m
                      ? "border-teal-400 text-white"
                      : "border-transparent text-white/35 hover:text-white/70"
                  }`}
                >
                  {m === "signin" ? AUTH.signInTab : AUTH.signUpTab}
                </button>
              ))}
            </div>

            <h1 className="mt-8 text-lg font-semibold tracking-tight">
              {signIn ? AUTH.signInTitle : AUTH.signUpTitle}
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-white/45">
              {signIn ? AUTH.signInSub : AUTH.signUpSub}
            </p>

            <form onSubmit={submit} noValidate className="mt-8 space-y-5">
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
                // Tinted block rather than a bare red line, matching lens-app's
                // error treatment. It is a fill, not an outlined box.
                <p
                  role="alert"
                  className="rounded-[15px] bg-rose-500/10 px-4 py-3 text-sm leading-relaxed text-rose-300"
                >
                  {error}
                </p>
              )}

              <Btn type="submit" role="primary" disabled={busy} className="w-full">
                {busy ? AUTH.working : signIn ? AUTH.signInCta : AUTH.signUpCta}
              </Btn>

              {!signIn && (
                <p className="text-xs leading-relaxed text-white/40">
                  {AUTH.termsNote}{" "}
                  <a
                    href={LEGAL_PAGES.terms.path}
                    className="text-teal-300 underline-offset-4 transition-colors duration-200 hover:underline"
                  >
                    {AUTH.termsLink}
                  </a>
                  .
                </p>
              )}
            </form>

            <p className="mt-8 text-center text-sm text-white/40">
              {signIn ? AUTH.switchToSignUp : AUTH.switchToSignIn}{" "}
              <button
                type="button"
                onClick={() => switchMode(signIn ? "signup" : "signin")}
                className="font-medium text-teal-300 underline-offset-4 transition-colors duration-200 hover:underline"
              >
                {signIn ? AUTH.switchToSignUpCta : AUTH.switchToSignInCta}
              </button>
            </p>
          </>
        )}

        <p className="mt-10 text-center text-xs text-white/25">
          <a
            href={ROUTES.home}
            className="transition-colors duration-200 hover:text-white/60"
          >
            {AUTH.backHome}
          </a>
        </p>
      </main>
    </div>
  );
}
