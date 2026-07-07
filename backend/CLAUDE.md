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
BETA_ACTIVE=true           # set to "false" to close signups
MAX_BETA_USERS=50          # hard cap on total user count
```

## Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/signup` | - | Create account (beta-gated) |
| POST | `/login` | - | Login — sets httpOnly `session` cookie (7 days) AND returns `token` in body for non-browser callers |
| POST | `/logout` | - | Clears the `session` cookie |
| GET | `/verify-email?token=` | - | Verify email address |
| POST | `/resend-verification` | JWT | Re-send verification email |
| POST | `/forgot-password` | - | Request password reset link |
| POST | `/reset-password` | - | Set new password via reset token |
| GET | `/me` | JWT | Full user profile |
| GET | `/protected` | JWT | Smoke test |
| POST | `/download` | JWT | Increment download counter |
| GET | `/version` | - | Current Vector app version |
| GET | `/beta/status` | - | Signup availability |
| GET | `/legal/status` | JWT | TOS + EULA acceptance status |
| POST | `/legal/accept` | JWT | Accept TOS or EULA |
| GET | `/subscription/status` | JWT | Billing state (thin alternative to `/me`) |
| GET | `/positions` | JWT | List the user's portfolio (per-user, Postgres) |
| PUT | `/positions` | JWT | Bulk replace all positions (onboarding) |
| POST | `/positions` | JWT | Add one position (upsert on ticker) |
| PATCH | `/positions/:ticker` | JWT | Edit share count (equity recomputed) |
| DELETE | `/positions/:ticker` | JWT | Remove a holding |

Auth is resolved by `src/middleware/authenticate.ts`, which checks `Authorization: Bearer <token>` first, then falls back to the `session` httpOnly cookie. Both paths work — the static frontend and desktop app use bearer tokens; lens-app uses the cookie.

## Key files

| File | Purpose |
|---|---|
| `src/server.ts` | Fastify bootstrap, plugin registration, CORS config |
| `src/db.ts` | pg Pool, schema creation, idempotent migrations |
| `src/routes/auth.ts` | signup, login, verify-email, forgot/reset-password |
| `src/routes/debug.ts` | /protected, /me, /download, /version |
| `src/routes/legal.ts` | /legal/status, /legal/accept |
| `src/routes/beta.ts` | /beta/status |
| `src/routes/positions.ts` | /positions CRUD (per-user portfolio; NUMERIC coerced to numbers via rowToPosition) |
| `src/constants.ts` | CURRENT_TOS_VERSION, CURRENT_EULA_VERSION |
| `src/betaConfig.ts` | BETA_ACTIVE, MAX_BETA_USERS (read from env) |
| `src/version.json` | Latest Vector app version string |
| `src/email.ts` | Resend send helpers (fire-and-forget) |

## Critical behaviors to preserve

- **Dev mode wipes the DB on every boot** (`NODE_ENV=development` triggers `DROP TABLE positions CASCADE` then `DROP TABLE users CASCADE`, and reseeds `testuser` + sample positions). Positions is dropped first because `DROP users CASCADE` only removes the FK, not the child rows. Never run dev against a database with real accounts.
- **`positions` table** is created with `CREATE TABLE IF NOT EXISTS` (persists in prod, dropped only in dev). One row per `(user_id, ticker)`. `NUMERIC` columns come back as strings from node-postgres, so `routes/positions.ts` coerces them to numbers via `rowToPosition()` before responding.
- **CORS allowlist** is hardcoded in `server.ts`. Current origins: 5500/5501 (static frontend), 5173 (lens-app Vite), `protonyxdata.com`, `app.use-lens.com`. Methods: `GET, POST, PUT, DELETE, PATCH` (`PUT` is needed for `PUT /positions` bulk-replace). `credentials: true` must stay set — without it browsers will not send the session cookie. Adding any new origin requires editing `server.ts`.
- **Session cookie flags** are environment-gated: `sameSite: lax, secure: false` in dev (localhost cross-port); `sameSite: none, secure: true` in prod (cross-domain). Do not flatten to one value.
- **`@fastify/cookie`** must be registered before any route that reads or sets the cookie. Registration is in `server.ts` after the CORS plugin.
- **Rate limit:** 20 req / 60 s per IP globally. Expect 429s during fast frontend testing.
- **`/forgot-password` always returns 200** regardless of whether the email exists — account-enumeration defense. Never change this.
- **`better-sqlite3`** (from the pre-Postgres SQLite era) has been removed from `package.json`. Do not re-introduce a SQLite code path.
- **Error field on the wire is `message`**, not `error`. Keep it consistent.
- **TOS version** is bumped in `src/constants.ts` to re-prompt all users. EULA same pattern.
- **Passwords are bcrypt cost 10.** Do not lower it. Do not log them.

For full architectural detail (DB schema, request lifecycle, email templates, route-by-route behavior), see `_monorepo/CLAUDE.md` §4.
