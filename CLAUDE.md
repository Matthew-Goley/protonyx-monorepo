# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is intentionally detailed so that someone with no prior exposure to the project can act on it without reading every source file. Update it when the things it claims become wrong.

> **Keep this file current.** Whenever you change the codebase in a way that contradicts something written here — new endpoint, new column, new page, renamed file, removed feature, changed convention, version bump, new dependency, new env var — update the relevant section of `CLAUDE.md` *in the same change*. Treat the doc as part of the diff, not a follow-up. If the change touches the desktop app, update `app/CLAUDE.md` too. Drift is the single most expensive thing that can happen to this file: every stale claim costs the next session real time, so the rule is "if a future reader of this file would now be misled, fix it now."

---

## 1. What This Repo Is

**Protonyx** is an early-stage fintech building institutional-grade portfolio analytics for retail investors. This is the monorepo for the entire platform — backend API, web frontend, and the desktop app — held together by a single Postgres user database.

There are four deliverables:

| Product | Stack | Purpose |
|---|---|---|
| **Vector** (`app/`) | Python 3.12 + PyQt6, packaged with Nuitka | Downloadable Windows desktop app. Tracks positions, fetches market data via `yfinance`, and renders an analytics dashboard powered by a proprietary engine called **Lens**. Currently version **0.5.0**. The `app/` folder in this repo is a **stale, rarely-synced copy** — the canonical source of truth is `Vector-Main/` one level above the monorepo. |
| **Web frontend** (`frontend/`) | Plain static HTML/CSS/JS, served by VS Code Live Server | Marketing site, signup/login, account dashboard, direct app download. No framework, no bundler. |
| **Backend API** (`backend/`) | Fastify + TypeScript on Node, PostgreSQL | Authentication, account profile, download counter, and (eventually) the API the desktop app talks to. |
| **Lens API** (`lens-api/`) | Python FastAPI, deployed on Railway | Standalone analytics microservice. Live at `https://lens-api-production-b0ab.up.railway.app`. Accepts a portfolio over HTTP, runs the Lens engine, returns the full result dict. Currently called directly from `lens-app` in the browser (dev); intended to be proxied server-to-server via Fastify in production. |
| **Lens App** (`lens-app/`) | Vite + React + TypeScript | Web app for Lens analytics at `app.use-lens.com`. Calls lens-api directly (dev only) or via Fastify (prod). Stack: React Router, Tailwind CSS, shadcn/ui, Recharts, TanStack Query. |

The three components share **one user database** but **no build system** — each subdirectory is developed independently. There is no root `package.json`, no monorepo tooling (Turbo/Nx/Lerna), no Docker, no CI pipeline. Treat each top-level folder as a self-contained project.

The codebase is one developer's project on Windows 11 with Git Bash. Conventions reflect that: forward slashes in paths, LF line endings, no formal linter, no test suite anywhere.

---

## 2. Repo Layout

```
_monorepo/
├── backend/                       # Fastify + TypeScript REST API (PostgreSQL)
│   ├── src/
│   │   ├── server.ts              # Fastify bootstrap + plugin/route registration
│   │   ├── db.ts                  # pg Pool + dev-only DROP/CREATE/seed + idempotent ALTER migrations
│   │   ├── email.ts               # Resend send logic (welcome + verify + password reset)
│   │   ├── emailTemplates.ts      # Inline HTML strings for the three transactional emails
│   │   ├── version.json           # Single source of truth for the latest Vector version (served by GET /version)
│   │   ├── constants.ts           # Single source of truth for current TOS + EULA versions (CURRENT_TOS_VERSION, CURRENT_EULA_VERSION)
│   │   ├── betaConfig.ts          # BETA_ACTIVE kill switch + MAX_BETA_USERS cap, read from env (gates signup)
│   │   ├── middleware/
│   │   │   └── authenticate.ts    # JWT preHandler — checks Authorization: Bearer header first, falls back to session cookie
│   │   └── routes/
│   │       ├── auth.ts            # /signup, /login (sets httpOnly cookie + returns token), /logout, /verify-email, /forgot-password, /reset-password
│   │       ├── debug.ts           # /protected, /me, /download, /version
│   │       ├── legal.ts           # /legal/status, /legal/accept
│   │       └── beta.ts            # /beta/status (public signup-availability check)
│   ├── package.json
│   ├── tsconfig.json
│   ├── CLAUDE.md                  # Backend quick-start reference
│   └── .env                       # JWT_SECRET, DATABASE_URL, RESEND_API_KEY — gitignored
│
├── lens-api/                      # Python FastAPI analytics microservice (Railway)
│   ├── main.py                    # FastAPI app — POST /analyze, GET /health
│   ├── requirements.txt
│   ├── Procfile                   # uvicorn main:app --host 0.0.0.0 --port $PORT
│   ├── .env.example               # LENS_API_KEY, LENS_DATA_DIR
│   ├── parity_check.py            # Regression verification vs Vector-Main
│   ├── CLAUDE.md                  # Full service reference — read this before working in lens-api/
│   └── engine/                    # Lens computation package (extracted from Vector-Main/vector/)
│       ├── analytics.py / constants.py / lens_engine.py / monte_carlo.py
│       ├── paths.py               # MODIFIED: reads LENS_DATA_DIR env var for writable path
│       ├── store.py               # DataStore — yfinance wrapper with TTL JSON caching
│       └── lens/                  # 8 analyzers, CTA engine, sentence composers, assembler
│           └── templates/sentences.json
│
├── frontend/                      # Static site, one index.html per route
│   ├── index.html                 # Landing page (hero 2-col + discovery 3-video strip + trust strip + pricing section)
│   ├── style.css                  # Entry stylesheet — @imports the four files below in cascade order
│   ├── base.css                   # Resets, :root tokens, typography, button primitives
│   ├── chrome.css                 # Navbar, menu overlay, footer, auth-state toggles
│   ├── pages.css                  # Landing-section legacy + account page (+ dormant products listing & Vector product page CSS)
│   ├── auth.css                   # Auth/forgot/reset/verify page shells
│   ├── landing.css                # Landing-only styles (hero + discovery + trust strip + pricing + fade-in). Selectors for the removed value/lens/features/steps/final-cta sections are still in the file but currently unused. Loaded *only* by index.html, alongside style.css.
│   ├── script.js                  # Navbar logo swap, menu overlay, pricing billing-interval toggle, landing fade-in observer, download counter
│   ├── legal-modal.js             # window.showTosModal(): blocking TOS acceptance modal (loaded on protected pages)
│   ├── auth/
│   │   ├── index.html             # Tabbed login/signup form
│   │   └── auth.js                # All auth + session logic + GET /me helper
│   ├── account/index.html         # Profile dashboard (renders GET /me)
│   ├── verify-email/
│   │   └── index.html             # Standalone email-verification landing (loading/success/error)
│   ├── forgot-password/
│   │   └── index.html             # Standalone "request reset link" form
│   ├── reset-password/
│   │   └── index.html             # Standalone "set a new password" form (token in query string)
│   ├── about/ contact/ privacy/ tos/ eula/   # Static pages (privacy/tos/eula reuse the .tos-content Times New Roman legal styling)
│   ├── legal/                     # Source legal docs: tosmd.md, ppmd.md, eulamd.md + tos.pdf, pp.pdf, eula.pdf (each page's Download PDF button links /legal/*.pdf)
│   ├── assets/
│   │   ├── company/               # protonyx_full_white.png, _black.png
│   │   ├── product/vector/        # Vector product artwork (logo, dashboard, lens preview)
│   │   ├── video/                 # 1vector_demo.mp4, 2city.mp4, 3codingdemo.mp4, 4stockmarket.mp4, 5codingdemo.mp4
│   │   └── downloads/             # Vector-Setup.exe (placeholder installer served by the site Download buttons)
│   └── .vscode/settings.json      # Live Server pinned to port 5501
│
├── lens-app/                      # Vite + React + TS web app for Lens at app.use-lens.com
│   ├── src/
│   │   ├── api/lens.ts            # Typed API client (lensApi.analyze, lensApi.getTickerHistory)
│   │   ├── contexts/AuthContext.tsx  # isAuthenticated, loading, user, login(u,p), logout() — real Fastify auth, httpOnly session cookie
│   │   ├── components/
│   │   │   ├── ProtectedRoute.tsx # Redirects to /login if not authenticated
│   │   │   └── ui/               # shadcn/ui components: button, card, label, input, textarea, badge
│   │   ├── lib/utils.ts           # cn() tailwind merge utility
│   │   └── pages/                # Login, Dashboard, Portfolio (form + paywall), Results, Settings (subscription), Success
│   ├── package.json
│   ├── vite.config.ts             # Path alias @/ → src/
│   ├── tailwind.config.js         # shadcn CSS variable theme
│   └── components.json            # shadcn/ui config
│
├── app/                           # STALE copy of Vector desktop app — NOT the source of truth
│   │                              # Canonical desktop app code is in Vector-Main/ (one level above _monorepo/)
│   │                              # Do not use app/ as a reference; use Vector-Main/ instead
│   ├── main.py
│   └── vector/
│
├── scripts/                       # Admin / DB utility scripts — currently empty
├── database/                      # Legacy SQLite dir — gitignored, empty, no longer used
├── README.md                      # Public-facing repo blurb
├── CLAUDE.md                      # This file
└── .gitignore                     # node_modules/, .env, database/, dist/, .DS_Store, Thumbs.db
```

There is **no notes/journaling feature** anywhere. If you see references to a `notes` table, `notes` route, or a `noteRoutes` import, those are stale — delete them. The feature was scaffolded early as a smoke test and removed.

---

## 3. Common Commands

### Backend

Run from `backend/`:

| Task | Command | Notes |
|---|---|---|
| Install deps | `npm install` | |
| Dev server | `npm run dev` | `ts-node-dev src/server.ts`, hot-reloads, serves on `http://localhost:3000` |
| Typecheck | `npx tsc --noEmit` | No npm script — invoke `tsc` directly |
| Build | *(none)* | No build script. `ts-node-dev` runs TS directly in dev. There's no production build path yet. |
| Test | *(none)* | No test framework installed. Do not invent one. |
| Lint / format | *(none)* | No ESLint/Prettier. Match existing style. |

### Frontend

Served by **VS Code Live Server** — there is no npm/Vite/Webpack step.

- Default port is **5501** (locked in `frontend/.vscode/settings.json`).
- Open any `index.html` via the Live Server extension. Navigation uses **root-absolute paths** like `/auth/index.html`, so Live Server **must be rooted at `frontend/`** (not at the repo root) for links to resolve. If links 404, that is almost always the cause.
- Ports **5500** and **5501** (both `127.0.0.1` and `localhost`) are allowlisted by the backend CORS config. If Live Server picks a different port, every request to the API will fail CORS.

### Lens API

Run from `lens-api/`:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# Set required env vars, then:
set LENS_API_KEY=dev-secret-key
set LENS_DATA_DIR=C:/Users/Matthew/AppData/Local/Protonyx/Vector
uvicorn main:app --reload
# API at http://localhost:8000, docs at http://localhost:8000/docs
```

See `lens-api/CLAUDE.md` for full detail including the `POST /analyze` request/response shape and Railway deployment.

### Lens App (React frontend)

Run from `lens-app/`:

| Task | Command | Notes |
|---|---|---|
| Install deps | `npm install` | |
| Dev server | `npm run dev` | Vite HMR, serves on `http://localhost:5173` |
| Type check | `npx tsc --noEmit` | No build step needed in dev |
| Build | `npm run build` | Outputs to `lens-app/dist/` |

The dev server on port 5173 is the only origin the lens-api currently allows besides `https://app.use-lens.com`. Adding any other local origin requires editing the `allow_origins` list in `lens-api/main.py`.

Auth uses the real Fastify backend: `POST /login` is called with credentials, and the response sets an httpOnly `session` cookie. On mount, `AuthContext` validates the session via `GET /me` (cookie sent automatically). `POST /logout` clears the cookie. No token is stored in localStorage or JS-accessible state. `AuthContext` exposes `user.subscription_status` (`'inactive' | 'active' | 'cancelled'`), populated from the `/me` response.

The end-to-end analyze flow is **working**: enter positions as JSON on `/portfolio`, hit Analyze, and `/results` renders the brief, caution score, and CTA list returned by the live Railway API. The first request after a Railway cold start is slow (yfinance fetches for each ticker); subsequent requests for the same tickers hit the in-memory cache and are fast.

**Stripe paywall:** `/portfolio` checks `user.subscription_status !== 'active'` and renders an upgrade prompt instead of the form when not subscribed. The upgrade button hits `POST /stripe/create-checkout-session` and redirects to the returned Stripe Checkout URL. After successful payment, Stripe redirects to `/success`, which shows a confirmation message and redirects to `/dashboard` after 3 seconds. `/settings` shows the current subscription status and a "Manage Billing" button that hits `POST /stripe/portal` (only shown when status is active). The dev test user (`testuser`) is seeded with `subscription_status = 'active'` so the app is fully usable without going through Stripe in local dev.

### Vector desktop app

**The `app/` folder in this repo is stale.** Run the real desktop app from `Vector-Main/` (one level above `_monorepo/`):

```bash
cd Vector-Main
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

For Nuitka standalone builds, use `build.bat` (release, console disabled) or `build-debug.bat` (console enabled for tracebacks). Both wipe `.dist/` first.

### PostgreSQL (local dev)

The backend expects a running Postgres reachable via `DATABASE_URL`. Schema is created on each server boot by `db.ts`. There is **no migrations system** — the database evolves by editing `db.ts`.

`backend/.env` must contain (gitignored — do **not** commit, do not paste real values into chat or code):

```
JWT_SECRET=<any-string>
DATABASE_URL=postgresql://<user>:<pass>@<host>:<port>/<db>
RESEND_API_KEY=<resend-api-key>     # required only for welcome emails
BETA_ACTIVE=<true|false>            # optional, defaults to true; "false" closes all signups
MAX_BETA_USERS=<integer>            # optional, defaults to 50; hard cap on total user count
STRIPE_SECRET_KEY=sk_test_...       # Stripe secret key (test mode keys from dashboard)
STRIPE_WEBHOOK_SECRET=whsec_...     # Stripe webhook signing secret (from Stripe CLI or dashboard)
LENS_APP_URL=http://localhost:5173  # Frontend URL for Stripe redirect URLs; defaults to localhost:5173
```

A `backend/.env.example` documents all of these with placeholder values.

`BETA_ACTIVE` and `MAX_BETA_USERS` gate `/signup` only (see §4). They are read from `process.env` in `src/betaConfig.ts` so they can be toggled from the Railway dashboard without a redeploy. `BETA_ACTIVE` defaults to `true` and is only off when set to the literal string `"false"`; `MAX_BETA_USERS` defaults to `50`.

If `RESEND_API_KEY` is missing, signup still succeeds — `sendWelcomeEmail` is fire-and-forget and swallows errors so that email outages never break account creation.

---

## 4. Backend Architecture

### Request lifecycle

`src/server.ts` builds a Fastify instance and registers, in order:

1. **`@fastify/rate-limit`** — global, **20 requests / 60 seconds per IP**. This is low; you will hit it during frontend testing if you mash buttons. Don't bump it without a reason.
2. **`@fastify/cors`** — allowlists these origins:
   - `http://127.0.0.1:5500` / `http://localhost:5500`
   - `http://127.0.0.1:5501` / `http://localhost:5501` (static frontend Live Server)
   - `http://localhost:5173` / `http://127.0.0.1:5173` (lens-app Vite dev server)
   - `https://protonyxdata.com`
   - `https://app.use-lens.com`
   Methods: `GET, POST, DELETE, PATCH`. `credentials: true` is set so the lens-app can send the httpOnly session cookie. Adding any new origin (staging URL, another deployed frontend) requires editing this list in `server.ts`.
3. **Route modules**: `authRoutes`, `debugRoutes`, `legalRoutes`, `betaRoutes`, `stripeRoutes`, `subscriptionRoutes`. All are mounted at the **root path** with no prefix. The `/protected` and `/me` endpoints live under `debug.ts` for historical reasons even though they are not strictly debug, the `/legal/*` endpoints live under `legal.ts`, the public `/beta/status` endpoint lives under `beta.ts`, the Stripe checkout/portal/webhook endpoints live under `stripe.ts`, and `GET /subscription/status` lives under `subscription.ts`.

   `stripeRoutes` overrides the `application/json` content-type parser in its plugin scope to receive raw `Buffer` bodies - required for Stripe webhook signature verification. Non-webhook routes in that scope parse the buffer manually with `JSON.parse((request.body as Buffer).toString())`. The webhook route also sets `config: { rateLimit: false }` to skip the global rate limiter so Stripe can deliver events freely.

`db.ts` is imported transitively from the route modules. Its top-level `setup()` call fires on module load, which means **the server will not start cleanly without a reachable Postgres**.

Protected routes use `{ preHandler: authenticate }`. The middleware reads `Authorization: Bearer <token>`, verifies it with `JWT_SECRET`, and attaches `{ id, username }` to `request.user`.

### Database: schema and dev-only behavior

`db.ts` creates a single shared `pg.Pool` keyed off `DATABASE_URL`. On startup:

```sql
-- DEV ONLY (process.env.NODE_ENV === "development"): wipe users every boot
DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE IF NOT EXISTS users (
    id                  SERIAL PRIMARY KEY,
    username            TEXT UNIQUE NOT NULL,
    email               TEXT UNIQUE NOT NULL,
    password            TEXT NOT NULL,                       -- bcrypt cost 10
    plan                TEXT NOT NULL DEFAULT 'free',
    plan_expires_at     TIMESTAMP DEFAULT NULL,
    stripe_customer_id  TEXT DEFAULT NULL,
    email_verified      BOOLEAN NOT NULL DEFAULT FALSE,
    last_login          TIMESTAMP DEFAULT NULL,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    beta_access         BOOLEAN NOT NULL DEFAULT FALSE,
    download_count      INTEGER NOT NULL DEFAULT 0,
    tos_version_accepted TEXT DEFAULT NULL,
    tos_accepted_at     TIMESTAMP DEFAULT NULL,
    eula_version_accepted TEXT DEFAULT NULL,
    eula_accepted_at    TIMESTAMP DEFAULT NULL,
    subscription_status TEXT NOT NULL DEFAULT 'inactive',
    member_since        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Idempotent migrations applied on every boot (each try/catch wrapped):
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tos_version_accepted TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS eula_version_accepted TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS eula_accepted_at TIMESTAMP DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'inactive';

-- DEV ONLY: seed a known test account
INSERT INTO users (username, email, password, plan, beta_access)
VALUES ('testuser', 'test@protonyx.dev', <bcrypt('password123')>, 'free', true)
ON CONFLICT DO NOTHING;
```

The `verification_token` column holds a 64-char hex string (`crypto.randomBytes(32).toString("hex")`) issued at signup (and re-issued by `POST /resend-verification`) and cleared the moment `GET /verify-email` flips `email_verified=true`. A `NULL` token means either "already verified" or "never issued."

The `reset_token` / `reset_token_expires_at` pair is the same shape: a 64-char hex token issued by `POST /forgot-password` with a 1-hour `TIMESTAMP` expiry, both cleared the moment `POST /reset-password` succeeds. The DB-level expiry check uses `reset_token_expires_at > NOW()` so server clock skew between issuer and validator can never widen the window. Both columns are `NULL` whenever there is no active reset request.

The `tos_version_accepted` / `tos_accepted_at` pair tracks Terms of Service acceptance. `tos_version_accepted` holds the version string (e.g. `"3.1"`) the user last accepted; `tos_accepted_at` is the `TIMESTAMP` of that acceptance. The current version lives in `src/constants.ts` (`CURRENT_TOS_VERSION`); the user is considered "current" only when `tos_version_accepted` equals it. A `NULL` (or stale) value means the user must (re-)accept. Signup auto-accepts the current version; `POST /legal/accept` is what re-stamps both columns when the version is bumped. To re-prompt every user after a TOS change, bump `CURRENT_TOS_VERSION` and nothing else.

The `eula_version_accepted` / `eula_accepted_at` pair tracks End User License Agreement acceptance and is the same shape as the TOS pair, gated against `CURRENT_EULA_VERSION` (currently `"3.1"`) in `src/constants.ts`. The key difference: **EULA is not auto-accepted at signup**. Acceptance happens in the Vector desktop app and is recorded via `POST /legal/accept` with `{ document: "eula" }`. A new account therefore has `eula_version_accepted = NULL` until the app stamps it. `GET /legal/status` reports `eula_accepted` the same way it reports `tos_accepted`.

**Critical dev behavior:** when `NODE_ENV=development`, the users table is **dropped and recreated on every boot**. Every restart of `npm run dev` wipes all accounts and re-seeds `testuser` (password `password123`). This is intentional during early schema churn — there is no migration tooling, so dropping is the simplest way to apply schema changes. Do **not** run dev mode against a database that holds data you care about. In any other environment (`NODE_ENV !== "development"`), the `DROP` and seed are skipped and `CREATE TABLE IF NOT EXISTS` runs as normal.

All queries use parameterized `$1, $2, ...` placeholders. Never interpolate user input into SQL.

### Schema-evolution workflow

1. Edit the `CREATE TABLE` block (and seed block, if needed) in `db.ts`.
2. Restart `npm run dev` — the table is dropped and recreated.
3. To apply the same change to a non-dev environment, write SQL by hand and run it via `psql` (or whatever migration tool gets adopted later). The `IF NOT EXISTS` guard does **not** alter existing tables.

For columns added to an existing prod-shaped table, prefer the **idempotent `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` pattern** already in `setup()` (see `verification_token`). Wrap each `ALTER` in try/catch so a transient failure doesn't kill server boot. These run on every boot in every environment, which is the closest thing to a migration tool the backend has right now.

### Route module convention

Every route file exports a **default async function** that takes a `FastifyInstance`:

```ts
export default async function debugRoutes(app: FastifyInstance) {
  app.get("/me", { preHandler: authenticate }, async (request: any, reply: any) => { ... });
}
```

New route modules must be imported and `app.register(...)`'d in `server.ts`. There is **no auto-discovery**.

Protected handlers use `request: any, reply: any` to avoid the boilerplate of a `FastifyRequest` augmentation for `request.user`. This is a deliberate trade-off; preserve it when editing nearby code unless you are explicitly tightening types.

### Response shape

Every handler returns `{ success: boolean, message?: string, ...payload }`. Status codes are set explicitly with `reply.status(N).send(...)`. Conventions in use:

| Situation | Code |
|---|---|
| Resource created (signup) | 201 |
| Success with body | 200 (or implicit via returning an object) |
| Missing required fields | 400 |
| Bad credentials / no token / invalid token | 401 |
| User not found at login | 404 |
| Duplicate username or email at signup | 409 |

The error field is always named `message`. The frontend (`auth.js`) reads `data.message || data.error`, so either name works on the wire — but new endpoints should stick to `message` for consistency.

### Current endpoints

| Method | Path | Auth | Body | Behavior |
|---|---|---|---|---|
| `POST` | `/signup` | — | `{ username, email, password }` | **Beta-gated at the very top, before field validation** (see "Beta gating" below): returns 403 `{ success: false, message: "The open beta is currently closed. Check back soon." }` when `BETA_ACTIVE` is false, or 403 `{ success: false, message: "The open beta is currently full. Check back soon." }` when `SELECT COUNT(*) FROM users >= MAX_BETA_USERS`. If both gates pass: validates all three are present; rejects duplicate `username` or `email` (409); bcrypt-hashes (cost 10); inserts row **with `tos_version_accepted = CURRENT_TOS_VERSION` and `tos_accepted_at = NOW()`** (new accounts auto-accept the current TOS; the signup form carries the agreement notice); **issues a `crypto.randomBytes(32).toString("hex")` verification token and stores it on the row**; **fires `sendWelcomeEmail` and `sendVerificationEmail` fire-and-forget** (failures logged, never thrown); returns 201. |
| `POST` | `/login` | — | `{ username, password }` | The `username` field accepts **either a username or an email** (`WHERE username = $1 OR email = $1`). On success, stamps `last_login = CURRENT_TIMESTAMP`, signs a 7-day JWT (`{ id, username }`), **sets an httpOnly `session` cookie** (7-day `maxAge`, `sameSite: lax` in dev, `sameSite: none + secure` in prod), and returns `{ success, message, token }`. The token is also returned in the body for non-browser callers (desktop app, static frontend) that read it directly; browser clients should rely on the cookie. Login does **not** currently gate on `email_verified`. |
| `GET` | `/verify-email` | — | query: `?token=<hex>` | Looks up the user by `verification_token`. Missing or unknown token → 400 `{ success: false, message: "Invalid or expired verification token" }`. Found → sets `email_verified = true`, nulls `verification_token`, returns 200 `{ success: true, message: "Email verified successfully" }`. The token is single-use because it's cleared on success; re-clicking the link returns 400. |
| `POST` | `/resend-verification` | ✅ | — (empty body) | Looks up the authenticated user by `request.user.id`. User not found → 401. Already verified (`email_verified = true`) → 400 `{ success: false, message: "Email already verified" }`. Otherwise issues a fresh `crypto.randomBytes(32).toString("hex")` verification token, `UPDATE`s `verification_token`, fires `sendVerificationEmail` fire-and-forget, and returns 200 `{ success: true, message: "Verification email sent" }`. Fired by the "Send Verification Email" button on the account page. |
| `POST` | `/forgot-password` | — | `{ email }` | **Always returns 200 with `{ success: true, message: "If that email exists, you will receive a reset link" }`** — even when the email is missing, malformed, or unknown. This is account-enumeration defense; never special-case it back to a 404/400. When the email is registered, issues a 1-hour `reset_token`, persists it with `reset_token_expires_at = NOW() + 1h`, and fires `sendPasswordResetEmail` fire-and-forget. |
| `POST` | `/reset-password` | — | `{ token, newPassword }` | Validates both fields (400 `Token and new password are required` if missing). Looks up the row by `reset_token = $1 AND reset_token_expires_at > NOW()` so expiry is enforced at the DB level. Invalid/expired token → 400 `{ success: false, message: "Invalid or expired reset token" }`. Valid → bcrypt-rehashes (cost 10), nulls both reset columns, returns 200 `{ success: true, message: "Password reset successfully" }`. Single-use by construction (token cleared on success). |
| `GET` | `/protected` | ✅ | — | Smoke test. Returns `{ message: "Hello <username>" }`. |
| `GET` | `/me` | ✅ | — | Returns the full user profile **excluding `password`, `stripe_customer_id`, `verification_token`, `tos_accepted_at`, and `eula_accepted_at`**. Shape: `{ success, user: { id, username, email, plan, plan_expires_at, member_since, last_login, beta_access, download_count, email_verified, is_active, tos_version_accepted, eula_version_accepted, subscription_status } }`. (`tos_version_accepted` and `eula_version_accepted` are included so the client can reason about legal state; the `*_accepted_at` timestamps are deliberately omitted.) The frontend calls this on login and on every account-page load. |
| `POST` | `/download` | ✅ | — (empty body) | Increments `download_count` for the authenticated user. Fired by the shared `[data-download]` click handler in `script.js` (hero button + pricing Free card + per-page menu overlay link) for signed-in users only. Returns `{ success, message: "Download recorded" }`. The actual binary URL is **not** returned by this endpoint — the buttons download `/assets/downloads/Vector-Setup.exe` natively via the `download` attribute. |
| `GET` | `/version` | — | — | Public, no auth. Reads `src/version.json` (imported at module load via `resolveJsonModule`) and returns `{ success: true, version: "<x.y.z>" }`. **Single source of truth for the latest Vector release** — to ship a new version, edit `src/version.json` and nothing else on the backend. The frontend and the desktop auto-update check should both consume this endpoint rather than hardcoding the version. |
| `GET` | `/beta/status` | — | — | Public, no auth. Runs `SELECT COUNT(*) FROM users` and returns `{ success: true, open: boolean, spots_remaining: number }`. `open` is true only when `BETA_ACTIVE` is true **and** the user count is below `MAX_BETA_USERS`. `spots_remaining` is `max(0, MAX_BETA_USERS - count)` when `BETA_ACTIVE` is true, otherwise `0`. Lives in `routes/beta.ts`; both constants come from `src/betaConfig.ts`. Lets the frontend reflect signup availability. |
| `POST` | `/logout` | — | — | Clears the `session` httpOnly cookie. Returns `{ success: true, message: "Logged out" }`. Used by lens-app to end cookie-based sessions; the static frontend doesn't call this (it clears `localStorage` directly). |
| `GET` | `/legal/status` | ✅ | — | Compares the user's `tos_version_accepted` against `CURRENT_TOS_VERSION` and `eula_version_accepted` against `CURRENT_EULA_VERSION` from `constants.ts`. Returns `{ success: true, tos_accepted: boolean, eula_accepted: boolean, current_tos_version: "<v>", current_eula_version: "<v>" }`. Each `*_accepted` flag is `false` when the stored version is `NULL` or doesn't match the current version. User row not found → 401. The frontend's `checkLegalAcceptance()` (in `auth.js`) consumes this and **fails open** if the call errors. |
| `POST` | `/legal/accept` | ✅ | `{ document: "tos" \| "eula" }` | Validates `document` is exactly `"tos"` or `"eula"` (anything else → 400 `Invalid document`). For `"tos"`: sets `tos_version_accepted = CURRENT_TOS_VERSION` and `tos_accepted_at = NOW()`, returns 200 `{ success: true, message: "Terms of Service accepted" }`. For `"eula"`: sets `eula_version_accepted = CURRENT_EULA_VERSION` and `eula_accepted_at = NOW()`, returns 200 `{ success: true, message: "End User License Agreement accepted" }`. The TOS branch is fired by the "I Agree" button in the TOS modal (`legal-modal.js`); the EULA branch is fired by the Vector desktop app. |
| `POST` | `/stripe/create-checkout-session` | ✅ | — | Creates a Stripe Checkout session for the $10/month Lens Pro subscription. Uses inline `price_data` (no pre-created Price ID needed). Reuses `stripe_customer_id` if one is already on the user row; otherwise passes `customer_email` and Stripe creates the customer. Returns `{ success: true, url: "<stripe-checkout-url>" }`. Client should redirect to the URL. `success_url` points to `${LENS_APP_URL}/success`, `cancel_url` to `${LENS_APP_URL}/portfolio`. |
| `POST` | `/stripe/portal` | ✅ | — | Creates a Stripe Customer Portal session so the user can manage their subscription. Requires `stripe_customer_id` to be set on the row (only happens after first checkout). Returns `{ success: true, url: "<portal-url>" }` or 400 if no billing account exists. |
| `POST` | `/stripe/webhook` | — | Stripe event payload | Stripe webhook handler. Signature-verified with `STRIPE_WEBHOOK_SECRET`. Rate limiting skipped (`config: { rateLimit: false }`). Handles: `checkout.session.completed` (sets `subscription_status = 'active'`, stores `stripe_customer_id`), `customer.subscription.deleted` (sets `'cancelled'`), `invoice.payment_failed` (sets `'inactive'`). Matched to user rows via `metadata.userId` (checkout) or `stripe_customer_id` (subscription/invoice events). |
| `GET` | `/subscription/status` | ✅ | — | Returns `{ success: true, subscription_status: "inactive" \| "active" \| "cancelled" }` for the authenticated user. Thin alternative to `/me` for components that only need billing state. |

There is **no** `/notes`, `/getnotes`, `/notes/:id` endpoint. Earlier docs referenced them; they have been removed.

### Legal versioning (`src/constants.ts`)

`constants.ts` exports two constants, the single source of truth for each active legal document version:

- `CURRENT_TOS_VERSION` (currently `"3.1"`): the active Terms of Service version. `auth.ts` (signup auto-accept) and `legal.ts` (status comparison + accept stamping) both import it. **To re-prompt every signed-in user after a TOS change, bump this string and nothing else.** The next `GET /legal/status` they hit will report `tos_accepted: false` and the frontend modal will block them until they re-accept.
- `CURRENT_EULA_VERSION` (currently `"3.1"`): the active End User License Agreement version, consumed only by `legal.ts` (status comparison + accept stamping). **EULA is not auto-accepted at signup**; acceptance happens in the Vector desktop app via `POST /legal/accept` with `{ document: "eula" }`. Bumping this string makes the next `GET /legal/status` report `eula_accepted: false`.

If privacy-policy acceptance (or any further document) gets tracked the same way, add a sibling constant here and extend the `document` allowlist in `POST /legal/accept`.

### Beta gating (`src/betaConfig.ts`)

`betaConfig.ts` exports two env-driven values that gate account creation:

- `BETA_ACTIVE` = `process.env.BETA_ACTIVE !== "false"`: a manual kill switch. Defaults to `true` when unset; only `BETA_ACTIVE=false` (the literal string) closes signups.
- `MAX_BETA_USERS` = `parseInt(process.env.MAX_BETA_USERS || "50", 10)`: a hard cap on total user count. Defaults to `50`.

Both are read from the environment so they can be toggled from the Railway dashboard without a redeploy. They gate **only `POST /signup`**: the check sits at the very top of the handler, before field validation. If `BETA_ACTIVE` is false it returns 403 "The open beta is currently closed. Check back soon."; otherwise it runs `SELECT COUNT(*) FROM users` and, if the count is at or above `MAX_BETA_USERS`, returns 403 "The open beta is currently full. Check back soon." Login, forgot-password, reset-password, legal acceptance, `/me`, `/version`, and every other endpoint are **not** gated. The public `GET /beta/status` (in `routes/beta.ts`) reports the same open/spots-remaining state to the frontend. The count query is intentionally a plain `SELECT COUNT(*)`, fine at this scale.

### Email (`src/email.ts` + `src/emailTemplates.ts`)

Three exported functions in `email.ts`, all using the **Resend** SDK and all fire-and-forget from the caller's perspective. All three swallow errors with `console.error` so transactional-email outages never break the calling route. The HTML bodies live in `src/emailTemplates.ts` as three exported functions (`welcomeEmailHtml`, `verifyEmailHtml`, `resetPasswordEmailHtml`) returning the rendered string for a given username and URL — keeping them out of `email.ts` so the send logic stays scannable. Edit copy/styling there; edit send behavior in `email.ts`.

**`sendWelcomeEmail(to, username)`**

- Sender is `noreply@protonyxdata.com` (verified Resend domain), exported as `FROM_ADDRESS` at the top of `email.ts` and reused by all three functions — change in one place.
- The HTML body is inline-styled (table-based layout for email-client compatibility), uses the brand palette (`#0b1020` background, `#e7ebf3` text, `#2dd4bf` CTA), and its "Download Vector" CTA links to `https://protonyxdata.com/#plans` (the plans section of the landing page, where the download buttons live). The URL is hardcoded in `email.ts` (the `downloadUrl` local passed to `welcomeEmailHtml`); update it there if the domain or anchor changes.
- The function logs `Resend key inside function: <bool>` before sending. That log line is debugging instrumentation; remove it before any meaningful production deployment.

**`sendVerificationEmail(to, username, token)`**

- Same sender, same dark/teal styling, same try/catch behavior.
- Builds the link as `http://localhost:5500/verify-email/index.html?token={token}`. The localhost host is marked with a `// TODO: replace localhost with production domain` comment — update it (and consider extracting to an env var) before the frontend is deployed.
- Subject: `Verify your Protonyx email`. Heading: `Verify your email, {username}.` Body: short instruction + `Verify Email` CTA button.
- Cannot be fully exercised end-to-end until a Resend domain is verified; the route itself works against the local DB without any email actually being delivered.

**`sendPasswordResetEmail(to, username, token)`**

- Same sender, same dark/teal styling, same try/catch behavior.
- Builds the link as `http://localhost:5500/reset-password/index.html?token={token}` with the same `// TODO: replace localhost with production domain` marker. When the verify-email URL is updated, update this one in lockstep.
- Subject: `Reset your Protonyx password`. Heading: `Password reset requested, {username}.` Body explicitly mentions the **1-hour expiry** and tells the recipient to ignore the email if they didn't request a reset (anti-confusion + anti-phishing language).
- Same caveat as the other transactional emails: real delivery requires a verified Resend domain; the `/forgot-password` route still functions against the DB without it (the token is written, the email send fails silently).

### Dependencies — quick map

| Dep | Used for |
|---|---|
| `fastify` | HTTP server |
| `@fastify/cors` | CORS middleware (origin allowlist, credentials) |
| `@fastify/cookie` | httpOnly session cookie (set on login, cleared on logout, read by authenticate middleware) |
| `@fastify/rate-limit` | Global rate limit (20/60s) |
| `pg` | PostgreSQL pool |
| `bcrypt` | Password hashing (cost 10) |
| `jsonwebtoken` | JWT signing/verification |
| `dotenv` | Loads `.env` (imported via `import "dotenv/config"` in `server.ts`) |
| `resend` | Transactional email (welcome only, for now) |
| `stripe` | Stripe SDK — Checkout sessions, billing portal, webhook signature verification |
| `better-sqlite3` + `@types/better-sqlite3` | **Dead.** Leftover from the SQLite era before the Postgres migration. Nothing in `src/` imports it. Safe to remove from `package.json`. |

`ts-node-dev` and the `@types/*` packages are devDeps. `typescript` is a devDep but there is no compile step in the npm scripts.

---

## 5. Frontend Architecture

### Stack

Plain static HTML + CSS + vanilla JS. **No framework, no bundler, no build step.** The only external font is IBM Plex Mono from Google Fonts, loaded via `<link>` on every page. CSS is split across `style.css` (which `@import`s `base.css` + `chrome.css` + `pages.css` + `auth.css`) and a landing-only `landing.css` that the landing page loads in addition to `style.css`.

### Page structure

Each route is a folder with an `index.html`. To add a page:

1. Create `frontend/<slug>/index.html`.
2. Link `../style.css`, `../script.js`, and `../auth/auth.js` with the right relative depth (every current page is one level under `frontend/`, so `../`; a more deeply nested page would need `../../`).
3. Add the site-wide favicon link `<link rel="icon" type="image/png" href="../assets/product/vector/vector_small.png">` in the `<head>` (every page carries this, with the right relative depth). The landing page also sets `<title>Vector</title>`; subpages use `<title>{Page} | Protonyx</title>`.
4. Copy the `<nav class="navbar">` block and the `.menu-overlay` block from an existing page — they are **duplicated per-page**, not componentized. Updating them means editing every page that uses them.
5. Use root-absolute links (`href="/about"`, `href="/auth/index.html"`) — Live Server must be rooted at `frontend/`.
6. End the `<body>` with the standard footer, then load `script.js` and `auth/auth.js`, then a small `<script>checkAuth();</script>` if the page hasn't already wired it up.

### Navigation bar (every page)

The nav has these states managed via CSS classes that `auth.js` toggles:

- `.navbar-signup-link.guest-only` — "Create Account" link (points to `/auth/index.html?mode=signup` so the auth page opens on the Create account tab), shown only when logged out.
- `.navbar-plan-badge.pro-only` — a plain-text "Professional" badge sitting immediately to the left of the profile icon, shown only when the signed-in user's cached `plan` is `"pro"` (see the `.pro-only` toggle in `checkAuth()`). It is not a link. Its text color follows the same white/black swap as the rest of the navbar (white by default, dark under `.navbar--light`).
- `.navbar-profile-icon.auth-only` — circular profile SVG linking to `/account/index.html`, shown only when logged in.
- `.navbar-menu-button` — hamburger, always visible, opens the full-screen menu overlay.

The navbar logo follows the section that currently sits beneath it. Any dark section on the page (`.landing-hero`, `.products-hero`, or any `.lp-section.dark`) triggers the white logo while it covers the navbar; everywhere else uses black. `script.js` listens to `scroll` and `resize`, probes a fixed y-coordinate (80 px) on every event, and swaps `#navbarLogo`'s `src` between `protonyx_full_white.png` and `protonyx_full_black.png` with a 200 ms opacity fade. Both images are preloaded.

### Menu overlay (every page)

`#menuOverlay` is a full-viewport panel with two columns: **Navigation** and **Account**. Account links use the same `.guest-only` / `.auth-only` toggle pattern. The hamburger button opens it (locks `body` overflow, fades the navbar to opacity 0); a close button or backdrop click dismisses it. Same caveat as the navbar — the markup is duplicated per page. In the Account column, the "Create Account" link points to `/auth/index.html?mode=signup` (opens the signup tab) while the "Login" link points to plain `/auth/index.html` (default Sign in tab). The shared `.menu-link-reveal` rule carries a small `padding-bottom` so the reveal `clip-path` (combined with the tight `line-height: 1.05`) does not crop lowercase descenders, e.g. the "g" in "Login"; do not remove it.

### CSS system

Every page links a single stylesheet (`style.css`), which is now a thin shim that `@import`s four files in cascade order. **Edit the split files, not `style.css`** — `style.css` is just the entry point:

| File | Contains |
|---|---|
| `base.css` | `*` reset, `:root` tokens, `html`/`body`, `h1`–`h3`/`p`, button primitives (`.btn-primary`, `.btn-ghost`, `.btn-grad`, `.btn-outline-gray`), the `h1` mobile size override |
| `chrome.css` | Floating navbar, navbar profile/signup auth toggles, the `.navbar-plan-badge` Pro badge (white/black text swap under `.navbar--light`), full-screen menu overlay (incl. logout button + reveal animation), site footer |
| `pages.css` | Legacy `.hero` (no longer used by `index.html`) and the account page, plus the `.access-card .btn-ghost` light-bg override. Also retains the products-listing-hero and full Vector-product-page rules (hero, sections, lens outputs, access pricing cards, flow stepper, closing CTA) even though those pages were removed; kept dormant for possible reintroduction. |
| `auth.css` | `.auth-body` shell + auth card, tabs, form, inputs, submit button, message states, footer/forgot links, the `.auth-terms-note` signup TOS notice — used by `auth/`, `verify-email/`, `forgot-password/`, `reset-password/` |
| `landing.css` | **Loaded only by `index.html` (alongside `style.css`).** Active selectors today: `.landing-hero` (dark two-column hero with pulsing radial gradient and a max-width of 1840 px scaled for 4K), `.landing-hero-actions` (hero CTA row, sized for the Windows-icon download button), `.demo-window` + `.demo-video` (macOS-frame video container, reused by both the hero and the discovery cards), `.lp-section` primitives (`.base` / `.surface` / `.dark`), `.lp-eyebrow`, `.lp-h2`, `.lp-lead`, the `.discovery-grid` family (`.discovery-card`, `.discovery-text`, `.discovery-step`, `.discovery-num`, `.discovery-title`, `.discovery-caption`: vertically-stacked numbered video walkthrough on a dark `.lp-section`, video on the left of each row, gradient step number + title + caption on the right), the `.trust-strip` family (`.trust-row`, `.trust-item`, `.trust-icon`, `.trust-label`, `.trust-sub`: narrow light divider between discovery and pricing with reduced vertical padding), the `.pricing-toggle` family (centered Monthly/Annually segmented control with an animated sliding `.pricing-toggle-thumb`), `.pricing-grid` + `.pricing-card`, and `.fade-in` (toggled by `IntersectionObserver` in `script.js`). The file also retains rules for the removed mid-page sections (`.value-grid`, `.lens-engine`, `.lens-cards`, `.feature-grid-6`, `.steps-grid`, `.final-cta`); those selectors don't match anything on the current page but are kept so the sections can be reintroduced cheaply. Reuses `:root` tokens and the teal/blue brand gradient. No new design system. |

CSS custom properties are defined in `:root` at the top of `base.css`. The most-used tokens:

```css
--bg-base: #f2f1ee        /* off-white page background */
--bg-surface: #d7d4d4     /* card/panel background */
--border: rgb(142,142,142)
--text-primary: #1f2230
--grad: linear-gradient(135deg, #3a8c6e, #2a6b9a)   /* brand gradient, used by .btn-grad and .plan-pro */
```

Use these tokens; do not hardcode colors. The navbar floats at the top with a blurred glass effect (`backdrop-filter: blur(10px)`).

Cascade order matters: `base` → `chrome` → `pages` → `auth`. Don't reorder the imports without checking that page-specific overrides still win. If you split out a fifth file, add it to `style.css`'s `@import` block in the right slot.

### `script.js` (shared across pages)

Five independent blocks, each guarded by `if (element)` so pages without the relevant element are no-ops:

1. **Navbar logo color swap** (described above). Collects every dark section on the page (`.landing-hero, .products-hero, .lp-section.dark`) and probes a fixed y-coordinate near the navbar baseline (80 px) on every `scroll` and `resize` event. If any dark section's bounding rect covers that point, the logo fades to white; otherwise to black, with a 200 ms opacity fade on each transition. The `.lp-section.dark` selector is currently in use by the discovery section on the landing page (which sits directly under the hero), so the logo stays white through both. (The legacy fullscreen `#heroVideo` rotation block was removed when the landing page was rebuilt; the current hero plays a single looping `1vector_demo.mp4` inside `.demo-window` with no JS.)
2. **Menu overlay open/close** — described above.
3. **Pricing billing-interval toggle** — on the landing page, clicking the Monthly/Annually segmented control inside `.pricing-toggle` rewrites every `.pricing-price[data-annual-amount]` element from its `data-{interval}-amount` + `data-{interval}-period` attributes. Default is annual ($100 / year for Professional; monthly is $10 / month). The Free card has no data attributes so it stays "$0 / forever" regardless of toggle state.
4. **Landing fade-in observer** — every `.fade-in` element on the landing page gets a `.visible` class when it intersects the viewport (`threshold: 0.15`, `rootMargin: 0 0 -40px 0`). One-shot — observer unobserves each element after firing.
5. **Download counter** — binds a click handler to every `[data-download]` element (the hero + pricing download buttons and the per-page menu "Download" link). Those elements are native `download` anchors pointing at `/assets/downloads/Vector-Setup.exe`, so the browser handles the file download; the handler additionally fires `POST /download` (Bearer-authenticated) to bump `download_count`, but only when a `token` is present and `API_URL` (from `auth/auth.js`) is defined. A missing token or a failed counter call never blocks the download.

### `auth/auth.js` (shared auth + session state)

Globally exposes `getToken()`, `authHeaders()`, `login()`, `signup()`, `loadProfile()`, `logout()`, `checkAuth()`, `checkLegalAcceptance()`.

- `API_URL = "http://localhost:3000"` — **hardcoded at the top of the file**. Update here when the backend is deployed. There is no env-var injection.
- JWT is stored in `localStorage.token`; **httpOnly cookies are not used.**
- The login form accepts a username **or** an email — the field is labeled "Username or Email" and the value is sent as `{ username, password }`. The backend resolves both.
- Signup form fields: `username`, `email`, `password`. The form posts to `/signup` and on success switches to the login tab via `switchToLoginTab()` (defined inline in `auth/index.html`).
- The page defaults to the **Sign in** tab, but when loaded with `?mode=signup` in the query string the inline script calls `switchToSignupTab()` on load and it opens on the **Create account** tab instead. The "Create Account" links in the navbar and menu overlay (every page) use this; the "Login" links omit the param and land on Sign in.
- `loadProfile()` calls `GET /me` with `authHeaders()` and mirrors fields into `localStorage`: `username`, `email`, `plan`, `member_since`, `beta_access` (`"true"`/`"false"`), `download_count` (string-coerced). It is called from `login()` after the token is stored, and from any page that wants fresh profile data (e.g. the account page).
- `logout()` clears every profile-related localStorage key (`token`, `username`, `email`, `plan`, `member_since`, `beta_access`, `download_count`) and redirects to `/auth/index.html`.
- `checkAuth()` runs on every page load (via `DOMContentLoaded`, or directly if the script loads after parse) and:
  - Toggles `.visible` on `.auth-only` and `.guest-only` elements.
  - Toggles `.visible` on `.pro-only` elements when the user is logged in **and** the cached `plan` (lowercased) is `"pro"` — drives the navbar "Professional" badge. Plan comes from localStorage (mirrored by `loadProfile()`), so on pages that don't refetch `/me` it reflects the plan as of the last profile load.
  - Replaces text content of `[data-username]` elements with the stored username (falling back to `"User"`).
  - Binds a click handler on `[data-logout]` elements that calls `logout()` (idempotent — uses `dataset.logoutBound` to avoid duplicate listeners).
- A `storage` event listener re-runs `checkAuth()` when `token`, `username`, or `plan` changes in another tab, so logging out (or a plan change) in one tab updates all open tabs.
- Some pages call `checkAuth()` explicitly in an inline script after loading `auth.js`. Both patterns coexist; do not remove one without checking the other still works.
- `checkLegalAcceptance()` is **async** and gates on Terms of Service acceptance. It resolves immediately when logged out (no token). Otherwise it calls `GET /legal/status`; if `tos_accepted` is `false` it calls `showTosModal()` (from `legal-modal.js`, which must be loaded on the page) and awaits the user's acceptance. It **fails open**: any error on the status call is logged to the console and the user is let through, never blocked. Only protected pages that load `legal-modal.js` and call this (currently just the account page) prompt for TOS; do not wire it into the landing/auth/verify/forgot/reset pages.

### TOS acceptance modal (`legal-modal.js`)

`frontend/legal-modal.js` is an IIFE that attaches a single global, `window.showTosModal(onAccept?)`. It builds a fixed full-viewport overlay (dark translucent backdrop + centered light card styled with the `--bg-base`/`--text-primary`/`--border`/`--grad` tokens, no separate stylesheet) titled "Terms of Service", with a short re-acceptance message, a "Review the Terms of Service" link to `/tos` (opens in a new tab), and a single "I Agree" button. It returns a promise that resolves once acceptance succeeds.

- **Blocking by design.** There is no close button; backdrop clicks are inert; a capture-phase `keydown` listener swallows `Escape` while the modal is open (so the menu-overlay Escape handler can't dismiss it). `body` overflow is locked while it is open. The only exit is a successful `POST /legal/accept`.
- "I Agree" POSTs `{ document: "tos" }` to `/legal/accept` with `authHeaders()`. The button is disabled on click and re-enabled on error (guards against double-submit). On success it removes the overlay, fires the optional `onAccept` callback, and resolves the promise.
- **401 during accept** (expired JWT) → calls `logout()` (falling back to a redirect to `/auth/index.html`) instead of trapping the user.
- **Network failure / non-OK response** → shows the error in the modal and keeps it open so the user can retry.
- Depends on `API_URL`, `authHeaders()`, and `logout()` from `auth/auth.js`, so it must be loaded **after** `auth.js`.

### Landing page (`index.html`)

The landing page has four content sections in order: navbar, hero, discovery (dark, three looping videos), trust strip (light, narrow privacy divider), pricing, footer. Earlier versions had value-props, a Lens-engine spotlight, a features grid, a getting-started steps section, and a final-CTA section, all of which were deleted in a trimming pass. The selectors for those sections still live in `landing.css` so re-adding any of them only requires the HTML.

**Hero (`.landing-hero`)** is a full-height dark section with a pulsing radial gradient and a two-column grid:

- **Left column.** h1 reads `Actionable Insight for Everyone.` with three `.accent`-gradient words (`Actionable`, `Insight`, `Everyone`). Below it sits a single-sentence subtitle leading with the Lens engine. Two CTAs:
  - `btn-primary` **Download for Windows** with an inline 4-rectangle Windows-logo SVG (the `.btn-icon` rule sizes it to 18 px and adds a 0.65 rem gap). It carries `href="/assets/downloads/Vector-Setup.exe" download data-download`, so the browser downloads the installer directly (no intermediate page).
  - `btn-ghost` **View plans**, an in-page anchor to `#plans`.
- **Right column.** `.demo-window` is a macOS-style frame (three traffic-light dots + body) wrapping a single looping autoplaying muted video, `assets/video/1vector_demo.mp4`. No JS rotation, no audio.

Hero typography is scaled aggressively for 4K: h1 uses `clamp(2.6rem, 4.8vw, 5.75rem)`, subtitle `clamp(1.05rem, 1.2vw, 1.4rem)`, container max-width 1840 px, and 3.5% horizontal padding instead of the older 6%.

**Discovery (`.lp-section.dark`)** sits directly under the hero and keeps the dark background so the navbar logo stays white through it. Eyebrow `The Workflow` + h2 `Three steps. One loop.` (`.lp-h2`), then a vertically-stacked `.discovery-grid` of three `.discovery-card`s. Each card is a two-column grid (video left, text right) with a large `.demo-window` (same macOS-frame markup as the hero, body forced to 16:9 via `aspect-ratio`, browser-chrome bar holds just the three traffic-light dots, no fake tab inside) wrapping a looping autoplaying muted `playsinline` video. The text column holds a `.discovery-step` row pairing a large gradient `.discovery-num` (`1` / `2` / `3`) with a bold `.discovery-title` (`Enter.` / `Read.` / `Act.`), and a muted `.discovery-caption` beneath. Video sources: `assets/video/discovery_enter.mp4`, `discovery_read.mp4`, `discovery_act.mp4` (files to be recorded and dropped in later; the markup references them already). Each card carries `.fade-in` so the existing `IntersectionObserver` fades it in on scroll. At 960 px the per-card two-column grid collapses to one column (video on top, centered text below).

**Trust strip (`.lp-section.base.trust-strip`)** is a narrow light divider between the discovery section and pricing. Vertical padding is overridden to `3rem 3.5%` (and `2.5rem 6%` at 640 px) so it reads as a divider, not a full section. No eyebrow, no heading. `.trust-row` is a flex row of three `.trust-item`s: each is a teal-colored inline SVG icon (`.trust-icon`, single-color `currentColor` set to `#2dd4bf`, ~30 px) next to a `.trust-text` block of `.trust-label` (bold dark) + `.trust-sub` (muted dark). Copy: `Desktop app.` / `Your data never leaves your machine.`, `No brokerage link.` / `Just tickers and share counts.`, `No account to start.` / `Download and go.`. Stacks vertically at 640 px. The whole `.trust-row` is `.fade-in`.

**Pricing (`#plans`, `.lp-section.base`)** has the heading `Start free.` / `Upgrade when you outgrow it.` (split across two lines with `<br>`), followed by a billing-interval toggle and two cards:

- **`.pricing-toggle`** is a centered pill containing two `.pricing-toggle-option` buttons (Monthly / Annually), a sliding `.pricing-toggle-thumb` (gradient, `transform: translateX(...)` driven by `data-interval` on `.pricing-toggle-group`, eased over 0.35 s with `cubic-bezier(0.4, 0, 0.2, 1)`), and a `.pricing-toggle-badge` ("Save 17%") absolutely positioned to the right of the pill (hidden under 640 px). Annual is the default on initial render.
- **Free card.** `$0 / forever`, ghost CTA "Download Vector" that downloads `/assets/downloads/Vector-Setup.exe` directly (same `download` + `data-download` attributes as the hero button). Not affected by the toggle.
- **Professional card.** Carries `data-monthly-amount="$10"`, `data-monthly-period=" / month"`, `data-annual-amount="$100"`, `data-annual-period=" / year"` on its `.pricing-price` element. When the toggle flips, the JS block in `script.js` rewrites the inner HTML from those attributes. Primary CTA "Upgrade to Pro" links to `#` for now (TODO marker in the markup; replace with a real Stripe checkout URL once provisioned).

The in-page menu overlay reflects this trimmed page: under **Navigation** it lists only `Home`, `Plans`, `About`, `Contact`, plus the auth-aware logout button. The old `Lens Engine` and `Features` entries were removed when those sections were deleted.

**When you change this page, also touch this subsection.** Hero copy, button labels, the prices on the Pro card, the data attributes on `.pricing-price`, and which sections render are the load-bearing claims here. Drift in any of them sends future agents looking for elements that don't exist.

### Account page (`account/index.html`)

A self-contained dashboard rendered inline at the bottom of the HTML. Renders six fields from `GET /me`:

| DOM id | Source | Notes |
|---|---|---|
| `infoUsername` | `user.username` | |
| `infoEmail` | `user.email` + `user.email_verified` | Email value is wrapped in a `.email-badge` span that gets a `.verified` (muted green) or `.unverified` (muted red) class from `email_verified`. A small `.btn-verify` outline button ("Send Verification Email") sits on the right of the row, shown only when unverified; clicking it POSTs to `/resend-verification` with `authHeaders()`, disables itself in flight (stays disabled after a successful send), and writes an inline `#verifyMessage` ("Verification email sent" / error text). The badge/button styles live in the page's `<style>` block. `email_verified` is mirrored into `localStorage` by this page (not by `loadProfile()`) so the localStorage-first paint is accurate on repeat visits. The button hits the protected `POST /resend-verification` route in `auth.ts`. |
| `infoPlan` | `user.plan` | Capitalized; gets the `.plan-pro` class (transparent text + brand gradient via `background-clip: text`) when value is `"pro"`. |
| `infoMemberSince` | `user.member_since` | Formatted with `toLocaleDateString` (long month, numeric year/day). |
| `infoBetaAccess` | `user.beta_access` | Rendered as `"Enabled"` / `"Not enabled"`. |
| `infoDownloadCount` | `user.download_count` | |

**Render flow:** on load, the page first paints from cached localStorage values (so there's no blank flicker), then calls `loadProfile()` and re-renders with the authoritative server response. If the user has no token, the page redirects immediately to `/auth/index.html`. The hero label (`#accountHeroTitle`) shows the cached username.

**TOS gate.** The page loads `../legal-modal.js` (after `../auth/auth.js`) and, once the token check has confirmed the user is logged in, calls `checkLegalAcceptance()`. If the user hasn't accepted the current TOS version, the blocking modal appears and stays up until they accept. This is the **only** page wired to the legal check today; if you add another protected page that should enforce TOS, copy both the `legal-modal.js` script tag and the `checkLegalAcceptance()` call.

### Downloads (no dedicated page)

There is **no** standalone download page. The Vector installer is served as a static asset at `/assets/downloads/Vector-Setup.exe` — currently a **placeholder file**; replace its contents with the real Nuitka build output (`Vector-v<version>.exe`) on each release, keeping the filename so the URL stays stable. The site downloads it directly from three places, all of which carry `href="/assets/downloads/Vector-Setup.exe" download data-download`:

1. The hero **Download for Windows** button (`index.html`).
2. The pricing Free card **Download Vector** button (`index.html`).
3. The **Download** link in every page's menu overlay (Account column).

The browser's native `download` attribute does the actual file download, so it works with JS disabled and for logged-out visitors. The shared `[data-download]` click handler in `script.js` additionally fires `POST /download` (Bearer-authenticated) to bump `download_count` for signed-in users only; a missing token or a failed counter call never blocks the download. There is **no** auth gate, ToS/EULA disclaimer, or version label in front of the download anymore — the dedicated page that once carried those (and the per-release version label) was removed in favor of these direct buttons.

### Verify-email page (`verify-email/index.html`)

Standalone landing page hit by the link in the verification email. Deliberately bare — **no navbar, no footer, no menu overlay** — since the user might not be signed in and the page is intentionally one job. It loads `../style.css` and reuses `../auth/auth.js` purely to pick up `API_URL`.

Flow on load:

1. Reads `token` via `new URLSearchParams(window.location.search).get("token")`. Missing token → renders the error state immediately without hitting the API.
2. Renders the **loading** state (`Verifying your email...`).
3. `fetch("${API_URL}/verify-email?token=" + encodeURIComponent(token))` (GET, no body, no auth header — written as a template literal in the source).
4. Renders one of two terminal states:
   - **Success**: checkmark, large `Email verified.`, and a muted subline ("You can now close this page and log in."). No button or link (the user is told to close the page rather than routed to sign in).
   - **Error**: exclamation icon, `Verification failed.`, the API's `message` (or a network-fallback string), and a "Back to sign in" link.

All three states are rendered into a single `#verifyState` container by inline `render*()` helpers — markup is intentionally local to this page rather than added to `style.css`, since nothing else uses these styles.

### Forgot-password page (`forgot-password/index.html`)

Standalone centered page (no navbar, no footer) reachable from the **"Forgot your password?"** link on `auth/index.html`. Loads `../style.css` and `../auth/auth.js` only for `API_URL`. Single email input → `POST /forgot-password` with `{ email }`. **Always renders the same success message** ("If that email is registered you will receive a reset link shortly.") on a 200 response, regardless of whether the email is real — the backend already enforces account-enumeration defense, and the UI must match. Disables the submit button on success to discourage rapid-fire submissions; re-enables on error. The "Back to login" link points to `../auth/index.html`.

### Reset-password page (`reset-password/index.html`)

Same shell as the forgot-password page. Reads `?token=` via `URLSearchParams` on load:

- **No token** → renders an "Invalid reset link." state with a link back to `../forgot-password/index.html` to request a fresh one. Never POSTs anything.
- **Token present** → renders the form (new password + confirm password). Client-side validation: both fields populated, both fields match. Submitting POSTs `{ token, newPassword }` to `/reset-password`. On success, the form is replaced in-place with a "Password reset successfully." panel + a link to `../auth/index.html`. On failure (400 from the backend, typically expired/invalid token), shows the API's `message` and re-enables the submit button.

Like the verify-email page, the three render states are inline `render*()` helpers writing into `#resetState`. The page does **not** validate password strength client-side — bcrypt-cost-10 absorbs whatever the user types. If a strength policy gets added, enforce it both here and in the backend route.

### Auth-page link

`auth/index.html` shows a small muted **"Forgot your password?"** link directly under the login form's submit button, styled by `.auth-forgot-link` in `style.css`. The link is in the login form only (not the signup form) and points at `../forgot-password/index.html`.

The **signup form** carries a small muted notice under its submit button: "By creating an account, you agree to our Terms of Service." (the last words link to `/tos`, new tab), styled by `.auth-terms-note` in `auth.css`. There is **no** TOS checkbox; acceptance is recorded server-side automatically at signup (see the `/signup` row: it stamps `tos_version_accepted`/`tos_accepted_at`). The notice is what makes that auto-acceptance meaningful; keep it in lockstep with that behavior.

### Auth UX gotcha (was a real issue, now fixed — keep an eye on it)

The backend always names its error field `message`. Earlier versions of the frontend read `data.error`, so backend error messages never surfaced to users. The current `auth.js` reads `data.message || data.error`, which works against either field. If you add a new endpoint, prefer `message` and don't rely on the fallback.

---

## 6. Vector Desktop App

**The `app/` folder in this repo is a stale, rarely-synced copy of the desktop app. Do not use it as a reference or run code from it.** The canonical source of truth for all desktop app and Lens engine code is `Vector-Main/` one level above this monorepo. `Vector-Main/CLAUDE.md` is the authoritative reference for that code.

This section is a **map** of what the Vector app does (for context), not a substitute for `Vector-Main/CLAUDE.md`.

### High-level

- **Entry point:** `app/main.py` → `vector.app.main()`.
- **Stack:** Python 3.12, PyQt6, `yfinance` for market data, `pandas`/`numpy` for math, `matplotlib` for charts, `lxml`/`bs4`/`requests`/`urllib3`/`certifi` as transitive yfinance deps.
- **Build tool:** Nuitka standalone (`build.bat`, `build-debug.bat`). The build command pins specific `--include-package` flags for the yfinance dep tree because Nuitka misses them statically.
- **Persistence:** all user data lives under `%LOCALAPPDATA%/Protonyx/Vector/` on Windows (or `~/Vector/data/` as fallback). Six JSON files: `positions.json`, `settings.json`, `app_state.json`, `market_data.json`, `dashboard_layout.json`, `lens_history.json`.
- **No tests.** Manual verification only.

### Top-level package layout (`app/vector/`)

| File / dir | Role |
|---|---|
| `app.py` | Thin shell: stylesheets, `MainShell`, `VectorMainWindow`, `_ShortcutsDialog`, `main()`. Page classes live in `pages/`, not here. |
| `pages/dashboard.py` | `DashboardPage`, `DashboardGrid`, `WidgetPickerDialog`, grid sizing constants (`_UNIT`, `_GAP`, `_CELL`, `_CONTENT_W = 1090`). |
| `pages/lens_page.py` | Full Vector Lens page: `VectorLensPage`, `_GraphCard`, `_PieCard`, `_CTAReportCard`, `_CautionCard`, `_MCContextCard`, `_LensHistoryDialog`, `_LensHistoryCard`, `_CautionBadge`. |
| `pages/onboarding.py` | First-run wizard: `OnboardingPage`, `PositionDialog`, `PositionCard`, `_RiskTierCard`. |
| `pages/profile.py` | `ProfilePage`. |
| `pages/settings.py` | Settings page with seven accordion sections plus static cards. Includes `SettingsPage._export_to_csv` (Export Positions to CSV). |
| `analytics.py` | Portfolio math: linear-regression slope, annualized volatility, Sharpe ratio, beta, insight-text composition. |
| `store.py` | `DataStore` — single source of truth for positions, settings, app state, market data, layout. Use this; do **not** reach into `StorageManager`/`MarketDataService` directly. |
| `lens_engine.py` | Thin wrapper: `generate_lens()` (canonical 7-tuple) and `generate_lens_full()` (full result dict). |
| `lens/` | The Lens engine package — see below. |
| `monte_carlo.py` | `run_projection()` and `build_historical_curve()` — GBM-based projection used for the Lens Projections graphs. |
| `widget_base.py` | `VectorWidget` — base `QFrame` for all dashboard widgets; handles edit-mode drag and right-click delete. |
| `widget_registry.py` | `discover_widgets()` / `get_widget_class()` — registry of concrete widget types. |
| `widget_types/` | Eight concrete widget classes plus `LensDisplay` (the typewriter Lens Brief readout). |
| `widgets.py` | Shared UI primitives: `CardFrame`, `GradientBorderFrame`, `GradientLine`, `BlurrableStack`, `DimOverlay`, `EmptyState`, `LoadingButton`. |
| `constants.py` | File paths, TTLs, default settings, threshold maps, `APP_VERSION = "0.5.0"`. |
| `paths.py` | `resource_path()` (PyInstaller- and Nuitka-aware asset lookup), `user_data_dir()`, `user_file()`. |
| `scale.py` | DPI scaling helpers. |

### The eight dashboard widgets

`Total Equity`, `Portfolio Vector` (direction arrow + slope %), `Portfolio Volatility`, `Portfolio Diversification` (sector pie), `Portfolio Beta`, `Sharpe Ratio` (rendered at 16pt — do **not** re-inflate to 22pt), `Positions List`, `Dividend Calendar`. The Lens Brief is a **permanent** fixture on the dashboard, not a removable widget.

### The Lens engine (`vector/lens/`)

Modular pipeline: **analyzers → analysis pool → CTA engine → sentence composers → assembler**.

- 8 analyzers in `lens/analyzers/`: `slope`, `volatility`, `concentration`, `earnings`, `dividends`, `beta`, `performance`, `index_fund`. Each exposes `analyze(positions, store, settings, risk_profile) → dict` with a `ticker_results` map and a `portfolio_result` aggregate (each containing `value`, `severity`, `flag`, `weight`, `details`).
- `analysis_pool.py` runs them in dependency order (slope/vol first, earnings second, rest after) and applies post-processing — notably index-fund suppression that forces concentration flags off for index ETFs.
- `cta_engine.py` reads analyzer output and emits a prioritized list of CTAs. **11 priority levels** (1 = highest): steep decline (sell), excessive volatility (sell), winner drift (rebalance), index fund informational (hold), high portfolio beta (buy), single-stock concentration (buy, up to 3 across underweight sectors), sector over-concentration (buy, up to 3, never in the overweight sector), dead weight (sell), underrepresented sector (buy, up to 3 — one per thin sector <10%), unrealized loss (hold), portfolio healthy (hold).
- Buy CTAs are sector-aware: every suggested ticker is verified to be **outside** the problem sector. `_underweight_sectors_sorted()` ranks targets lightest-first and `_split_dollars_by_underweight()` allocates the buy amount proportionally. `_cap_buy_amount()` keeps every buy proportional to total equity. Sells are gated by `_sell_too_small()`.
- `sentence1.py` (portfolio state, slope + volatility), `sentence2.py` (timing/catalyst, earnings + dividends), `sentence3.py` (CTA — always prefers diversification CTAs for the brief). Templates in `lens/templates/sentences.json`. Selection is deterministic (SHA-256 of portfolio state).
- `risk_profile.py` loads the user's tier (`high`, `regular`, `low`) and returns threshold overrides. Conservative tier (`low`) suppresses priorities 8 and parts of 1/2/3, and uses `sell_scale = 0.15` (vs `0.5` regular, `0.3` aggressive).
- `lens_output.py` is the top-level assembler. It joins the three sentences, computes a 1–99 caution score (`total CTA dollars / total equity × 100`, clamped), runs `_apply_all_ctas()` to produce `projected_positions` plus `net_cta_delta`, and writes a snapshot to `lens_history.json` (rolling 50 entries, dedup'd against the most recent entry by `brief`/`caution_score`/`action_type`/`cta_count`). Pass `save_history=False` from debug runners to avoid polluting real history.
- Color mapping: `sell → #ff4d4d`, `rebalance → #ff9f43`, `buy_new`/`buy_more → #38bdf8`, `hold → #8d98af`.

`LensDisplay.refresh()` in `widget_types/lens.py` accepts tuple lengths 7, 6, 5, 4, 3, 2 for backwards compatibility — when changing the engine signature, do not break this.

### Visual / layout invariants worth knowing

- All three scrollable pages (Dashboard, Lens, Settings) use `setWidgetResizable(False)` + `container.setFixedWidth(_CONTENT_W=1090)` so content width is stable on window resize.
- `_CTAReportCard`'s sizing is **measured, not estimated** — see `app/CLAUDE.md` for the exact `_resize_for_cards` recipe. Hardcoded per-card heights produced clipping in earlier versions; do not regress.
- Graph margins on the Lens Projections charts: `subplots_adjust(left=0.06, right=0.88, top=0.90, bottom=0.22)`. Do not drop `bottom` below 0.22 — y-axis labels clip at 1080p. Canvas minimum height is 320 px.
- `LensDisplay` typewriter timer (`_tw_timer`) can have its C++ wrapper torn down during reparenting. `_ensure_tw_timer()` reconstructs it on demand inside a try/except `RuntimeError`. Do not remove this defensive pattern.

### Qt stylesheet rules (Vector UI only)

Qt supports a limited CSS subset. Always wrap rules in a class selector (`QFrame { … }` not bare `{ … }`). **Supported:** `background`, `background-color`, `color`, `border`, `border-left/top/bottom`, `border-radius`, `font-size`, `font-weight`, `padding` (only on buttons/edits where it's known to behave). **Not supported (will silently break):** `gap`, `calc()`, `var()`, `box-shadow` (use `QGraphicsDropShadowEffect`), `transform`, `transition`, `display: flex`, `filter`, `backdrop-filter`, `::before`, `::after`, nested/SCSS selectors. Prefer `setContentsMargins()` over stylesheet `padding`/`margin` for internal widget layout.

### Storage (Vector)

| File | Contents |
|---|---|
| `positions.json` | List of `{ ticker, shares, equity, sector, name, price, added_at }` |
| `settings.json` | `theme`, `currency`, `date_format`, `refresh_interval`, `risk_tier`, `direction_thresholds`, `volatility`, `lens_signals`, `monte_carlo` |
| `app_state.json` | `onboarding_complete`, `first_launch_date`, `risk_tier_selected` |
| `market_data.json` | Per-ticker: `quote`, `meta`, `history`, `history_ohlcv`, `history_intraday`, `dividends`, `earnings` (UTC timestamps) |
| `dashboard_layout.json` | Ordered list of `{ class_name, row, col, rowspan, colspan }` |
| `lens_history.json` | `{ "snapshots": [...] }` — rolling 50 |

Market data TTLs (in `store.py`): quote/intraday matches `refresh_interval`, daily history 60 min, meta/dividends/earnings 24 h.

### Keyboard shortcuts (Vector)

`R` refresh, `L` Lens page, `D` Dashboard, `S` Settings, `A` Add Position (onboarding only), `?` Shortcuts modal, `Esc` close any modal, `Space` advance onboarding step (widget-scoped, ignored when focus is a `QLineEdit`).

### When to consult `Vector-Main/CLAUDE.md`

Anything more specific than the map above — exact widget struct, accordion measure logic, Nuitka include flags, splash-screen sequence, page-by-page layout arithmetic, sentence-template selection — is documented there. That file is the authoritative reference; this section is a summary only.

---

## 7. Conventions & Gotchas

### Cross-cutting

- **No tests anywhere.** Do not introduce a test framework or CI config unless the user explicitly asks. Verify changes manually against the running dev server / app.
- **No lint or format config.** Match the style of the file you are editing. Backend TS uses 4-space indentation and double quotes; frontend HTML/JS uses 2-space indentation and double quotes; Python in `app/` follows roughly PEP 8 with project-specific patterns documented in `app/CLAUDE.md`.
- **No em dashes (`—`, U+2014) anywhere.** This applies to user-facing copy (HTML, marketing text, button labels, page titles), code comments, commit messages, and PR descriptions. Use a comma, period, colon, parentheses, or a regular hyphen (`-`) instead, whichever best fits the sentence. En dashes (`–`) are also discouraged outside of numeric ranges. The frontend has been swept clean of em dashes; do not reintroduce them. If you find one lingering anywhere in the repo, remove it as part of whatever change touches that file.
- **Windows-first dev environment.** Primary machine is Windows 11 with bash (Git Bash / MSYS). Paths in shells use forward slashes; `.env` files should be LF-terminated.
- **`scripts/` and `database/` are intentionally empty.** `database/` is a leftover from the SQLite era and is gitignored. Do not put runtime files in either unless the user is starting that workstream.

### Backend

- **Dev mode wipes the users table on every boot.** Do not run `npm run dev` against a database that holds real accounts. The seeded test user is `testuser` / `password123`.
- **Rate limit is 20 / 60 s per IP, global.** Expect `429`s during frontend testing. This is a deliberate brake during early dev — don't loosen it casually.
- **CORS allowlist is strict, and `credentials: true` is required.** The current allowlist covers ports 5500/5501 (static frontend), 5173 (lens-app Vite), `protonyxdata.com`, and `app.use-lens.com`. Adding any new origin means editing `server.ts`. Every preflight failure during testing is almost always a wrong port or a missing origin. `credentials: true` must stay set — without it the browser will not send the session cookie.
- **Passwords are bcrypt cost 10.** Do not lower it. Do not log `user.password` anywhere — `/me` deliberately omits it from its `SELECT`.
- **JWT expiry is 7 days.** No refresh-token flow. For the static frontend (bearer-token path), an expired token surfaces as a failed `/me` call and the user is bounced to `/auth/index.html`. For lens-app (cookie path), an expired cookie causes `GET /me` on mount to return 401, leaving `isAuthenticated: false` and redirecting to `/login`.
- **`session` cookie flags.** `httpOnly: true` (no JS access). `secure` and `sameSite` are environment-gated: `sameSite: lax, secure: false` in dev (localhost cross-port); `sameSite: none, secure: true` in production (cross-domain). Do not flatten this to a single value — `sameSite: none` without `secure` is rejected by Chrome.
- **`JWT_SECRET`, `DATABASE_URL`, and `RESEND_API_KEY` live in `.env`.** `.env` is gitignored. Never commit it; never paste real values into code or chat. `JWT_SECRET=your-secret-here` style placeholders in docs are placeholders — do not preserve them as if they were real.
- **The error field on the wire is `message`.** New endpoints should keep it that way. The frontend's `data.message || data.error` fallback exists for historical reasons but should not be relied on.
- **`better-sqlite3`** is still in `package.json` but no runtime code imports it. Removing it (and `@types/better-sqlite3`) is safe cleanup if you are touching `package.json` anyway. Do not re-introduce SQLite code paths.

### Frontend

- **Live Server must be rooted at `frontend/`.** Root-absolute hrefs (`/auth/index.html`, `/account/index.html`, `/assets/downloads/Vector-Setup.exe`) only resolve when this is true. If links 404, this is the first thing to check.
- **Live Server must use port 5500 or 5501.** Other ports will fail CORS against the backend allowlist.
- **`API_URL` is hardcoded** at the top of `auth.js`. Update there when deploying.
- **Navbar and menu overlay are duplicated per page.** Changing them means editing every `index.html`. There is currently no template/include system. If you add a new page, copy from a recent one (`account/index.html` has the latest markup). The menu overlay's "Download" link is one of the `data-download` buttons (see below) — copy it intact.
- **There is no longer a version label in the frontend.** It used to live on the (now removed) download page. The desktop app's version comes from `app/vector/constants.py::APP_VERSION` (currently `0.5.0`) and `backend/src/version.json` should match it; keep the two in sync on each release. `GET /version` serves `version.json` if the frontend ever needs to display it again.
- **Downloads do not gate on auth.** The hero, pricing, and menu "Download" buttons download `/assets/downloads/Vector-Setup.exe` natively regardless of login state; only the `POST /download` counter call is skipped when there is no token. The served file is a placeholder until a real build artifact replaces it. Reconsider gating when wiring up a hosted (non-local) binary URL.

### Vector desktop app

- See `Vector-Main/CLAUDE.md` for the exhaustive list. The most painful regressions to avoid: re-inflating Sharpe to 22pt, removing the QTimer defensive pattern in `LensDisplay`, hardcoding `_CTAReportCard` heights, dropping graph margin `bottom` below 0.22, and forgetting to include `vector/lens/templates` or the yfinance package list in the Nuitka build.

### Always do this

- **Update `CLAUDE.md` in the same change that makes its claims stale.** New routes, columns, pages, env vars, version bumps, removed features, renamed files, changed conventions — all require touching the relevant section here. If the Lens engine is affected, update `lens-api/CLAUDE.md` too. If the desktop app is affected, update `Vector-Main/CLAUDE.md`. The doc is a code artifact: it lives or dies with the diff that introduced the change. Do not defer this; do not "open a follow-up." Fix it now.

### Don't do this

- Don't add a notes feature back. The endpoints, table, frontend hooks, and tests have all been removed deliberately.
- Don't paper over CORS or rate-limit failures by widening the allowlist or raising limits "to make testing easier." Fix the test setup instead.
- Don't reach into `StorageManager` or `MarketDataService` from Vector code — `DataStore` is the authoritative layer.
- Don't introduce a new package manager, monorepo orchestrator, Docker setup, or CI config without an explicit ask.
- Don't ship a code change and leave `CLAUDE.md` describing the old behavior. Stale docs are worse than no docs.
- Don't use em dashes (`—`) anywhere: not in copy, not in code comments, not in commit messages. See the Cross-cutting section for the rationale and acceptable substitutes.
