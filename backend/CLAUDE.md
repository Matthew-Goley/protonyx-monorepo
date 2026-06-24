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
| POST | `/login` | - | Login, returns 7-day JWT |
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

Auth is a JWT bearer token (`Authorization: Bearer <token>`). Protected routes use `{ preHandler: authenticate }` from `src/middleware/authenticate.ts`.

## Key files

| File | Purpose |
|---|---|
| `src/server.ts` | Fastify bootstrap, plugin registration, CORS config |
| `src/db.ts` | pg Pool, schema creation, idempotent migrations |
| `src/routes/auth.ts` | signup, login, verify-email, forgot/reset-password |
| `src/routes/debug.ts` | /protected, /me, /download, /version |
| `src/routes/legal.ts` | /legal/status, /legal/accept |
| `src/routes/beta.ts` | /beta/status |
| `src/constants.ts` | CURRENT_TOS_VERSION, CURRENT_EULA_VERSION |
| `src/betaConfig.ts` | BETA_ACTIVE, MAX_BETA_USERS (read from env) |
| `src/version.json` | Latest Vector app version string |
| `src/email.ts` | Resend send helpers (fire-and-forget) |

## Critical behaviors to preserve

- **Dev mode wipes the DB on every boot** (`NODE_ENV=development` triggers `DROP TABLE users`). Never run dev against a database with real accounts.
- **CORS allowlist** is hardcoded in `server.ts` for ports 5500 and 5501. Adding any new origin (staging/prod frontend) requires editing that list.
- **Rate limit:** 20 req / 60 s per IP globally. Expect 429s during fast frontend testing.
- **`/forgot-password` always returns 200** regardless of whether the email exists — account-enumeration defense. Never change this.
- **`better-sqlite3`** is still in `package.json` but nothing imports it. Safe to remove.
- **Error field on the wire is `message`**, not `error`. Keep it consistent.
- **TOS version** is bumped in `src/constants.ts` to re-prompt all users. EULA same pattern.
- **Passwords are bcrypt cost 10.** Do not lower it. Do not log them.

For full architectural detail (DB schema, request lifecycle, email templates, route-by-route behavior), see `_monorepo/CLAUDE.md` §4.
