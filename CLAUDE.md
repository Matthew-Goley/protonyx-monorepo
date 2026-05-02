# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. It is intentionally detailed so that someone with no prior exposure to the project can act on it without reading every source file. Update it when the things it claims become wrong.

> **Keep this file current.** Whenever you change the codebase in a way that contradicts something written here — new endpoint, new column, new page, renamed file, removed feature, changed convention, version bump, new dependency, new env var — update the relevant section of `CLAUDE.md` *in the same change*. Treat the doc as part of the diff, not a follow-up. If the change touches the desktop app, update `app/CLAUDE.md` too. Drift is the single most expensive thing that can happen to this file: every stale claim costs the next session real time, so the rule is "if a future reader of this file would now be misled, fix it now."

---

## 1. What This Repo Is

**Protonyx** is an early-stage fintech building institutional-grade portfolio analytics for retail investors. This is the monorepo for the entire platform — backend API, web frontend, and the desktop app — held together by a single Postgres user database.

There are three deliverables:

| Product | Stack | Purpose |
|---|---|---|
| **Vector** (`app/`) | Python 3.12 + PyQt6, packaged with Nuitka | Downloadable Windows desktop app. Tracks positions, fetches market data via `yfinance`, and renders an analytics dashboard powered by a proprietary engine called **Lens**. Currently version **0.4.2**. |
| **Web frontend** (`frontend/`) | Plain static HTML/CSS/JS, served by VS Code Live Server | Marketing site, signup/login, account dashboard, gated download page. No framework, no bundler. |
| **Backend API** (`backend/`) | Fastify + TypeScript on Node, PostgreSQL | Authentication, account profile, download counter, and (eventually) the API the desktop app talks to. |

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
│   │   ├── email.ts               # Resend transactional email (welcome + verify + password reset)
│   │   ├── middleware/
│   │   │   └── authenticate.ts    # JWT bearer preHandler
│   │   └── routes/
│   │       ├── auth.ts            # /signup, /login, /verify-email, /forgot-password, /reset-password
│   │       └── debug.ts           # /protected, /me, /download
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                       # JWT_SECRET, DATABASE_URL, RESEND_API_KEY — gitignored
│
├── frontend/                      # Static site, one index.html per route
│   ├── index.html                 # Landing / hero (rotating background videos)
│   ├── style.css                  # ~1700 lines, single shared stylesheet
│   ├── script.js                  # Hero video rotation, logo color swap, menu overlay
│   ├── auth/
│   │   ├── index.html             # Tabbed login/signup form
│   │   └── auth.js                # All auth + session logic + GET /me helper
│   ├── account/index.html         # Profile dashboard (renders GET /me)
│   ├── download/
│   │   ├── index.html             # Gated download landing page
│   │   └── download.js            # Calls POST /download, then triggers file download
│   ├── verify-email/
│   │   └── index.html             # Standalone email-verification landing (loading/success/error)
│   ├── forgot-password/
│   │   └── index.html             # Standalone "request reset link" form
│   ├── reset-password/
│   │   └── index.html             # Standalone "set a new password" form (token in query string)
│   ├── about/ careers/ contact/ privacy/ tos/   # Static pages
│   ├── products/
│   │   ├── index.html
│   │   └── vector/index.html
│   ├── assets/
│   │   ├── company/               # protonyx_full_white.png, _black.png
│   │   ├── product/vector/        # Vector product artwork (logo, dashboard, lens preview)
│   │   └── video/                 # 1vector_demo.mp4, 2city.mp4, 3codingdemo.mp4, 4stockmarket.mp4, 5codingdemo.mp4
│   └── .vscode/settings.json      # Live Server pinned to port 5501
│
├── app/                           # Vector desktop app (PyQt6) — see app/CLAUDE.md
│   ├── main.py                    # Entry point — calls vector.app.main()
│   ├── requirements.txt
│   ├── build.bat / build-debug.bat # Nuitka standalone builds
│   ├── debug_test.json            # Synthetic positions for offline Lens testing
│   ├── assets/                    # vector_full.png, vector.ico, splashboard.png
│   └── vector/                    # All app code, see §6
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

### Vector desktop app

Run from `app/`:

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

For Nuitka standalone builds, use `build.bat` (release, console disabled) or `build-debug.bat` (console enabled for tracebacks). Both wipe `app/.dist/` first. See `app/CLAUDE.md` for the full Nuitka invocation and the data/package includes that are required to ship.

### PostgreSQL (local dev)

The backend expects a running Postgres reachable via `DATABASE_URL`. Schema is created on each server boot by `db.ts`. There is **no migrations system** — the database evolves by editing `db.ts`.

`backend/.env` must contain (gitignored — do **not** commit, do not paste real values into chat or code):

```
JWT_SECRET=<any-string>
DATABASE_URL=postgresql://<user>:<pass>@<host>:<port>/<db>
RESEND_API_KEY=<resend-api-key>     # required only for welcome emails
```

If `RESEND_API_KEY` is missing, signup still succeeds — `sendWelcomeEmail` is fire-and-forget and swallows errors so that email outages never break account creation.

---

## 4. Backend Architecture

### Request lifecycle

`src/server.ts` builds a Fastify instance and registers, in order:

1. **`@fastify/rate-limit`** — global, **20 requests / 60 seconds per IP**. This is low; you will hit it during frontend testing if you mash buttons. Don't bump it without a reason.
2. **`@fastify/cors`** — allowlists exactly four origins:
   - `http://127.0.0.1:5500`
   - `http://localhost:5500`
   - `http://127.0.0.1:5501`
   - `http://localhost:5501`
   Methods: `GET, POST, DELETE, PATCH`. (Fastify handles preflight automatically; no explicit `OPTIONS`.) Adding any new origin (staging URL, deployed frontend) requires editing this list.
3. **Route modules**: `authRoutes`, `debugRoutes`. Both are mounted at the **root path** with no prefix — the `/protected` and `/me` endpoints live under `debug.ts` for historical reasons even though they are not strictly debug.

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
    member_since        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Idempotent migrations applied on every boot (each try/catch wrapped):
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token TEXT DEFAULT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMP DEFAULT NULL;

-- DEV ONLY: seed a known test account
INSERT INTO users (username, email, password, plan, beta_access)
VALUES ('testuser', 'test@protonyx.dev', <bcrypt('password123')>, 'free', true)
ON CONFLICT DO NOTHING;
```

The `verification_token` column holds a 64-char hex string (`crypto.randomBytes(32).toString("hex")`) issued at signup and cleared the moment `GET /verify-email` flips `email_verified=true`. A `NULL` token means either "already verified" or "never issued."

The `reset_token` / `reset_token_expires_at` pair is the same shape: a 64-char hex token issued by `POST /forgot-password` with a 1-hour `TIMESTAMP` expiry, both cleared the moment `POST /reset-password` succeeds. The DB-level expiry check uses `reset_token_expires_at > NOW()` so server clock skew between issuer and validator can never widen the window. Both columns are `NULL` whenever there is no active reset request.

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
| `POST` | `/signup` | — | `{ username, email, password }` | Validates all three are present; rejects duplicate `username` or `email` (409); bcrypt-hashes (cost 10); inserts row; **issues a `crypto.randomBytes(32).toString("hex")` verification token and stores it on the row**; **fires `sendWelcomeEmail` and `sendVerificationEmail` fire-and-forget** (failures logged, never thrown); returns 201. |
| `POST` | `/login` | — | `{ username, password }` | The `username` field accepts **either a username or an email** (`WHERE username = $1 OR email = $1`). On success, stamps `last_login = CURRENT_TIMESTAMP` and returns a JWT (`{ id, username }`, signed with `JWT_SECRET`, **7-day expiry**). Login does **not** currently gate on `email_verified` — verification is informational until that policy is decided. |
| `GET` | `/verify-email` | — | query: `?token=<hex>` | Looks up the user by `verification_token`. Missing or unknown token → 400 `{ success: false, message: "Invalid or expired verification token" }`. Found → sets `email_verified = true`, nulls `verification_token`, returns 200 `{ success: true, message: "Email verified successfully" }`. The token is single-use because it's cleared on success; re-clicking the link returns 400. |
| `POST` | `/forgot-password` | — | `{ email }` | **Always returns 200 with `{ success: true, message: "If that email exists you will receive a reset link" }`** — even when the email is missing, malformed, or unknown. This is account-enumeration defense; never special-case it back to a 404/400. When the email is registered, issues a 1-hour `reset_token`, persists it with `reset_token_expires_at = NOW() + 1h`, and fires `sendPasswordResetEmail` fire-and-forget. |
| `POST` | `/reset-password` | — | `{ token, newPassword }` | Validates both fields (400 `Token and new password are required` if missing). Looks up the row by `reset_token = $1 AND reset_token_expires_at > NOW()` so expiry is enforced at the DB level. Invalid/expired token → 400 `{ success: false, message: "Invalid or expired reset token" }`. Valid → bcrypt-rehashes (cost 10), nulls both reset columns, returns 200 `{ success: true, message: "Password reset successfully" }`. Single-use by construction (token cleared on success). |
| `GET` | `/protected` | ✅ | — | Smoke test. Returns `{ message: "Hello <username>" }`. |
| `GET` | `/me` | ✅ | — | Returns the full user profile **excluding `password`, `stripe_customer_id`, and `verification_token`**. Shape: `{ success, user: { id, username, email, plan, plan_expires_at, member_since, last_login, beta_access, download_count, email_verified, is_active } }`. The frontend calls this on login and on every account-page load. |
| `POST` | `/download` | ✅ | — (empty body) | Increments `download_count` for the authenticated user. Called from `/download` page when the user clicks "Download Vector". Returns `{ success, message: "Download recorded" }`. The actual binary URL is **not** returned by this endpoint — the frontend triggers the download separately. |

There is **no** `/notes`, `/getnotes`, `/notes/:id` endpoint. Earlier docs referenced them; they have been removed.

### Email (`src/email.ts`)

Three exported functions, all using the **Resend** SDK and all fire-and-forget from the caller's perspective. All three swallow errors with `console.error` so transactional-email outages never break the calling route.

**`sendWelcomeEmail(to, username)`**

- Sender is `onboarding@resend.dev` (Resend's default sandbox sender). When a real domain is verified, change this string in *both* email functions.
- The HTML body is inline-styled (table-based layout for email-client compatibility), uses the brand palette (`#0b1020` background, `#e7ebf3` text, `#2dd4bf` CTA), and links to `https://protonyx.dev/download`. That URL is currently hardcoded — update it if the public download page moves.
- The function logs `Resend key inside function: <bool>` before sending. That log line is debugging instrumentation; remove it before any meaningful production deployment.

**`sendVerificationEmail(to, username, token)`**

- Same sender, same dark/teal styling, same try/catch behavior.
- Builds the link as `http://localhost:5501/verify-email/index.html?token={token}`. The localhost host is marked with a `// TODO: replace localhost with production domain` comment — update it (and consider extracting to an env var) before the frontend is deployed.
- Subject: `Verify your Protonyx email`. Heading: `Verify your email, {username}.` Body: short instruction + `Verify Email` CTA button.
- Cannot be fully exercised end-to-end until a Resend domain is verified; the route itself works against the local DB without any email actually being delivered.

**`sendPasswordResetEmail(to, username, token)`**

- Same sender, same dark/teal styling, same try/catch behavior.
- Builds the link as `http://localhost:5501/reset-password/index.html?token={token}` with the same `// TODO: replace localhost with production domain` marker. When the verify-email URL is updated, update this one in lockstep.
- Subject: `Reset your Protonyx password`. Heading: `Password reset requested, {username}.` Body explicitly mentions the **1-hour expiry** and tells the recipient to ignore the email if they didn't request a reset (anti-confusion + anti-phishing language).
- Same caveat as the other transactional emails: real delivery requires a verified Resend domain; the `/forgot-password` route still functions against the DB without it (the token is written, the email send fails silently).

### Dependencies — quick map

| Dep | Used for |
|---|---|
| `fastify` | HTTP server |
| `@fastify/cors` | CORS middleware (origin allowlist) |
| `@fastify/rate-limit` | Global rate limit (20/60s) |
| `pg` | PostgreSQL pool |
| `bcrypt` | Password hashing (cost 10) |
| `jsonwebtoken` | JWT signing/verification |
| `dotenv` | Loads `.env` (imported via `import "dotenv/config"` in `server.ts`) |
| `resend` | Transactional email (welcome only, for now) |
| `better-sqlite3` + `@types/better-sqlite3` | **Dead.** Leftover from the SQLite era before the Postgres migration. Nothing in `src/` imports it. Safe to remove from `package.json`. |

`ts-node-dev` and the `@types/*` packages are devDeps. `typescript` is a devDep but there is no compile step in the npm scripts.

---

## 5. Frontend Architecture

### Stack

Plain static HTML + CSS + vanilla JS. **No framework, no bundler, no build step.** The only external font is IBM Plex Mono from Google Fonts, loaded via `<link>` on every page. All CSS lives in one ~1700-line file (`frontend/style.css`) shared by every page.

### Page structure

Each route is a folder with an `index.html`. To add a page:

1. Create `frontend/<slug>/index.html`.
2. Link `../style.css`, `../script.js`, and `../auth/auth.js` with the right relative depth (e.g. `products/vector/` uses `../../`).
3. Copy the `<nav class="navbar">` block and the `.menu-overlay` block from an existing page — they are **duplicated per-page**, not componentized. Updating them means editing every page that uses them.
4. Use root-absolute links (`href="/about"`, `href="/auth/index.html"`) — Live Server must be rooted at `frontend/`.
5. End the `<body>` with the standard footer, then load `script.js` and `auth/auth.js`, then a small `<script>checkAuth();</script>` if the page hasn't already wired it up.

### Navigation bar (every page)

The nav has three states managed via CSS classes that `auth.js` toggles:

- `.navbar-signup-link.guest-only` — "Create Account" link, shown only when logged out.
- `.navbar-profile-icon.auth-only` — circular profile SVG linking to `/account/index.html`, shown only when logged in.
- `.navbar-menu-button` — hamburger, always visible, opens the full-screen menu overlay.

Dark hero sections (`.hero`, `.vector-hero`, `.products-hero`) use the white logo; the rest use black. `script.js` listens to `scroll` and swaps `#navbarLogo`'s `src` between `protonyx_full_white.png` and `_black.png` as the hero scrolls out of view (with a 200ms opacity fade). Both images are preloaded.

### Menu overlay (every page)

`#menuOverlay` is a full-viewport panel with two columns: **Navigation** and **Account**. Account links use the same `.guest-only` / `.auth-only` toggle pattern. The hamburger button opens it (locks `body` overflow, fades the navbar to opacity 0); a close button or backdrop click dismisses it. Same caveat as the navbar — the markup is duplicated per page.

### CSS system

CSS custom properties are defined in `:root` at the top of `style.css`. The most-used tokens:

```css
--bg-base: #f2f1ee        /* off-white page background */
--bg-surface: #d7d4d4     /* card/panel background */
--border: rgb(142,142,142)
--text-primary: #1f2230
--grad: linear-gradient(135deg, #3a8c6e, #2a6b9a)   /* brand gradient, used by .btn-grad and .plan-pro */
```

Use these tokens; do not hardcode colors. The navbar floats at the top with a blurred glass effect (`backdrop-filter: blur(10px)`).

### `script.js` (shared across pages)

Four independent blocks, each guarded by `if (element)` so pages without the relevant element are no-ops:

1. **Hero video rotation** — cycles `heroVideoSources` (`1vector_demo`, `2city`, `3codingdemo`, `4stockmarket`, `5codingdemo`) every 4 seconds on `#heroVideo`.
2. **Navbar logo color swap** — described above.
3. **Product card video preview** — `.vector-card` hover plays its inner `.preview-video`; mouseleave pauses and rewinds.
4. **Menu overlay open/close** — described above.

### `auth/auth.js` (shared auth + session state)

Globally exposes `getToken()`, `authHeaders()`, `login()`, `signup()`, `loadProfile()`, `logout()`, `checkAuth()`.

- `API_URL = "http://localhost:3000"` — **hardcoded at the top of the file**. Update here when the backend is deployed. There is no env-var injection.
- JWT is stored in `localStorage.token`; **httpOnly cookies are not used.**
- The login form accepts a username **or** an email — the field is labeled "Username or Email" and the value is sent as `{ username, password }`. The backend resolves both.
- Signup form fields: `username`, `email`, `password`. The form posts to `/signup` and on success switches to the login tab via `switchToLoginTab()` (defined inline in `auth/index.html`).
- `loadProfile()` calls `GET /me` with `authHeaders()` and mirrors fields into `localStorage`: `username`, `email`, `plan`, `member_since`, `beta_access` (`"true"`/`"false"`), `download_count` (string-coerced). It is called from `login()` after the token is stored, and from any page that wants fresh profile data (e.g. the account page).
- `logout()` clears every profile-related localStorage key (`token`, `username`, `email`, `plan`, `member_since`, `beta_access`, `download_count`) and redirects to `/auth/index.html`.
- `checkAuth()` runs on every page load (via `DOMContentLoaded`, or directly if the script loads after parse) and:
  - Toggles `.visible` on `.auth-only` and `.guest-only` elements.
  - Replaces text content of `[data-username]` elements with the stored username (falling back to `"User"`).
  - Binds a click handler on `[data-logout]` elements that calls `logout()` (idempotent — uses `dataset.logoutBound` to avoid duplicate listeners).
- A `storage` event listener re-runs `checkAuth()` when `token` or `username` changes in another tab, so logging out in one tab updates all open tabs.
- Some pages call `checkAuth()` explicitly in an inline script after loading `auth.js`. Both patterns coexist; do not remove one without checking the other still works.

### Account page (`account/index.html`)

A self-contained dashboard rendered inline at the bottom of the HTML. Renders six fields from `GET /me`:

| DOM id | Source | Notes |
|---|---|---|
| `infoUsername` | `user.username` | |
| `infoEmail` | `user.email` | |
| `infoPlan` | `user.plan` | Capitalized; gets the `.plan-pro` class (transparent text + brand gradient via `background-clip: text`) when value is `"pro"`. |
| `infoMemberSince` | `user.member_since` | Formatted with `toLocaleDateString` (long month, numeric year/day). |
| `infoBetaAccess` | `user.beta_access` | Rendered as `"Enabled"` / `"Not enabled"`. |
| `infoDownloadCount` | `user.download_count` | |

**Render flow:** on load, the page first paints from cached localStorage values (so there's no blank flicker), then calls `loadProfile()` and re-renders with the authoritative server response. If the user has no token, the page redirects immediately to `/auth/index.html`. The hero label (`#accountHeroTitle`) shows the cached username.

### Download page (`download/index.html` + `download.js`)

A gated landing page with a single "Download Vector" CTA. When clicked:

1. If a token exists, `POST /download` (Bearer-authenticated) is fired to bump `download_count`. Network failures are swallowed (`.catch(() => {})`) — the download still proceeds.
2. A hidden `<a href="#" download="">` is created and clicked to trigger the browser download.

The actual binary URL is currently `"#"` — there's a `TODO` to replace it with an S3 or GitHub Releases URL once a release artifact exists. The displayed version label says **0.4.1**, but the desktop app is on **0.4.2** (`vector/constants.py::APP_VERSION`); the download page label needs to be bumped manually whenever a new build ships.

The download page does **not** redirect unauthenticated users away — it lets them click the button. Without a token, the `POST /download` step is skipped and the (currently broken) anchor click happens anyway. When a real download URL is wired up, decide whether to require auth before showing the button or before kicking off the download.

### Verify-email page (`verify-email/index.html`)

Standalone landing page hit by the link in the verification email. Deliberately bare — **no navbar, no footer, no menu overlay** — since the user might not be signed in and the page is intentionally one job. It loads `../style.css` and reuses `../auth/auth.js` purely to pick up `API_URL`.

Flow on load:

1. Reads `token` via `new URLSearchParams(window.location.search).get("token")`. Missing token → renders the error state immediately without hitting the API.
2. Renders the **loading** state (`Verifying your email...`).
3. `fetch("${API_URL}/verify-email?token=" + encodeURIComponent(token))` (GET, no body, no auth header — written as a template literal in the source).
4. Renders one of two terminal states:
   - **Success** — checkmark, large `Email verified.`, muted subline, and a button linking to `/auth/index.html`.
   - **Error** — exclamation icon, `Verification failed.`, the API's `message` (or a network-fallback string), and a "Back to sign in" link.

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

### Auth UX gotcha (was a real issue, now fixed — keep an eye on it)

The backend always names its error field `message`. Earlier versions of the frontend read `data.error`, so backend error messages never surfaced to users. The current `auth.js` reads `data.message || data.error`, which works against either field. If you add a new endpoint, prefer `message` and don't rely on the fallback.

---

## 6. Vector Desktop App (`app/`)

The Vector desktop app is fully developed and self-documenting. Its own `app/CLAUDE.md` (~410 lines) is the authoritative reference — read it before making changes. This section is a **map**, not a duplicate.

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
| `constants.py` | File paths, TTLs, default settings, threshold maps, `APP_VERSION = "0.4.2"`. |
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

### When to consult `app/CLAUDE.md`

Anything more specific than the map above — exact widget struct, accordion measure logic, Nuitka include flags, splash-screen sequence, page-by-page layout arithmetic, sentence-template selection — is documented there. Do not duplicate it here; update both files when behaviors change.

---

## 7. Conventions & Gotchas

### Cross-cutting

- **No tests anywhere.** Do not introduce a test framework or CI config unless the user explicitly asks. Verify changes manually against the running dev server / app.
- **No lint or format config.** Match the style of the file you are editing. Backend TS uses 4-space indentation and double quotes; frontend HTML/JS uses 2-space indentation and double quotes; Python in `app/` follows roughly PEP 8 with project-specific patterns documented in `app/CLAUDE.md`.
- **Windows-first dev environment.** Primary machine is Windows 11 with bash (Git Bash / MSYS). Paths in shells use forward slashes; `.env` files should be LF-terminated.
- **`scripts/` and `database/` are intentionally empty.** `database/` is a leftover from the SQLite era and is gitignored. Do not put runtime files in either unless the user is starting that workstream.

### Backend

- **Dev mode wipes the users table on every boot.** Do not run `npm run dev` against a database that holds real accounts. The seeded test user is `testuser` / `password123`.
- **Rate limit is 20 / 60 s per IP, global.** Expect `429`s during frontend testing. This is a deliberate brake during early dev — don't loosen it casually.
- **CORS allowlist is strict.** Adding a new frontend origin (staging, production) means editing `server.ts`. Every preflight failure during testing is almost always a wrong port or origin.
- **Passwords are bcrypt cost 10.** Do not lower it. Do not log `user.password` anywhere — `/me` deliberately omits it from its `SELECT`.
- **JWT expiry is 7 days.** No refresh-token flow. When a token expires, the user is bounced to `/auth/index.html` (frontend handles 401s by clearing localStorage on logout, but expired tokens currently surface only as failed `/me` calls — be aware).
- **`JWT_SECRET`, `DATABASE_URL`, and `RESEND_API_KEY` live in `.env`.** `.env` is gitignored. Never commit it; never paste real values into code or chat. `JWT_SECRET=your-secret-here` style placeholders in docs are placeholders — do not preserve them as if they were real.
- **The error field on the wire is `message`.** New endpoints should keep it that way. The frontend's `data.message || data.error` fallback exists for historical reasons but should not be relied on.
- **`better-sqlite3`** is still in `package.json` but no runtime code imports it. Removing it (and `@types/better-sqlite3`) is safe cleanup if you are touching `package.json` anyway. Do not re-introduce SQLite code paths.

### Frontend

- **Live Server must be rooted at `frontend/`.** Root-absolute hrefs (`/auth/index.html`, `/account/index.html`, `/download`) only resolve when this is true. If links 404, this is the first thing to check.
- **Live Server must use port 5500 or 5501.** Other ports will fail CORS against the backend allowlist.
- **`API_URL` is hardcoded** at the top of `auth.js`. Update there when deploying.
- **Navbar and menu overlay are duplicated per page.** Changing them means editing every `index.html`. There is currently no template/include system. If you add a new page, copy from a recent one (`account/index.html` and `download/index.html` have the latest markup).
- **The download page's version label is hardcoded** (currently `0.4.1`); the app's actual version comes from `app/vector/constants.py::APP_VERSION` (currently `0.4.2`). Bump the page label on each release.
- **The download page does not gate on auth.** The CTA fires regardless of login state; only the `POST /download` counter call is skipped when there is no token. Reconsider this when wiring up a real binary URL.

### Vector desktop app

- See `app/CLAUDE.md` for the exhaustive list. The most painful regressions to avoid: re-inflating Sharpe to 22pt, removing the QTimer defensive pattern in `LensDisplay`, hardcoding `_CTAReportCard` heights, dropping graph margin `bottom` below 0.22, and forgetting to include `vector/lens/templates` or the yfinance package list in the Nuitka build.

### Always do this

- **Update `CLAUDE.md` in the same change that makes its claims stale.** New routes, columns, pages, env vars, version bumps, removed features, renamed files, changed conventions — all require touching the relevant section here. If the desktop app is affected, update `app/CLAUDE.md` too. The doc is a code artifact: it lives or dies with the diff that introduced the change. Do not defer this; do not "open a follow-up." Fix it now.

### Don't do this

- Don't add a notes feature back. The endpoints, table, frontend hooks, and tests have all been removed deliberately.
- Don't paper over CORS or rate-limit failures by widening the allowlist or raising limits "to make testing easier." Fix the test setup instead.
- Don't reach into `StorageManager` or `MarketDataService` from Vector code — `DataStore` is the authoritative layer.
- Don't introduce a new package manager, monorepo orchestrator, Docker setup, or CI config without an explicit ask.
- Don't ship a code change and leave `CLAUDE.md` describing the old behavior. Stale docs are worse than no docs.
