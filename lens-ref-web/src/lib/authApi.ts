// Typed client for the Fastify backend (backend/, Node + Postgres). This is the
// REAL account system: the same `users` table lens-app authenticates against, so
// an account created here signs straight into app.lens-arc.com.
//
// It is deliberately separate from src/lib/api.ts, which talks to the
// referral-service and its `waitlist` table. The waitlist is a pre-launch
// mailing list, not an account store; the nav's magic-link sign-in that ran on
// it has been removed (see CLAUDE.md §5 "The account").
//
// Auth rides the httpOnly `session` cookie, so every call sets
// credentials: "include" and no token is ever read or stored in JS. In
// production the API must be served from api.lens-arc.com so the cookie stays
// same-site with lens-arc.com (see the root CLAUDE.md §4 "API domain").

// The production API host. Hardcoded as the non-DEV fallback on purpose, the
// same way content.ts hardcodes APP_URL: Vite inlines VITE_* at BUILD time, so
// a missing var on the deploy host silently bakes the dev default into the
// shipped bundle. When that default was plain "http://localhost:3000", the live
// site tried to POST to the visitor's own machine over http from an https page
// and every call died as "Failed to fetch". A wrong-but-reachable production
// default is recoverable; an unreachable one is not.
//
// It MUST stay on api.lens-arc.com rather than the raw *.up.railway.app host:
// only this form is same-site with lens-arc.com, which is what keeps the
// session cookie first-party (see the root CLAUDE.md §4 "API domain").
const PROD_API_URL = "https://api.lens-arc.com";

const API_BASE = (
  import.meta.env.VITE_API_URL ??
  (import.meta.env.DEV ? "http://localhost:3000" : PROD_API_URL)
).replace(/\/$/, "");

// The subset of GET /me this site actually renders. The endpoint returns more
// (risk_tier, settings, download_count, ...), all of it app state that the
// marketing site has no use for.
export interface AuthUser {
  id: number;
  username: string;
  email: string;
  plan: string;
  plan_expires_at?: string | null;
  member_since?: string;
  email_verified?: boolean;
  subscription_status?: "inactive" | "active" | "cancelled";
}

interface Envelope {
  success?: boolean;
  message?: string;
}

// The backend names its error field `message` on every route (root CLAUDE.md
// §4 "Response shape"). A non-JSON body falls back to the status code.
async function toError(res: Response): Promise<Error> {
  let detail = `Request failed (${res.status})`;
  try {
    const body = (await res.json()) as Envelope;
    detail = body.message || detail;
  } catch {
    // non-JSON body, keep the status-based fallback
  }
  return new Error(detail);
}

// Every call goes through here so a transport failure surfaces as something
// actionable. fetch() rejects with a bare "Failed to fetch" TypeError for
// connection refused, DNS failure, a blocked mixed-content request, and a
// rejected CORS preflight alike, with no detail whatsoever. Printing that
// verbatim is what made a missing VITE_API_URL look like a broken login form.
//
// A throw from here means the request never reached the server, which is NOT
// proof of being signed out; AuthProvider keeps its cached session on any throw
// and clears it only on an explicit 401.
async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, { credentials: "include", ...init });
  } catch {
    throw new Error(
      `Could not reach the Lens Arc API at ${API_BASE}. Check your connection and try again.`
    );
  }
}

// POST /login. The `username` field accepts a username OR an email; the backend
// resolves both (WHERE username = $1 OR email = $1). On success the response
// sets the httpOnly session cookie.
export async function login(usernameOrEmail: string, password: string): Promise<void> {
  const res = await request("/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: usernameOrEmail, password }),
  });
  if (!res.ok) throw await toError(res);
}

// POST /signup. Beta-gated server-side (BETA_ACTIVE + MAX_BETA_USERS), so a 403
// here is a closed/full beta, not a bad request. Does NOT set a cookie: the
// caller must log in afterwards to get a session.
export async function signup(
  username: string,
  email: string,
  password: string
): Promise<void> {
  const res = await request("/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  if (!res.ok) throw await toError(res);
}

// GET /me. Returns null for 401, which is the ordinary signed-out case and not
// an error worth throwing on.
//
// Any OTHER failure throws, and that distinction is load-bearing: the backend
// rate-limits at 20 requests / 60s per IP, and this site navigates by full page
// load, so every page view spends one /me. Collapsing a 429 (or a network blip)
// into "signed out" would log a visitor out of the nav for browsing quickly.
// The caller keeps its cached session on a throw and clears it only on null.
export async function me(): Promise<AuthUser | null> {
  const res = await request("/me");
  if (res.status === 401) return null;
  if (!res.ok) throw await toError(res);
  const body = (await res.json()) as { user?: AuthUser };
  return body.user ?? null;
}

// POST /logout. Clears the session cookie server-side.
export async function logout(): Promise<void> {
  await request("/logout", { method: "POST" }).catch(() => {
    // A failed logout call still ends the session locally; nothing to surface.
  });
}
