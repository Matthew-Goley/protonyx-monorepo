import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import * as authApi from "../lib/authApi";
import type { AuthUser } from "../lib/authApi";

// Real account state for the site, backed by the Fastify `users` table (the
// same accounts lens-app uses). Mounted once at the App root, above
// AccountProvider, so the nav's account slot and the login page share one
// session view.
//
// Mirrors lens-app's AuthContext deliberately: same endpoints, same httpOnly
// cookie, same "gate on /me, not on /login" rule. Keeping the two in step means
// a session established on either site behaves identically.

interface AuthContextValue {
  user: AuthUser | null;
  /** True only once GET /me has confirmed a usable session. */
  isAuthenticated: boolean;
  /** True until the initial GET /me settles, so the nav can avoid a signed-out flash. */
  loading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<void>;
  signup: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// Session-scoped cache of the last known account. This site has no router: every
// nav click is a real page load, so without it the account slot would blank out
// and re-resolve on every single page, and each view would spend one request
// against the 20/60s rate limit before anything could render. It is a display
// cache only, never an authorization one: the httpOnly cookie is still what
// authenticates every call, and /me revalidates on each load.
const CACHE_KEY = "lens_account";

function readCache(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null; // storage unavailable or malformed entry
  }
}

function writeCache(user: AuthUser | null) {
  try {
    if (user) sessionStorage.setItem(CACHE_KEY, JSON.stringify(user));
    else sessionStorage.removeItem(CACHE_KEY);
  } catch {
    // private mode: the session still works, it just re-fetches every page
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<AuthUser | null>(readCache);
  // Nothing to wait for when the cache already has an account to paint.
  const [loading, setLoading] = useState(() => readCache() === null);

  const setUser = (next: AuthUser | null) => {
    setUserState(next);
    writeCache(next);
  };

  // Revalidate on load. The cookie is httpOnly, so /me is the only way to know
  // whether a session still exists.
  useEffect(() => {
    let cancelled = false;
    authApi
      .me()
      .then((u) => {
        // A definitive answer (200 or 401): adopt it, including signing out a
        // stale cached account whose cookie has since expired.
        if (!cancelled) setUser(u);
      })
      .catch(() => {
        // Rate limited, offline, or the API is down. NOT a signed-out signal, so
        // the cached account stays; the next page load revalidates again.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Authentication is gated on /me succeeding, NOT on /login. A correct password
  // does not prove a usable session: every authenticated call rides the httpOnly
  // cookie, so if the browser dropped it (third-party cookie blocking) login
  // "succeeds" and nothing afterwards works. Fail visibly instead. Same rule as
  // lens-app's AuthContext; do not relax it to an unconditional setUser.
  //
  // A null here means a real 401, so the cookie message below is accurate. Any
  // other failure (a 429 from the rate limit, most often) throws out of
  // authApi.me() with its own message rather than being mislabelled as a cookie
  // problem.
  async function login(usernameOrEmail: string, password: string) {
    await authApi.login(usernameOrEmail, password);
    const me = await authApi.me();
    if (!me) {
      throw new Error(
        "Signed in, but your browser did not keep the session. If you block third-party cookies, allow them for this site and try again."
      );
    }
    setUser(me);
  }

  // Signup does not set a cookie (only /login does), so log in straight after to
  // establish the session. Signing up by email then logging in by username would
  // work too, but the email is what the user just typed.
  async function signup(username: string, email: string, password: string) {
    await authApi.signup(username, email, password);
    await login(username, password);
  }

  async function logout() {
    await authApi.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: user !== null, loading, login, signup, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
