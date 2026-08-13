# CLAUDE.md — backend

This is the Fastify/TypeScript backend for Protonyx. It handles auth, user accounts, legal acceptance, and the download counter. It does NOT do portfolio analytics — that is `lens-api/`.

**Read `_monorepo/CLAUDE.md` for full detail.** This file is a quick-start reference for developers working directly in this folder.

---

## Stack

- **Runtime:** Node.js with TypeScript via `ts-node-dev` (no compile step in dev)
- **Framework:** Fastify
- **Database:** PostgreSQL (Railway-hosted in production, local in dev)
- **Email:** Resend SDK
- **Deployed on:** Railway

## Commands

Run from `backend/`:

```bash
npm install          # install deps
npm run dev          # start dev server (ts-node-dev, hot-reload, port 3000)
npx tsc --noEmit     # typecheck only — no npm script for this
```

No build script. No test suite. No linter.

## Required env vars (`.env`, gitignored)

```
JWT_SECRET=<any string>
DATABASE_URL=postgresql://<user>:<pass>@<host>:<port>/<db>
RESEND_API_KEY=<resend api key>
BETA_ACTIVE=true                    # set to "false" to close signups
MAX_BETA_USERS=50                   # hard cap on total user count
STRIPE_SECRET_KEY=sk_test_...       # Stripe secret key (test mode)
STRIPE_WEBHOOK_SECRET=whsec_...     # Stripe webhook signing secret
LENS_APP_URL=http://localhost:5173  # frontend URL for Stripe redirect URLs
```

`.env.example` documents all of these with placeholders.

## Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/signup` | - | Create account (beta-gated); converts a matching waitlist entry into free Pro time |
| POST | `/login` | - | Login — sets httpOnly `session` cookie (7 days) AND returns `token` in body for non-browser callers |
| POST | `/logout` | - | Clears the `session` cookie |
| GET | `/verify-email?token=` | - | Verify email address |
| POST | `/resend-verification` | JWT | Re-send verification email |
| POST | `/forgot-password` | - | Request password reset link |
| POST | `/reset-password` | - | Set new password via reset token |
| GET | `/me` | JWT | Full user profile; lazily expires a lapsed free-Pro trial before responding |
| GET | `/protected` | JWT | Smoke test |
| POST | `/download` | JWT | Increment download counter |
| GET | `/version` | - | Current Vector app version |
| GET | `/beta/status` | - | Signup availability |
| GET | `/legal/status` | JWT | TOS + EULA acceptance status |
| POST | `/legal/accept` | JWT | Accept TOS or EULA |
| GET | `/subscription/status` | JWT | Billing state (thin alternative to `/me`) |
| POST | `/stripe/create-checkout-session` | JWT | Start Stripe Checkout for the $10/mo Lens Pro sub; returns `{ url }` |
| POST | `/stripe/portal` | JWT | Stripe Customer Portal session (needs `stripe_customer_id`) |
| POST | `/stripe/webhook` | - | Stripe event handler; signature-verified, rate-limit skipped, raw Buffer body |
| GET | `/positions` | JWT | List the user's portfolio (per-user, Postgres) |
| PUT | `/positions` | JWT | Bulk replace all positions (onboarding) |
| POST | `/positions` | JWT | Add one position (upsert on ticker) |
| PATCH | `/positions/:ticker` | JWT | Edit share count (equity recomputed) |
| DELETE | `/positions/:ticker` | JWT | Remove a holding |
| PUT | `/settings/risk-tier` | JWT | Set `users.risk_tier` (`low`/`regular`/`high`/`null`) |
| PUT | `/settings` | JWT | Shallow-merge into `users.settings` JSONB (theme, date_format, layout, analyze tuning blocks) |
| GET | `/notifications` | JWT | The user's notifications, newest first, capped at 50 (read and unread together) |
| PATCH | `/notifications/read` | JWT | Bulk mark-read: `{ ids }` marks those rows, omitting `ids` marks all unread |

Auth is resolved by `src/middleware/authenticate.ts`, which checks `Authorization: Bearer <token>` first, then falls back to the `session` httpOnly cookie. Both paths work — the static frontend and desktop app use bearer tokens; lens-app uses the cookie.

## Key files

| File | Purpose |
|---|---|
| `src/server.ts` | Fastify bootstrap, plugin registration, CORS config |
| `src/db.ts` | pg Pool, schema creation, idempotent migrations |
| `src/middleware/authenticate.ts` | JWT preHandler — reads `Authorization: Bearer` first, falls back to the `session` cookie |
| `src/routes/auth.ts` | signup, login, verify-email, forgot/reset-password |
| `src/routes/debug.ts` | /protected, /me, /download, /version, /beta-status (legacy, still polled by shipped desktop app) |
| `src/routes/legal.ts` | /legal/status, /legal/accept |
| `src/routes/beta.ts` | /beta/status |
| `src/routes/positions.ts` | /positions CRUD (per-user portfolio; NUMERIC coerced to numbers via rowToPosition) |
| `src/routes/settings.ts` | PUT /settings/risk-tier (users.risk_tier), PUT /settings (users.settings JSONB shallow-merge) |
| `src/routes/notifications.ts` | GET /notifications (newest first, capped 50), PATCH /notifications/read (bulk mark-read) |
| `src/routes/stripe.ts` | /stripe/create-checkout-session, /stripe/portal, /stripe/webhook (raw Buffer body in this plugin scope) |
| `src/routes/subscription.ts` | /subscription/status |
| `src/constants.ts` | CURRENT_TOS_VERSION, CURRENT_EULA_VERSION |
| `src/betaConfig.ts` | BETA_ACTIVE, MAX_BETA_USERS (read from env) |
| `src/waitlist.ts` | `grantWaitlistProTime()` - converts a verified referral-waitlist entry into earned free Pro time at signup (one transaction, never throws), then writes the `notifications` row announcing the months earned + expiry date |
| `src/version.json` | Latest Vector app version string |
| `src/email.ts` | Resend send helpers (fire-and-forget) |
| `src/emailTemplates.ts` | Inline HTML for welcome + verify + reset emails |

## Critical behaviors to preserve

- **Dev mode wipes the DB on every boot** (`NODE_ENV=development` triggers `DROP TABLE notifications CASCADE`, `DROP TABLE positions CASCADE`, then `DROP TABLE users CASCADE`, and reseeds `testuser` + sample positions). The child tables are dropped first because `DROP users CASCADE` only removes the FK, not the child rows. Never run dev against a database with real accounts.
- **`notifications`**: written only by `grantWaitlistProTime()`, read by `routes/notifications.ts` (`GET /notifications`, `PATCH /notifications/read`) which backs the lens-app TopBar popover. The insert sits **after** the grant's COMMIT in its own try/catch on purpose: Postgres aborts a transaction on any statement error, so an in-transaction insert could not fail non-fatally and would cost the user real earned Pro time. Only the waitlist path notifies; the Stripe webhook branches do not. Mark-read is **bulk** (`PATCH /notifications/read` with the ids on screen, or no ids to clear all) rather than per-id, so one popover open costs one request against the 20/60s rate limit.
- **`positions` table** is created with `CREATE TABLE IF NOT EXISTS` (persists in prod, dropped only in dev). One row per `(user_id, ticker)`. `NUMERIC` columns come back as strings from node-postgres, so `routes/positions.ts` coerces them to numbers via `rowToPosition()` before responding.
- **Per-user prefs are in Postgres, not cookies.** `users.risk_tier` (onboarding profile, `null` until set) and `users.settings` (JSONB blob: theme, date_format, dashboard layout, and the four analyze tuning blocks) replaced the old lens-app cookies. `/me` returns both; `routes/settings.ts` writes them (`PUT /settings` is a top-level `settings || $1::jsonb` merge, so each key sent replaces that whole key).
- **Stripe webhook needs the raw body.** `routes/stripe.ts` overrides the `application/json` parser in its plugin scope to receive a raw `Buffer` (required for signature verification); non-webhook routes in that scope `JSON.parse` the buffer manually. The webhook route sets `config: { rateLimit: false }` so Stripe can deliver events freely. It maps events to users via `metadata.userId` (checkout) or `stripe_customer_id` (subscription/invoice).
- **Waitlist conversion must never block a signup.** `src/waitlist.ts` runs at the end of `POST /signup` and swallows every failure (no match, unverified, already redeemed, or no `waitlist` table in this environment, which Fastify never creates since `referral-service` owns that DDL). Keep it in a try/catch that returns `0`. It claims the row with `FOR UPDATE` inside one transaction so a concurrent `referral-service` `POST /redeem` cannot double-grant.
- **`plan` is the source of truth for access; `plan_expires_at IS NULL` means "never expires."** Earned waitlist time sets both (`plan='pro'` + a real expiry); `GET /me` lazily downgrades a lapsed one to `plan='free', plan_expires_at=NULL`. All three Stripe webhook branches write `plan_expires_at` explicitly so a paying subscriber is never caught by that expiry. **Do not gate on `subscription_status`**: it is stale in production (every row reads `'inactive'`) and this feature deliberately neither reads nor writes it.
- **CORS allowlist** is hardcoded in `server.ts`. Current origins: 5500/5501 (static frontend), 5173 (lens-app Vite), `protonyxdata.com`, `app.lens-arc.com`, `lens-arc.com`. Methods: `GET, POST, PUT, DELETE, PATCH` (`PUT` is needed for `PUT /positions` bulk-replace). `credentials: true` must stay set — without it browsers will not send the session cookie. Adding any new origin requires editing `server.ts`.
- **The API is served at `api.lens-arc.com` in production** (Railway custom domain; the generated `*.up.railway.app` host still resolves as a fallback). This keeps the backend **same-site** with `app.lens-arc.com`, which is what makes the `session` cookie first-party. Served from the raw Railway host it is a third-party cookie, blocked by Safari and by any Chrome/Edge profile with third-party cookies off, so login succeeds and every authenticated call afterwards 401s. Do not repoint `lens-app`'s `VITE_API_URL` at the Railway host. See `_monorepo/CLAUDE.md` §4 "API domain".
- **Session cookie flags** are environment-gated: `sameSite: lax, secure: false` in dev (localhost cross-port); `sameSite: none, secure: true` in prod (cross-domain). Do not flatten to one value.
- **`@fastify/cookie`** must be registered before any route that reads or sets the cookie. Registration is in `server.ts` after the CORS plugin.
- **Rate limit:** 20 req / 60 s per IP globally. Expect 429s during fast frontend testing.
- **`/forgot-password` always returns 200** regardless of whether the email exists — account-enumeration defense. Never change this.
- **`better-sqlite3`** (from the pre-Postgres SQLite era) has been removed from `package.json`. Do not re-introduce a SQLite code path.
- **Error field on the wire is `message`**, not `error`. Keep it consistent.
- **TOS version** is bumped in `src/constants.ts` to re-prompt all users. EULA same pattern.
- **Passwords are bcrypt cost 10.** Do not lower it. Do not log them.

For full architectural detail (DB schema, request lifecycle, email templates, route-by-route behavior), see `_monorepo/CLAUDE.md` §4.
