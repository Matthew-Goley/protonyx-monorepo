// Typed client for the referral service (referral-service/, FastAPI on Railway).
// Base URL comes from VITE_REFERRAL_API_URL; the localhost default matches the
// service's dev port. The service's /join, /verify, /status are unauthenticated
// (rate-limited + CORS-restricted), so no key is sent from the browser.

const API_BASE = (
  import.meta.env.VITE_REFERRAL_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

export interface Entitlement {
  verified: boolean;
  months: number | null; // null === lifetime
  lifetime: boolean;
  referral_count: number;
}

export interface VerifyResponse {
  success: boolean;
  email: string;
  referral_code: string;
  referral_link: string;
  entitlement: Entitlement;
}

export interface StatusResponse {
  success: boolean;
  verified: boolean;
  referral_count: number;
  entitlement: Entitlement;
}

async function toError(res: Response): Promise<Error> {
  let detail = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    detail = body.detail || body.message || detail;
  } catch {
    // non-JSON body, keep the status-based fallback
  }
  return new Error(detail);
}

// POST /join — sends the magic-link email. referralCode is the code captured
// from a /r/<code> share link (or null for a direct signup).
export async function join(email: string, referralCode?: string | null): Promise<void> {
  const res = await fetch(`${API_BASE}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, referral_code: referralCode ?? null }),
  });
  if (!res.ok) throw await toError(res);
}

// GET /verify — consumes the single-use magic token, returns the share link.
export async function verify(token: string): Promise<VerifyResponse> {
  const res = await fetch(`${API_BASE}/verify?token=${encodeURIComponent(token)}`);
  if (!res.ok) throw await toError(res);
  return res.json();
}

// GET /status — current verified referral count + entitlement for a code.
export async function status(code: string): Promise<StatusResponse> {
  const res = await fetch(`${API_BASE}/status?code=${encodeURIComponent(code)}`);
  if (!res.ok) throw await toError(res);
  return res.json();
}
