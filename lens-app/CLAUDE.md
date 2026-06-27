# CLAUDE.md - lens-app

Guidance for Claude Code (claude.ai/code) when working **inside `lens-app/`**. This is the Vite + React + TypeScript web app for Lens analytics, served at `app.use-lens.com`. It is one of five deliverables in the Protonyx monorepo; the root `../CLAUDE.md` covers the whole platform, the Fastify backend, and the lens-api engine. Read this file first when your work is contained to `lens-app/`; reach for the root doc when you need backend endpoint contracts or the Lens engine's response shape.

> **Keep this file current.** When you add a route, a page, a widget, an env var, a dependency, a query key, or change a convention, update the relevant section here in the same change. A stale claim here costs the next session real time. If a change also affects backend contracts (new endpoint, new `/me` field, new Stripe flow), update `../CLAUDE.md` too. If it affects the engine response, update `../lens-api/CLAUDE.md`.

---

## 1. What this app is

Lens App is the browser dashboard for the **Lens** portfolio-analytics engine. A signed-in, subscribed user enters a portfolio (tickers + share counts) and a risk tier, and the app renders:

- a plain-English **Lens Brief**,
- a widget grid (Portfolio Vector, Positions, Total Equity, Sharpe, Diversification, Beta, Dividend Calendar),
- a deep **Analysis** page (caution gauge, CTA list, Monte Carlo projection fan, current vs projected allocation).

It talks to **two** backends:

| Backend | Base URL (dev) | Purpose | Auth |
|---|---|---|---|
| **Fastify** (`../backend`) | `http://localhost:3000` | Auth (login/signup/logout), `/me`, Stripe checkout/portal, subscription status | httpOnly `session` cookie (`credentials: 'include'`) |
| **lens-api** (`../lens-api`, Railway) | `https://lens-api-production-b0ab.up.railway.app` | `POST /analyze`, `GET /ticker/{symbol}/info`, `GET /health` | `X-API-Key` header (browser-direct, **dev only**) |

**The lens-api key is currently hardcoded in `src/api/lens.ts` and shipped to the browser.** This is a known pre-launch debt: before production, all `/analyze` calls must be proxied server-to-server through Fastify so the key never reaches client code. See the comment at the top of `src/api/lens.ts` and §9.

---

## 2. Commands

Run all of these from `lens-app/`:

| Task | Command | Notes |
|---|---|---|
| Install deps | `npm install` | |
| Dev server | `npm run dev` | Vite, serves on `http://localhost:5173` (HMR). **This is the only local origin the lens-api allows** besides `https://app.use-lens.com`; it is also on the Fastify CORS allowlist. Do not change the port. |
| Type check | `npx tsc -b` | Root `tsconfig.json` is a **solution file** (`files: []` + `references`), so a bare `tsc --noEmit` checks **nothing**. Use `tsc -b` (or `tsc -p tsconfig.app.json --noEmit`). |
| Build | `npm run build` | `tsc -b && vite build`, output to `lens-app/dist/`. The build fails on type errors because `tsc -b` runs first. |
| Lint | `npm run lint` | **oxlint** (not ESLint). Config in `.oxlintrc.json`: `react/rules-of-hooks: error`, `react/only-export-components: warn`. |
| Preview build | `npm run preview` | Serves `dist/` locally. |

There is **no test framework**. Do not introduce one unless explicitly asked. Verify changes manually against the running dev server.

### Environment

- `VITE_API_URL` (optional) overrides the Fastify base URL. It is read in **four** places that each declare their own `const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'`: `src/contexts/AuthContext.tsx`, `src/pages/Settings.tsx`, `src/components/common/UpgradePrompt.tsx`. If you add another file that calls Fastify, copy that exact pattern; there is no shared config module for it yet.
- The lens-api base URL and key are **not** env-driven, they are hardcoded constants in `src/api/lens.ts`.
- There is no `.env` checked in. Vite only exposes vars prefixed `VITE_`.

---

## 3. Stack and tooling

- **React 19** + **TypeScript ~6.0** (strict-ish: `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `erasableSyntaxOnly`, `verbatimModuleSyntax`). Because `verbatimModuleSyntax` is on, **type-only imports must use `import type`** (or `import { type X }`), e.g. `import { type Position } from '@/api/lens'`. Follow the existing pattern or the build breaks.
- **Vite 8** + `@vitejs/plugin-react`. Path alias `@/` -> `src/` is set in **both** `vite.config.ts` (runtime) and `tsconfig.app.json` (types). Always import via `@/...`, not relative `../../`.
- **Tailwind CSS v4** via `@tailwindcss/postcss` (see `postcss.config.js`). Design tokens are defined in `src/index.css` with the v4 `@theme` block, **not** a JS config. See §6.
- **react-router-dom v7** for routing.
- **@tanstack/react-query v5** for the single `/analyze` cache.
- **recharts v3** for all charts (line/area/pie), but **only via the wrapper layer in `src/components/charts/`** — no file outside that directory may import from `recharts`. The wrappers (`LensLineChart`, `LensAreaChart`, `LensAreaFanChart`, `LensPieChart`, plus the higher-level `CyclablePieChart` that composes `LensPieChart`) bake in the styling.md §Charts rules (horizontal grid only, 11px tertiary axis ticks, brand-gradient strokes, custom tooltip, animate-once on mount) so chart styling cannot drift. Shared internals (`CHART_COLORS`, `PIE_COLORS`, `GradientDefs`, `LensTooltip`, `AXIS_TICK_PROPS`, `GRID_PROPS`, `useAnimateOnce`) live in `src/components/charts/chartUtils.tsx`. See §7.
- **lucide-react** for icons.
- **class-variance-authority** + **clsx** + **tailwind-merge** for the `cn()` helper and the button variants.
- **shadcn/ui** scaffolding (`components.json`, `src/components/ui/`) is **legacy**. The project no longer follows shadcn conventions; only `button.tsx` and `input.tsx` are actively used and have been restyled for the dark theme. `card.tsx`, `label.tsx`, `textarea.tsx`, `badge.tsx` are unused leftovers, safe to delete if you are cleaning up. `@radix-ui/react-label` and `@radix-ui/react-slot` are only here because of these primitives (`react-slot` is used by `button.tsx`'s `asChild`).

### Stale config to be aware of

- **`tailwind.config.js` is dead.** It is a leftover from the shadcn/Tailwind-v3 era (HSL `hsl(var(--border))` colors, `darkMode: ['class']`, `container`, `borderRadius`). Tailwind v4 ignores it because config now lives in `src/index.css`'s `@theme`. Do not add tokens there expecting them to work; add them to `@theme` in `index.css`. The file is kept only because `components.json` still points at it. Treat `index.css` as the single source of truth for design tokens.
- `components.json` is the shadcn CLI config (also legacy). You will almost never run the shadcn CLI here.

---

## 4. Routing and auth flow

`src/App.tsx` wires the whole tree: `QueryClientProvider` -> `AuthProvider` -> `BrowserRouter` -> `Routes`.

| Path | Component | Guard |
|---|---|---|
| `/login` | `Login` | public |
| `/onboard` | `Onboard` | `ProtectedRoute` |
| `/dashboard` | `Dashboard` | `ProtectedRoute` |
| `/analysis` | `Analysis` | `ProtectedRoute` |
| `/profile` | `Profile` | `ProtectedRoute` |
| `/settings` | `Settings` | `ProtectedRoute` |
| `/success` | `Success` | `ProtectedRoute` (Stripe redirect target) |
| `*` | — | `<Navigate to="/login" replace />` |

### AuthContext (`src/contexts/AuthContext.tsx`)

Real Fastify auth over an **httpOnly `session` cookie**. No token is ever stored in `localStorage` or JS-readable state.

- On mount, `GET /me` with `credentials: 'include'`. 200 -> `setUser(data.user)` + `isAuthenticated = true`. Any failure -> stays logged out. `loading` flips false in `finally`.
- `login(username, password)` -> `POST /login` (cookie set by server), then a second `GET /me` to populate `user`. The `username` field accepts a username **or** an email (backend resolves both).
- `signup(username, email, password)` -> `POST /signup`, then calls `login()` because **signup does not set a cookie** (only `/login` does).
- `logout()` -> `POST /logout` (clears cookie), then clears local state.
- Errors are thrown as `Error(data.message ?? '...')`. The backend's error field on the wire is always `message`.

`User` shape exposed by the context: `{ id, username, email, plan, subscription_status: 'inactive'|'active'|'cancelled', member_since?, beta_access?, email_verified? }`.

`useAuth()` throws if called outside `AuthProvider`.

### ProtectedRoute (`src/components/ProtectedRoute.tsx`)

Returns `null` while `loading` (avoids a login flash on refresh), redirects to `/login` when not authenticated, otherwise renders children. **It does not gate on subscription** — that is done per-page (see §7).

---

## 5. Data flow: positions, settings, and analysis

There is **no positions table on the backend.** Portfolio state lives entirely in cookies on the client.

### Cookies (`src/lib/cookies.ts`)

Two cookies, both `path=/`, `max-age` 30 days, `SameSite=Lax`:

- `lens_positions` — JSON array of `Position` (`{ ticker, shares, equity, price, sector?, name?, added_at? }`).
- `lens_settings` — `{ risk_tier: 'low'|'regular'|'high' }`. Default when unset/malformed is `{ risk_tier: 'regular' }`.

Accessors: `getPositions()`, `setPositions()`, `getSettings()`, `setSettings()`. All are defensive (malformed JSON returns the empty/default). `RiskTier` and `StoredSettings` types are exported here.

### useLensAnalysis (`src/hooks/useLensAnalysis.ts`)

The single react-query hook the whole app shares:

```ts
queryKey: ['lens-analysis', positions, settings.risk_tier]
queryFn: () => lensApi.analyze({ positions, settings: { risk_tier } })
enabled: positions.length > 0
staleTime: 5 * 60 * 1000   // 5 min
retry: 1
```

Dashboard, Analysis, and Profile all call `useLensAnalysis()` and share the cached result (same query key), so the portfolio is sent to the Railway engine once per `(positions, risk_tier)` state. **When you mutate positions or risk tier, invalidate `['lens-analysis']`** so the cache refetches — the existing code does this via `queryClient.invalidateQueries({ queryKey: ['lens-analysis'] })` in `Dashboard.addPosition`, `Settings.changeRisk`, and `Settings.persistPositions`. Match that pattern.

### lensData.ts (`src/lib/lensData.ts`) — the derivation layer

This file is the boundary between the raw `/analyze` response and the UI. **Read it before adding any dashboard number.** Two categories:

1. **Real engine outputs**, read straight from the response via safe accessors (`rec`/`num`/`str` coerce defensively against the loosely-typed `pool_results`): `totalEquity`, `portfolioSlopePct`/`slopeState`, `portfolioVolPct`, `portfolioBeta`, `sectorWeights`/`sectorCount`/`concentrationSeverity`, `tickerTrendPct`, `tickerCurrentPrice`, `dividendRows`. These dig into `result.pool_results[analyzer].portfolio_result` / `.ticker_results` and `result.pool_results._positions_summary`. Two more breakdowns feed the Diversification widget's cyclable pie: `tickerWeights(result, positions)` (equity-% per ticker, live price from the result) and `assetTypeWeights(positions)` (equity-% per asset type). The latter is a **heuristic**, not an engine output: `classifyAssetType(p)` maps a position to `Stock | ETF | Mutual Fund | Bond` from the data already on it (resolved sector `'ETF'` -> ETF, a known bond-ETF set -> Bond, a 5-letter-ending-in-X ticker -> Mutual Fund, else Stock). Swap it to a real `quote_type` field once the lens-api exposes one.
2. **Derived estimates** the engine does NOT return (see `../lens-api/CLAUDE.md` §13) — these are computed deterministically and **must stay labelled as estimates in the UI**:
   - **Sharpe ratio** = `(slope - 4.5%) / volatility`, `RISK_FREE_PCT = 4.5`. `sharpeRatio()` returns `null` when vol is ~0.
   - **Monte Carlo fan** (`buildMonteCarlo`) — the **projection** (right of "Today") is analytic GBM quantile bands from portfolio drift + vol (these are distribution percentiles, so they are smooth by definition, not simulated random paths). Quantile z-scores p10/p90 = ±1.2816, p25/p75 = ±0.6745. Builds a "current" and an "improved" scenario (acting on CTAs trims vol and nudges drift up, scaled by caution score) and an `improvementDollars` delta. The **historical lead-in** (left of "Today") now uses the **real** equity curve when `buildMonteCarlo(result, historyEquity)` is passed one (down-sampled to 12 % -return points); it falls back to a smooth drift back-cast when history is absent.
   - **Equity sparkline / 5-day change** — `TotalEquityWidget` now renders the **real** portfolio equity curve from `usePortfolioHistory` (jagged daily closes); the 5-day change compares the last close to ~5 trading days prior. It falls back to a slope-synthesized straight line only while history is loading or if it fails (footnote switches "Live daily closes" / "Estimated from 6-month trend"). The Portfolio Vector chart stays a straight line **by design** — it is the literal linear-regression line, not a price series.

   **Why these were "flat/linear":** the `/analyze` response is all scalars (no time series), so anything synthesized from a single scalar is a straight line. Real jaggedness comes from the separate `/ticker/{symbol}/history` endpoint via `usePortfolioHistory` (see §5 → that hook). Do not try to make these jagged by adding noise; use real history.

Other helpers in this file: classification bands (`sharpeClass`, `betaClass`, `cautionClass`), CTA presentation (`ctaActionLabel`, `ctaAccent`), the **brief tokenizer** (`tokenizeBrief` — regex-colors tickers/money/percent/action words for `BriefText`), `sectorWeightsFromPositions` (for the projected-allocation pie), formatters (`formatCurrency`, `formatSignedCurrency`, `formatPercent`), and `PIE_COLORS`. Colors are referenced as CSS custom properties (`var(--color-accent-green)` etc.), which resolve against the `@theme` tokens.

### Subscription gating (`src/lib/subscription.ts`)

`isSubscribed(user)` returns `true` when `subscription_status === 'active'` **or** `plan === 'pro'`. Gate on this, **not** on `plan` alone: the seeded dev `testuser` is `plan='free'` but `subscription_status='active'`, so gating on plan would wrongly block it. The Pro/Free badge in Profile/Settings also follows `isSubscribed()`.

---

## 6. Design system (`src/index.css` + `styling.md`)

**`styling.md` (in `lens-app/`) is the single source of truth for the visual design.** Do not change gradient hex values, the font, or the 8px spacing unit without explicit instruction. `src/index.css` implements that spec; this section maps the spec onto the actual tokens/classes.

Tailwind v4. **All color/type tokens live in the `@theme` block in `src/index.css`** — there is no JS Tailwind config in effect. A token like `--color-accent-teal` auto-generates `bg-accent-teal`, `text-accent-teal`, `border-accent-teal`, and supports opacity (`bg-accent-teal/10`).

Palette (dark theme, Sora font). The app's token names predate styling.md, so the values below are the spec values under the existing names (the spec's own names are also defined as identical aliases, e.g. `--color-gain`, `--color-brand-teal`):

| Group | Tokens (value = styling.md) |
|---|---|
| Surfaces | `base #111318` (bg-base), `card #1a1d24` (bg-surface), `card-hover #21242d` (bg-elevated), `sidebar #111318`, `subtle #2a2d35` (border) |
| Text | `primary #f0f2f5`, `secondary #8b90a0` (labels/timestamps/helper copy), `muted #4a4f5e` (= spec text-tertiary; disabled/placeholder only) |
| Brand/semantic | `accent-teal #14b8a6` (brand teal), `accent-blue #38bdf8` (brand sky), `accent-green #3ecf8e` (gain), `accent-red #f16b6b` (loss), `accent-yellow`/`accent-orange #f5a623` (caution — the spec has no orange) |

Note the **text-role rule**: helper copy, timestamps, footnotes and form labels use `text-secondary`; `text-muted` is reserved for disabled/placeholder/empty (`--`). Don't use `text-muted` for captions.

There is also a set of **semantic aliases** (`background`, `foreground`, `border`, `input`, `ring`, `destructive`, etc.) kept so the leftover shadcn primitives still render in dark mode.

**Type scale** (`--text-axis`/`caption`/`label`/`body`/`ui`/`heading-sm`/`heading-md`/`metric`/`score` = 11/12/13/14/14/16/20/28/56px, defined in `@theme`). Weight discipline: only **400 / 500 / 600** (never 700/800/300); 600 is reserved for meaningful numbers (metric values, the caution score) and headings, not descriptive/label text. Tracking: text >=20px tightens to `-0.02em` (a base rule covers `h1-h3`; add `tracking-[-0.02em]` on large metric spans). Card/section titles are heading-md (`text-xl`/600), page titles too; metrics are `text-[28px]`/600; the caution score is 56px/600.

**Spacing**: 8px base, every gap a multiple. Card padding 24px (`p-6`, baked into `Panel`), section gaps 32px (`space-y-8`), grid gutters 24px (`gap-6`), max content width `1280px` centered (set in `AppShell`). `--space-1..6` are exposed in `:root` for raw CSS.

**Gradient discipline (hard rule):** the brand gradient `linear-gradient(135deg, #14b8a6 0%, #38bdf8 100%)` appears in only these places — (1) the Caution Score gauge arc + 56px value, (2) the primary CTA button fill (`button` `gradient` variant), (3) gradient hairline separators, (4) the active sidebar nav indicator. Charts additionally use it as an SVG line/area stroke per the styling.md §Charts spec. Helpers `.text-gradient` / `.bg-gradient-brand` are defined in `index.css`; do not add gradient anywhere else (no gradient badges, progress bars, step dots, success circles — those were removed).

**Signature elements** (in `index.css`): `.tick-grid-bg` (sparse `+` crosshair SVG, applied to the `AppShell` root canvas only — never cards/modals/sidebar; do not raise its contrast) and `.gradient-hairline` (1px horizontal rule fading to transparent at both ends, layout separators only, max 2 per screen — currently one on the Analysis page under the Caution Score zone, plus the sidebar's vertical active-nav bar).

**Motion** (`index.css`): default interactive transition is `200ms ease-out` (never ease-in); `.page-fade` (opacity 0->1, 150ms) wraps the `AppShell` content and the standalone Login/Onboard/Success pages; `.caution-arc` sweeps the gauge 0->value once on load (600ms `cubic-bezier(0.16,1,0.3,1)`) — the only load animation. **No skeleton pulse** — loading blocks are static dim (`opacity-60`) surfaces.

**Cards/tables**: `Panel` is the standard card (bg-surface, 1px subtle border, `rounded-lg` = 8px, `p-6`, **no shadow** — depth comes from the surface lift over the tick grid). No `border-radius` above 8px on data cards (controls use 6px `rounded-md`). Tables/list-rows: 13px/500 uppercase secondary headers, row `hover:bg-card-hover`, no zebra striping; charts have horizontal grid lines only (`vertical={false}`), transparent background, 11px tertiary axis labels.

Use the tokens; do not hardcode hex values in components (the one acceptable exception is recharts `stroke`/`fill`/`stopColor`/gradient-stop props, which take literal colors — match the brand/semantic hexes `#14b8a6`, `#38bdf8`, `#3ecf8e`, `#f16b6b`, `#2a2d35`, `#4a4f5e`).

### Brand / logo assets

The product's full name is **Lens Arc**. Anywhere a brand mark is shown, render the real logo, **never** the bare text "Lens" or "Lens Arc".

- **Source artwork** lives in `assets/lens-arc/` (PNG, repo-tracked source of truth) and is mirrored into `src/assets/lens-arc/` so Vite can hash-bundle it via `import`. Keep the two in sync if you add/replace files. `public/lens-arc-icon.png` (a copy of `icon-rounded.png`) is the favicon, referenced from `index.html`.
- **Files:** `lens-arc-{white,dark}.png` (full icon + "Lens Arc" wordmark, ~4.5:1), `arc-{white,dark}.png` (icon + "Arc" only, for tight lockups), `icon-nobg.png` (1:1 transparent mark), `icon-square.png` / `icon-rounded.png` (1:1 mark on dark navy, rounded is the app-icon style). White variants are for the app's dark surfaces; dark variants are for light backgrounds (none in-app yet).
- **Use the `Logo` component** (`src/components/common/Logo.tsx`), never raw `<img>`. It exposes `variant: 'full' | 'full-dark' | 'icon' | 'icon-rounded'` (default `full` = white wordmark) and takes a `className` for sizing (e.g. `h-7 w-auto`); the image keeps its own aspect ratio. Current usages: Sidebar header (`full`), Login (`full`), Success page (`full`). The `full` wordmark already contains the icon, so don't pair `icon` next to it.
- The old `.text-gradient` "Lens" wordmarks in the Sidebar and Login have been replaced by the logo. Page titles are now solid `text-primary` (not gradient), per the gradient discipline in §6; `.text-gradient` remains defined but is not currently used in JSX.

---

## 7. Screen-by-screen map

All authed screens render inside `AppShell` (`src/components/layout/AppShell.tsx`): a fixed 220px `Sidebar` + a scrollable `<main className="ml-[220px] ... p-8">`. The sidebar (`Sidebar.tsx`) has the gradient "Lens" wordmark, four `NavLink`s (Dashboard, Analysis, Profile, Settings) with an active teal state, and a logout button at the bottom that calls `logout()` then navigates to `/login`. `PageHeader` renders the title, a breadcrumb, and an optional `right` slot.

| Page | File | Behavior |
|---|---|---|
| **Login** | `pages/Login.tsx` | Sign in / Sign up tabs (local `tab` state, no route change). Sign-in field is "Username or email". Sign-up posts username/email/password then auto-logs-in. On success -> `/dashboard`. Has a non-functional "Forgot password?" / "Remember me" and a TOS/Privacy notice with `href="#"` placeholders (not yet wired). |
| **Onboard** | `pages/Onboard.tsx` | 2-step wizard with a `StepDots` indicator. Step 1 = `RiskProfileCards` (tier select). Step 2 = add positions via `AddPositionModal`, multi-select to remove. "Launch Lens" writes `setSettings`/`setPositions` cookies and navigates `/dashboard`. Guarded but **not** subscription-gated (a user must be able to onboard before paying). |
| **Dashboard** | `pages/Dashboard.tsx` | Redirects to `/onboard` when no positions cookie. If `!isSubscribed(user)` renders `<UpgradePrompt/>` instead of data. Otherwise: Lens Brief panel (brief text + an "Analysis" link to `/analysis`) + the 7-widget grid. Loading shows static skeletons; error shows a retry panel. Position add/remove now lives only in Onboard and Settings. |
| **Analysis** | `pages/Analysis.tsx` | Same onboard-redirect + subscription gate. Renders Lens Brief (with a fixed legal `DISCLAIMER`), Caution gauge + CTA list, two Monte Carlo charts (current vs "With All Lens Projections +$X"), a projection-explanation panel (uses `result.full_report`), and current vs projected sector pies. The MC fan and projected allocation are derived (see §5). |
| **Profile** | `pages/Profile.tsx` | Avatar (first initial), username, member-since, total equity (from `useLensAnalysis`), and an info table (username/email/plan badge/member since/beta access). Read-only. |
| **Settings** | `pages/Settings.tsx` | General (Theme/Date format dropdowns — **display-only, not persisted**), Investment Style (`RiskProfileCards`, persists + invalidates query), Subscription (Pro badge + "Manage Billing" via `POST /stripe/portal` when subscribed, else "Upgrade to Lens Pro" via `POST /stripe/create-checkout-session`), six **placeholder** `Collapsible` sections ("coming soon"), Positions CRUD (add/remove, "Edit" is disabled), and an About section that pings `lensApi.health()` for live API status. |
| **Success** | `pages/Success.tsx` | Stripe post-checkout landing. Shows a checkmark + "Subscription active", auto-redirects to `/dashboard` after 3s. |

### Components

- `components/charts/` — the **chart wrapper layer**, the only place that imports `recharts` (§3). Components: `LensLineChart` (line chart, optional brand-gradient stroke + dashed baseline), `LensAreaChart` (area/sparkline, vertical fill gradient), `LensAreaFanChart` (projection fan: tuple bands + median/historical lines + "Today" marker), `LensPieChart` (donut + custom JSX legend, hover-lift active slice, colors from the data), and `CyclablePieChart` (composes `LensPieChart`; takes `views: { label, data: PieSlice[] }[]` and renders two rounded-triangle arrows that cycle the breakdowns with wrap-around, re-animating the pie on each switch via a `key` remount). `chartUtils.tsx` holds the shared internals (`CHART_COLORS`, `PIE_COLORS`, `GradientDefs`, `LensTooltip`, `AXIS_TICK_PROPS`, `GRID_PROPS`, `useAnimateOnce`). `PIE_COLORS` is canonical here and re-exported from `@/lib/lensData` for back-compat. All four wrappers animate once on mount only (no re-animation on data refetch). To add or change a chart, edit this layer; never import recharts elsewhere.
- `components/common/` — `Logo` (the Lens Arc brand mark, see §6), `Panel` + `CardLabel` (the standard dark card + 11px uppercase label, used everywhere), `BriefText` (renders `tokenizeBrief` output with per-kind colors), `RiskProfileCards`, `AddPositionModal` (validates the ticker via `lensApi.getTickerInfo` and builds the `Position` from the live price/sector/name; rejects unknown tickers), `SectorPie` (thin wrapper over `LensPieChart`; keeps its `{ slices, height }` props), `CycleControl` (the reusable left/right rounded-triangle arrow pair + centered label; used by `CyclablePieChart` and the Portfolio Vector style cycler), `UpgradePrompt` (the paywall card; hits Stripe checkout).
- `components/widgets/DashboardWidgets.tsx` — six of the seven dashboard widgets, each takes `{ result: LensResult }` (Portfolio Vector lives in its own file, re-exported from here). Total Equity synthesizes its sparkline from the slope/real history (via `LensAreaChart`); Positions reads live per-ticker price/trend from the result; Diversification/Beta/Sharpe/Dividend Calendar read their respective analyzer outputs. The Diversification widget uses `CyclablePieChart` to cycle three breakdowns (By Sector / By Ticker / By Type) built from `sectorWeights` / `tickerWeights` / `assetTypeWeights`; a local `colorize()` assigns `PIE_COLORS` by index.
- `components/widgets/PortfolioVector.tsx` — the **Portfolio Momentum** widget (titled "Portfolio Momentum"; the file/component keep the `PortfolioVector` name), deliberately **not a chart**: a glanceable "which way is the book heading" indicator. The equity-weighted regression slope is classified into one of 5 ordered tiers (`crash | down | flat | up | moon`, labelled Falling / Slipping / Flat / Rising / Surging, red->orange->grey->green->teal) by `classifyTier()` and rendered as a **Status Ladder** (moon on top, crashing at the bottom). A glowing rail slides to the portfolio's current rung on mount (600ms `cubic-bezier(0.16,1,0.3,1)`, matching the caution arc), rows stagger-fade in, and hovering any rung previews that level (row highlight + a caption that follows the hovered rung), mirroring the pie charts' hover model. Thresholds (±4% / ±15% on the slope) are tunable in `classifyTier`. The other four explorational styles and the `CycleControl` cycler were removed once this one was chosen.
- `components/analysis/` — `CautionGauge` (hand-rolled SVG arc, not recharts), `CtaList`, `MonteCarloChart` (thin wrapper over `LensAreaFanChart`; keeps its `{ points }` prop).
- `components/ui/` — `button.tsx` (CVA variants: `gradient`, `default`, `outline`, `teal`, `red`, `ghost`, `destructive`, `link`; sizes `default`/`sm`/`lg`/`icon`; `asChild` via radix `Slot`) and `input.tsx`. The rest are unused.
- `components/layout/` — `AppShell`, `Sidebar`, `PageHeader`.

---

## 8. The lens-api client (`src/api/lens.ts`)

Single typed client object `lensApi`:

- `analyze(req)` -> `POST /analyze` with `X-API-Key`. Returns `LensResult` (see the interface in the file: `brief`, `color`, `caution_score`, `threat_level`, `action_type`, `recommended_tickers`, `deposit_amount`, `underweight_sector`, `ctas[]`, `full_report[]`, `pool_results`, `projected_positions[]`, `net_cta_delta`). `pool_results` is intentionally `Record<string, unknown>` — it is unpacked defensively in `lensData.ts`.
- `getTickerInfo(symbol)` -> `GET /ticker/{symbol}/info`. Returns `{ name, sector, market_cap, pe_ratio, dividend_yield, current_price }` (all nullable). **Throws on unknown ticker (404)** — `AddPositionModal` relies on this to validate.
- `getTickerHistory(symbol, period='1y')` -> `GET /ticker/{symbol}/history?period=`. Returns `TickerHistoryPoint[]` (`{ date, open, high, low, close, volume }`), real daily OHLCV from yfinance. `period` is one of `1mo|3mo|6mo|1y|2y|5y` (`HistoryPeriod`). Consumed by `usePortfolioHistory` (`src/hooks/usePortfolioHistory.ts`), which fetches every position's history in parallel and sums `shares × close` over the dates common to all of them to produce the real portfolio equity curve (used by the Total Equity sparkline and the Monte Carlo historical lead-in — see §5).
- `health()` -> `GET /health` (no auth). Used by the Settings About section.

`handleResponse<T>` reads the FastAPI error shape `{ detail }` on non-2xx and throws `Error(detail)`.

`Position`, `LensSettings`, `LensResult`, `CTA`, `ActionType`, `Severity`, `TickerInfo`, etc. are all exported from this file — it is the canonical type source for portfolio/engine data. Import types from `@/api/lens`.

---

## 9. Conventions and gotchas

- **No em dashes anywhere** (copy, comments, commit messages). Use commas, periods, parentheses, or a hyphen. This is a repo-wide rule.
- **Import via `@/`**, never deep relative paths. Use `import type` / `import { type X }` for type-only imports (`verbatimModuleSyntax`).
- **Type-check with `tsc -b`**, never bare `tsc --noEmit` (root tsconfig is a solution file that checks nothing). The build runs `tsc -b` first, so type errors block builds.
- **Lint with oxlint** (`npm run lint`), not ESLint. Respect `react/rules-of-hooks`.
- **Gate features on `isSubscribed(user)`**, never on `plan` alone.
- **Invalidate `['lens-analysis']`** whenever you mutate positions or risk tier, or Dashboard/Analysis will show stale data.
- **`VITE_API_URL` is duplicated per-file**, there is no shared backend-config module. If you find yourself adding a fourth Fastify call site, consider extracting `BACKEND_URL` to `src/lib/` (and update this doc), but match the existing inline pattern until then.
- **Theme tokens go in `src/index.css` `@theme`**, not `tailwind.config.js` (which is dead). Don't hardcode hex in components except in recharts color props.
- **The lens-api key is exposed client-side (`src/api/lens.ts`).** This is the single biggest pre-launch item: move `/analyze`, `/ticker/*/info`, and `/health` behind Fastify (server-to-server, cookie-authed) and delete the hardcoded key. Don't add new browser-direct lens-api calls that widen this exposure without flagging it.
- **Live config debt to watch:** the Stripe `cancel_url` on the backend points at `/portfolio` (per `../CLAUDE.md`), but this app has no `/portfolio` route (it's `/onboard`/`/dashboard`). If you touch the checkout flow, reconcile the redirect targets with the actual routes here (`/success` exists; `/portfolio` does not).
- **No backend persistence for portfolios.** Everything portfolio-related is cookie state. Don't assume a positions API exists; if one is added, migrate `cookies.ts` and this section together.
- **No tests, no CI.** Verify against `npm run dev` at `localhost:5173`. Confirm the Fastify dev server (`../backend`, port 3000) and your network access to the Railway lens-api are up, or `/me` and `/analyze` will fail.

---

## 10. When you change things, update this doc

New page or route -> §4/§7. New widget or derived metric -> §5/§7. New design token -> §6. New lens-api method or changed response -> §8 (+ `../lens-api/CLAUDE.md`). New Fastify call or auth change -> §4/§9 (+ `../CLAUDE.md`). New dependency or build/lint change -> §2/§3. Treat the doc as part of the diff.
