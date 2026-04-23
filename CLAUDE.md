# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 1. Project Overview

**Protonyx** is a fintech company building institutional-grade portfolio analytics for retail investors. This is the monorepo for the entire platform.

- **Vector** — the flagship product, a downloadable desktop app (PyQt6) that runs against a proprietary internal engine called **Lens**. Vector generates personalized portfolio insights. The `app/` directory is reserved for it but is currently empty — no Vector code exists yet.
- **Frontend** — marketing site + auth + account dashboard (plain static HTML/CSS/JS, no framework).
- **Backend** — a shared Fastify + TypeScript REST API consumed by both the web frontend and (eventually) the Vector desktop app.

The three products share one backend and one user database. They do **not** share a build system — each subdirectory is developed independently.

---

## 2. Repo Layout

```
_monorepo/
├── backend/         # Fastify + TypeScript REST API (PostgreSQL)
│   ├── src/
│   │   ├── server.ts              # Fastify bootstrap + plugin registration
│   │   ├── db.ts                  # pg Pool + auto CREATE TABLE IF NOT EXISTS
│   │   ├── middleware/
│   │   │   └── authenticate.ts    # JWT bearer preHandler
│   │   └── routes/
│   │       ├── auth.ts            # /signup, /login
│   │       ├── notes.ts           # /notes (CRUD, protected)
│   │       └── debug.ts           # /protected (smoke test)
│   ├── package.json
│   ├── tsconfig.json
│   └── .env                       # JWT_SECRET, DATABASE_URL — gitignored
│
├── frontend/        # Static site, one index.html per route
│   ├── index.html                 # Landing / hero
│   ├── style.css                  # ~1700 lines, single shared stylesheet
│   ├── script.js                  # Hero video rotation, logo swap, menu overlay
│   ├── auth/
│   │   ├── index.html             # Tabbed login/signup
│   │   └── auth.js                # All auth + session logic
│   ├── account/index.html         # Profile dashboard (reads localStorage username)
│   ├── about/ careers/ contact/ privacy/ tos/   # Static pages
│   ├── products/
│   │   ├── index.html
│   │   └── vector/index.html
│   ├── assets/
│   │   ├── company/               # Logos (protonyx_full_white.png, _black.png)
│   │   ├── product/vector/        # Vector product artwork
│   │   └── video/                 # Hero background videos (1–5)
│   └── .vscode/settings.json      # Live Server on port 5501
│
├── app/             # Vector desktop app (PyQt6) — EMPTY, not yet started
├── scripts/         # Admin / DB utility scripts — EMPTY
├── database/        # Legacy SQLite file (users.db) — gitignored, no longer used
├── README.md
└── .gitignore
```

There is **no root `package.json`**, no workspaces, no Turbo/Nx/Lerna, no Docker, no CI config. Treat each top-level directory as its own project.

---

## 3. Common Commands

### Backend

Run from `backend/`:

| Task | Command | Notes |
|---|---|---|
| Install deps | `npm install` | |
| Dev server | `npm run dev` | `ts-node-dev src/server.ts`, hot-reloads, serves on `http://localhost:3000` |
| Typecheck | `npx tsc --noEmit` | No npm script — invoke tsc directly |
| Build | *(none)* | No build script exists. `ts-node-dev` runs TS directly in dev. |
| Test | *(none)* | No test framework installed anywhere in the repo. Do not invent one unless asked. |
| Lint / format | *(none)* | No ESLint/Prettier config. Match existing style by reading neighboring files. |

### Frontend

The frontend is served by **VS Code Live Server** — there is no npm/Vite/Webpack step.

- Default Live Server port is **5501** (set in `frontend/.vscode/settings.json`).
- Open any `index.html` via the Live Server extension. Navigation uses root-absolute paths like `/auth/index.html`, so Live Server **must** be rooted at `frontend/` (not at the monorepo root) for links to resolve.
- Ports **5500** and **5501** (both `127.0.0.1` and `localhost`) are allowlisted by the backend CORS config — if Live Server picks a different port, requests to the API will fail.

### PostgreSQL (local dev)

The backend expects a running Postgres. Schema is created automatically at startup by `db.ts` (`CREATE TABLE IF NOT EXISTS users` and `notes`). There is **no migrations system** — to change schema, edit `db.ts` and apply changes manually to your local DB (e.g. `psql` `ALTER TABLE`).

`backend/.env` must contain:

```
JWT_SECRET=<any-string>
DATABASE_URL=postgresql://<user>:<pass>@<host>:<port>/<db>
```

---

## 4. Backend Architecture

### Request lifecycle

1. `src/server.ts` creates a Fastify instance and registers, in order:
   - `@fastify/rate-limit` — **global, 20 requests / 60 seconds per IP**. This is low; authenticated bulk operations from the frontend will hit it easily during testing.
   - `@fastify/cors` — allowlists exactly `http://127.0.0.1:5500`, `http://localhost:5500`, `http://127.0.0.1:5501`, `http://localhost:5501`. Methods: `GET, POST, DELETE, PATCH`. No `PUT`, no `OPTIONS` explicitly (Fastify handles preflight). **If you add a new frontend origin (e.g. a staging URL), it must be added here.**
   - Route modules: `authRoutes`, `noteRoutes`, `debugRoutes` — all mounted at the **root path** with no prefix.
2. `db.ts` is imported transitively; its top-level `setup()` call fires the `CREATE TABLE IF NOT EXISTS` queries on module load. This means the server will not start reliably without a reachable Postgres.
3. Protected routes use `{ preHandler: authenticate }`, which reads `Authorization: Bearer <token>`, verifies with `JWT_SECRET`, and attaches `{ id, username }` to `request.user`.

### Route module convention

Every route file exports a **default async function** that takes a `FastifyInstance` and registers routes on it:

```ts
export default async function noteRoutes(app: FastifyInstance) {
  app.post("/notes", { preHandler: authenticate }, async (request, reply) => { ... });
}
```

New route modules must be imported and `app.register(...)`'d in `server.ts`. There is no auto-discovery.

### Response shape

Every handler returns `{ success: boolean, message?: string, ...payload }`. Status codes are set explicitly with `reply.status(N).send(...)`. Current status-code conventions observed in the code:

| Situation | Code |
|---|---|
| Resource created (signup, note insert) | 201 |
| Success with body | 200 (or implicit via returning an object) |
| Missing required fields | 400 |
| Bad credentials / invalid token | 401 |
| User not found | 404 |
| Duplicate username | 409 |

**Frontend/backend mismatch to be aware of:** the backend always names the error field `message`, but `frontend/auth/auth.js` reads `data.error` on failure. Error messages currently never surface to users because of this — fixing it means either renaming the field on one side or supporting both. Don't silently "fix" one side without checking the other.

### Current endpoints

| Method | Path | Auth | Body | Notes |
|---|---|---|---|---|
| POST | `/signup` | — | `{ username, password }` | bcrypt hashes (cost 10), inserts into `users` |
| POST | `/login` | — | `{ username, password }` | Returns `{ token }`, JWT signed with 7-day expiry |
| POST | `/notes` | ✅ | `{ title, content }` | Owner is taken from JWT, not body |
| GET | `/getnotes` | ✅ | — | Returns all notes for `request.user.id`. Note: not `/notes` (GET) — the route is `/getnotes` |
| DELETE | `/notes/:id` | ✅ | — | Scoped to `user_id` so users can only delete their own |
| PATCH | `/notes/:id` | ✅ | `{ title, content }` | Also `user_id`-scoped |
| GET | `/protected` | ✅ | — | Debug smoke test: returns `Hello <username>` |

### Database

`db.ts` manages a single shared `pg.Pool` keyed off `DATABASE_URL`. Tables created at startup:

```sql
users (id SERIAL PK, username TEXT UNIQUE, password TEXT)         -- password = bcrypt hash
notes (id SERIAL PK, user_id INT FK→users.id, title TEXT, content TEXT, created_at TIMESTAMP DEFAULT now())
```

All queries use parameterized `$1, $2, ...` placeholders — keep it that way. Never interpolate user input into SQL.

### Dead / transitional code

- `better-sqlite3` is still a declared dependency (and `@types/better-sqlite3` a devDep), but **no runtime code imports it**. The project recently migrated SQLite → Postgres (commits `f7c65af`, `02d3915`, `3885130`, `c6855b6`). Don't re-add SQLite code paths. If you're tidying deps, removing `better-sqlite3` and `@types/better-sqlite3` is safe.
- `database/users.db` is a leftover SQLite file. It's gitignored and unused.
- Route handlers currently use `any` for `request`/`reply` in protected routes to keep `request.user` typing loose. Adding a proper `FastifyRequest` augmentation for `user` is a reasonable refactor but not required.

---

## 5. Frontend Architecture

### Stack

Plain static HTML + CSS + vanilla JS. **No framework, no bundler, no build step.** IBM Plex Mono from Google Fonts is the only external font. All CSS lives in one file (`frontend/style.css`, ~1700 lines) shared by every page.

### Page structure

Each route is a folder with an `index.html`. To add a page:
1. Create `frontend/<slug>/index.html`.
2. Link `../style.css`, `../script.js`, and `../auth/auth.js` with appropriate relative paths (depth depends on nesting, e.g. `products/vector/` uses `../../`).
3. Copy the `<nav class="navbar">` and the `.menu-overlay` block from an existing page — they're duplicated per-page, not componentized.
4. Use root-absolute links (`href="/about"`, `href="/auth/index.html"`) — Live Server must be rooted at `frontend/`.

### CSS system

CSS custom properties are defined in `:root` at the top of `style.css`:

```css
--bg-base: #f2f1ee       /* off-white page background */
--bg-surface: #d7d4d4    /* card/panel background */
--border: rgb(142,142,142)
--text-primary: #1f2230
--grad: linear-gradient(135deg, #3a8c6e, #2a6b9a)   /* brand gradient, used by .btn-grad etc. */
```

Use these tokens instead of hardcoding colors. The navbar floats at the top with a blurred glass effect (`backdrop-filter: blur(10px)`), and dark hero sections (`.hero`, `.vector-hero`, `.products-hero`) swap the logo to white — handled by `script.js`, see below.

### `script.js` (shared, landing + general pages)

Four independent blocks, each gated by `if (element)` so pages without the element are no-ops:
1. **Hero video rotation** — cycles `heroVideoSources` every 4s on `#heroVideo`.
2. **Navbar logo color swap** — if the page has a dark hero section, listens to `scroll` and swaps between `protonyx_full_white.png` and `_black.png` as the hero scrolls out of view. Preloads both.
3. **Product card video preview** — `.vector-card` hover plays `.preview-video`.
4. **Menu overlay** — hamburger button opens `#menuOverlay`, locks `body` scroll, fades navbar. Closes on backdrop click or `#menuCloseButton`.

### `auth/auth.js` (shared auth + session state)

- `API_URL = "http://localhost:3000"` — **hardcoded**. Update here when deploying the backend.
- JWT stored in `localStorage.token`; username in `localStorage.username`. No httpOnly cookies.
- `login()` / `signup()` are bound to form `submit` events inline in `auth/index.html` — the forms also define `switchToLoginTab()` / `switchToSignupTab()` in a page script block.
- `checkAuth()` must be called on every page; it toggles visibility classes and wires logout buttons:
  - `.auth-only` — shown only when logged in
  - `.guest-only` — shown only when logged out
  - `[data-username]` — text content replaced with stored username
  - `[data-logout]` — click binds to `logout()`
  - Pages either call `checkAuth()` directly in an inline script, or rely on the `DOMContentLoaded` listener at the bottom of `auth.js`. Both patterns exist — don't remove one without checking the other.
- Cross-tab sync: a `storage` listener re-runs `checkAuth()` when `token`/`username` change, so logging out in one tab updates all open tabs.

### Account page TODOs (in-code)

`frontend/account/index.html` has `<!-- TODO: ... GET /me -->` markers for email / plan / member-since fields. The `/me` endpoint does not exist on the backend yet — adding it is a pending task. When you add it, `auth.js` should gain a helper that calls `GET /me` with `authHeaders()` and surfaces those fields.

---

## 6. Vector Desktop App (`app/`)

Empty. Intended stack: **Python + PyQt6**, talking to the same `http://localhost:3000` (or eventually a deployed) backend. "Lens" is the name for Vector's proprietary analytics engine — when that scaffolding lands, it's likely to be a Python module imported by the PyQt app.

Currently there is nothing to build, run, or test here.

---

## 7. Conventions & Gotchas

- **No tests anywhere.** Don't add a test suite, testing framework, or CI config unless explicitly asked. When making changes, verify manually against the running dev server.
- **No lint/format config.** Match the style of the file you're editing: 4-space indentation in backend TS, 2-space in frontend HTML/JS, double quotes for strings.
- **Backend error field is `message`, frontend reads `error`** — see §4. Known issue, flag it before "fixing" one side in isolation.
- **CORS origin list is strict.** Adding a new frontend URL requires editing `server.ts`.
- **Rate limit is global and low (20/60s).** Don't be surprised by `429`s during frontend testing.
- **Passwords are bcrypt with cost 10.** Don't lower it. Don't log `user.password` anywhere.
- **JWT secret is in `.env`.** The file is gitignored; don't commit it, and don't paste real secrets into code or conversation. If you see a placeholder like `your-secret-here`, treat it as a placeholder, not a real secret to preserve.
- **Schema changes are manual.** Editing `db.ts` only adds tables via `IF NOT EXISTS` — it will not migrate existing tables. For column additions/changes, run SQL against the dev DB yourself and update `db.ts` so fresh DBs match.
- **`any`-typed handlers.** Protected-route handlers use `request: any, reply: any` to avoid typing `request.user`. Preserve this when editing nearby code unless you're explicitly tightening types.
- **Root-absolute frontend paths.** `<a href="/auth/index.html">` only resolves if Live Server is rooted at `frontend/`. If someone complains links 404, that's the first thing to check.
- **Windows dev environment.** Primary dev machine is Windows 11 with bash (Git Bash / MSYS). Paths in shells use forward slashes; `.env` line endings should be LF.
