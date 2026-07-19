# CLAUDE.md — referral-service

Full reference for the **referral service**. Read this before working in
`referral-service/`. Keep it current: if a change makes a claim here stale, fix
the claim in the same change (same rule as the root `CLAUDE.md`).

---

## 1. What this is

A standalone **Python FastAPI** service that powers the pre-launch waitlist and
referral system for the Lens Arc marketing site (`lens-ref-web/`). It runs as its
**own Railway service**, deploys independently, and shares nothing with the rest
of the stack **except the Postgres database**.

The flow: someone enters an email on the marketing site. That is the entire
signup. The service creates a `waitlist` row, issues a single-use magic token,
and emails a verification link via Resend. Clicking the link marks the row
verified and destroys the token. Verified users get their own referral code and
share link. When someone joins through that link and verifies their own email,
the referrer's count goes up, banking more Pro time, capping at lifetime Pro.

**Pro time is never stored as a balance.** Entitlement is computed on demand from
two facts: whether you verified yourself, and how many of the people you referred
have verified. A single pure function (`entitlement.py`) maps those inputs to a
reward, so there is nothing to keep in sync and no way to double-credit. Credit
only ever accrues on **verification**, never on signup, so unverified emails are
worthless to anyone trying to farm the system. The service only counts **direct**
referrals and never walks the tree, which keeps it non-cascading by construction.

### How it stays separate

The service owns exactly one table: `waitlist`. During normal operation it does
not read or write `users`/`positions` and does not touch the Fastify auth
service. A waitlist entry is a lead, not an account: no password, no session, no
auth relationship to anything. The **one** point of contact with the rest of the
system is redemption at launch — `POST /redeem` (internal, shared-secret) writes
a Pro grant onto the matching `users` row and stamps the entry redeemed. That is
the only write outside its own table, and it happens once per user.

### Deleting it

After launch and after the redemption window closes, this service can be shut
down without touching anything else: drop the `waitlist` table, remove the
Railway service, done. Nothing else imports from it.

---

## 2. File layout

```
referral-service/
├── main.py            FastAPI app: CORS, slowapi limiter, lifespan (pool + schema), all endpoints
├── db.py              asyncpg pool from DATABASE_URL; CREATE TABLE IF NOT EXISTS waitlist; count helper
├── entitlement.py     Pure entitlement() + MILESTONES (mirror of lens-ref-web REFERRAL_MILESTONES)
├── mailer.py          Resend send_magic_link() (fire-and-forget, signup vs. returning-login copy). NOT named email.py (see gotcha below)
├── templates.py       Magic-link email HTML: magic_link_html() (signup) + login_link_html() (returning/already-verified). Lens Arc branding, dark/teal palette
├── requirements.txt   Loose >= pins
├── Procfile           web: uvicorn main:app --host 0.0.0.0 --port $PORT
├── .python-version    3.12
├── .env.example       Every env var, documented
└── CLAUDE.md          This file
```

There is no test suite (matches the repo). Conventions mirror `lens-api/`:
`load_dotenv()` first, `os.environ.get(...)` inline, `GET /health` unauthenticated
for Railway health checks.

> **GOTCHA — never name a module `email.py` here.** A module by that name in the
> service root shadows Python's stdlib `email` package, which `email_validator`
> (and others) import, breaking the whole process at import time. The mailer lives
> in `mailer.py` for exactly this reason. Do not rename it back.

---

## 3. The `waitlist` table (owned solely by this service)

Created idempotently on startup (`db.py :: init_pool` → `CREATE TABLE IF NOT
EXISTS`). The service must **never** run DDL against `users`/`positions` — the
Fastify backend owns those and drops them on every dev boot. `waitlist` is not in
that drop list, so it survives Fastify dev restarts.

```sql
CREATE TABLE IF NOT EXISTS waitlist (
    id                     SERIAL PRIMARY KEY,
    email                  TEXT UNIQUE NOT NULL,
    verified               BOOLEAN NOT NULL DEFAULT FALSE,
    verified_at            TIMESTAMPTZ DEFAULT NULL,
    referral_code          TEXT UNIQUE DEFAULT NULL,   -- issued on verify (6-char base36)
    referred_by_code       TEXT DEFAULT NULL,          -- code they joined under (first-touch, captured at /join)
    magic_token_hash       TEXT DEFAULT NULL,          -- sha256 of the single-use token; plaintext never stored
    magic_token_expires_at TIMESTAMPTZ DEFAULT NULL,
    redeemed               BOOLEAN NOT NULL DEFAULT FALSE,
    redeemed_at            TIMESTAMPTZ DEFAULT NULL,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- + indexes on referral_code, referred_by_code, magic_token_hash
```

- **Referral count is never stored.** For a verified user with code `C`:
  `SELECT COUNT(*) FROM waitlist WHERE referred_by_code = C AND verified = TRUE`
  (`db.count_verified_referrals`).
- `referral_code` is `NULL` until the row verifies. Generated from a 6-char
  base36 alphabet via `secrets`, retried on the (rare) unique collision.
- Magic token: `secrets.token_urlsafe(32)` is emailed; only its `sha256` hex is
  persisted; both token columns are cleared on the first successful verify, so the
  link is single-use. Expiry is enforced **DB-side** (`magic_token_expires_at >
  NOW()`, set via `NOW() + make_interval(mins => $n)`) so client clock skew can
  never widen the window.

---

## 4. Reward math (`entitlement.py`)

`MILESTONES` **must stay in lockstep with `REFERRAL_MILESTONES` in
`lens-ref-web/src/content.ts`.** It is a step function keyed on referral
thresholds, not a linear "X months per referral" formula:

| Referrals (>=) | Reward | `entitlement()` |
|---|---|---|
| 0 | 1 month | `months=1` |
| 1 | 2 months | `months=2` |
| 3 | 4 months | `months=4` |
| 5 | 6 months | `months=6` |
| 10 | Lifetime (cap) | `months=None, lifetime=True` |

Counts between thresholds map **down** to the nearest lower milestone (2→2mo,
4→4mo, 6-9→6mo). Unverified → `months=0`. If you change the tiers, change **both**
files.

---

## 5. Endpoints

| Method | Path | Auth | Behavior |
|---|---|---|---|
| `GET` | `/health` | — | `{"status":"ok"}`. Railway health check. |
| `POST` | `/join` | rate-limited | Body `{ email, referral_code? }`. Validates email (`email_validator`, no MX lookup). Upserts the waitlist row: new/unverified rows get a fresh magic token + magic-link email. `referred_by_code` is captured **only on first insert**, only if the code belongs to a **verified** row and isn't the joiner's own; unknown/invalid codes are silently dropped (a bad referral link never blocks a signup). **An already-verified email also gets a fresh token + email** (`referral_code`/`referred_by_code` untouched) so someone can always get back into an existing account by re-entering their email - this is the *only* login mechanism, there being no password. The email copy differs (`login_link_html` "Log back in" vs. `magic_link_html` "Confirm your email") but the JSON response is identical across all three branches (new / resend-unverified / resend-verified), keeping the endpoint enumeration-neutral. Always returns 200 `{ success, message }`. |
| `GET` | `/verify` | rate-limited | Query `?token=`. Looks up by `magic_token_hash` with a live expiry; missing/expired → 400. On success: marks verified, clears the token, issues a `referral_code` if absent. Returns `{ success, email, referral_code, referral_link, entitlement }`. Single-use (a second hit of the same token → 400). |
| `GET` | `/status` | rate-limited | Query `?code=`. Keyed by `referral_code` (counts are low-sensitivity and the code is already shareable). Unknown code → 404. Returns `{ success, verified, referral_count, entitlement }`. |
| `POST` | `/redeem` | `X-Redeem-Secret` | Body `{ email }`. **Internal, never called by the site.** Loads the waitlist row (must be verified), computes entitlement, finds the `users` row by email (404 if none), writes the Pro grant, stamps the waitlist row redeemed. **Idempotent**: an already-redeemed email re-reports the grant without re-writing, so a referral can never be double-credited. |

### Auth model

The marketing site is a public browser SPA and cannot hold a secret, so `/join`,
`/verify`, `/status` are **unauthenticated**, protected by slowapi rate limiting
and the CORS origin allowlist. Only `/redeem` is guarded, by a shared secret in
the `X-Redeem-Secret` header compared against `REDEEM_SECRET` (env unset → 500;
wrong/missing → 401). This is the sole secret in the service.

### Rate limits (slowapi, per IP)

`/join` 5/hour (tightest — it is the email-send path), `/verify` 20/hour,
`/status` 60/hour. `/redeem` and `/health` are exempt. Exceed → 429.

### The `/redeem` Pro grant (the only write outside `waitlist`)

```sql
UPDATE users
SET plan = 'pro',
    subscription_status = 'active',
    plan_expires_at = CASE WHEN <months> IS NULL THEN NULL
                           ELSE NOW() + make_interval(months => <months>) END
WHERE email = $1;
```

These column values match how `backend/src/routes/stripe.ts` represents a paid
Pro user (`plan='pro'`, `subscription_status='active'`), so a referral grant is
indistinguishable from a Stripe one to the rest of the app. Lifetime →
`plan_expires_at = NULL`. `stripe_customer_id` is left untouched (NULL for a
referral-only user).

> **Enforcement gap (known, deferred, out of scope).** The app gates access
> purely on `subscription_status === 'active'` (`lens-app/src/lib/
> subscription.ts`); nothing reads `plan_expires_at`. So a time-limited referral
> grant will **not** auto-expire. If/when that matters, add a scheduled job that
> flips `subscription_status` to `'inactive'` when `plan_expires_at < NOW()`. Do
> not build it as part of this service.

---

## 6. Configuration (`.env.example`)

| Var | Purpose |
|---|---|
| `DATABASE_URL` | Shared Postgres — the SAME DB the Fastify backend uses. `postgresql://user:pass@host:port/db`. Append `?sslmode=require` if the provider needs TLS. |
| `RESEND_API_KEY` | Resend key. **If unset, the magic link is logged instead of sent** — this is what makes local testing possible without delivering mail. |
| `RESEND_FROM` | Sender. Default `noreply@protonyxdata.com` (the currently verified Resend domain). To send from `noreply@lens-arc.com`, verify `lens-arc.com` in Resend first. |
| `FRONTEND_BASE_URL` | Magic links point at `{FRONTEND_BASE_URL}/verify?token=...`. Dev `http://localhost:5173`, prod `https://lens-arc.com`. |
| `REFERRAL_LINK_BASE` | Display base for the share link (no scheme, matches `content.ts`). Default `lens-arc.com/r/`. |
| `MAGIC_LINK_TTL_MINUTES` | Token lifetime, default 30. |
| `REDEEM_SECRET` | Shared secret guarding `POST /redeem`. |
| `PORT` | Injected by Railway; the `Procfile` reads it. |

**CORS** allowlist is hardcoded in `main.py` (`allow_credentials=False`, no
cookies): `https://lens-arc.com`, `http://localhost:5173`, `http://localhost:5174`
(lens-ref-web may auto-increment off 5173 since lens-app also uses it). Add a new
origin by editing that list.

---

## 7. Local development

```bash
cd referral-service
python -m venv .venv
.venv/Scripts/activate            # Windows;  source .venv/bin/activate on *nix
pip install -r requirements.txt

# Point at any reachable Postgres (a throwaway DB is fine; do NOT point at a DB
# you care about if you plan to test /redeem, which writes the users table).
set DATABASE_URL=postgresql://user:pass@localhost:5432/referral_dev
set REDEEM_SECRET=dev-secret
set FRONTEND_BASE_URL=http://localhost:5173
# Leave RESEND_API_KEY unset so the magic link prints to the log.

uvicorn main:app --reload            # http://localhost:8000, docs at /docs
```

The frontend (`lens-ref-web`) reaches this via `VITE_REFERRAL_API_URL`
(default `http://localhost:8000`).

Manual smoke: `POST /join {email}` → copy the `verify?token=...` URL from the log
→ `GET /verify?token=...` → note the `referral_code` → `POST /join {email2,
referral_code}` → verify it → `GET /status?code=<first>` shows `referral_count:1`.

---

## 8. Railway deployment

Deploy as its **own** Railway service (separate from `lens-api` and the Fastify
`backend`), pointed at the `referral-service/` subdirectory. Nixpacks auto-detect
+ `Procfile` + `.python-version` (`3.12`), same as `lens-api`. Set every env var
from §6 in the Railway dashboard (`DATABASE_URL` is the shared Postgres;
`PORT` is injected). Health check: `GET /health`. Redeploy: `railway up` from
`referral-service/`.
