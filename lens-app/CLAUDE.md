# CLAUDE.md - lens-app

Guidance for Claude Code (claude.ai/code) when working **inside `lens-app/`**. This is the Vite + React + TypeScript web app for Lens analytics, served at `app.use-lens.com`. It is one of five deliverables in the Protonyx monorepo; the root `../CLAUDE.md` covers the whole platform, the Fastify backend, and the lens-api engine. Read this file first when your work is contained to `lens-app/`; reach for the root doc when you need backend endpoint contracts or the Lens engine's response shape.

> **Keep this file current.** When you add a route, a page, a widget, an env var, a dependency, a query key, or change a convention, update the relevant section here in the same change. A stale claim here costs the next session real time. If a change also affects backend contracts (new endpoint, new `/me` field, new Stripe flow), update `../CLAUDE.md` too. If it affects the engine response, update `../lens-api/CLAUDE.md`.

---

## 1. What this app is

Lens App is the browser dashboard for the **Lens** portfolio-analytics engine. A signed-in, subscribed user enters a portfolio (tickers + share counts) and a risk tier, and the app renders:

- a plain-English **Lens Brief**,
- a widget grid (Lens Brief, Caution Score, Portfolio Vector, Positions, Total Equity, Sharpe, Composition, Beta, Dividend Calendar),
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

Three cookies, all `path=/`, `max-age` 30 days, `SameSite=Lax`:

- `lens_positions` — JSON array of `Position` (`{ ticker, shares, equity, price, sector?, name?, added_at? }`).
- `lens_settings` — `{ risk_tier: 'low'|'regular'|'high' }`. Default when unset/malformed is `{ risk_tier: 'regular' }`.
- `lens_layout` — JSON array of `SavedLayoutItem` (`{ widgetId, x, y, w }`, grid-cell units) for the dashboard widget grid. **Placement only — `h` is deliberately NOT persisted** (it is always re-measured on load, so content growth can never restore a stale, clipping height). Written on every edit-mode change (drag drop, add, delete) **and once when the default pack is first computed** (so the last layout is always the current one); cleared by "Reset layout".

Accessors: `getPositions()`, `setPositions()`, `getSettings()`, `setSettings()`, `getLayout()`, `setLayout()`, `clearLayout()`. All are defensive (malformed JSON returns the empty/default). `getLayout()` returns `SavedLayoutItem[] | null` — `null` when there is no saved layout or it is malformed, which signals `WidgetGrid` to fall back to the default measured pack. `setLayout(layout: LayoutItem[])` strips `h` before writing. `clearLayout()` expires the cookie (reset). `RiskTier`/`StoredSettings` types are exported here; `LayoutItem`/`SavedLayoutItem` come from `@/lib/widgetLayout`.

### Dashboard widget grid (`src/lib/widgetRegistry.tsx`, `src/lib/widgetLayout.ts`, `src/hooks/useGridMetrics.ts`, `src/components/dashboard/WidgetGrid.tsx`)

The dashboard renders a **data-driven** 12-column square-cell grid, not a hardcoded widget list. Row spans are **measured at runtime**, not guessed: the grid measures each widget's real rendered height and computes the whole-number row span that contains it, so it self-corrects for **any** portfolio (more Positions rows, longer brief, more sectors) with **zero manual span tuning**. On top of this sits an **opt-in edit mode** (drag-to-reposition, add, delete — see §7); it is additive because it only mutates the coordinate model below. Placement is **manual and non-displacing: widgets never move to make room for one another** — a drag lands only on open space, dropping over another widget snaps back, and add/delete leave the other widgets untouched (there is **no auto-reflow / compaction**). **Edit mode is OFF on every load and the grid then renders exactly the measured static grid** — a launch-safety requirement, not a preference.

- **`widgetRegistry.tsx`** — the single source of truth every grid phase reads from. `WIDGET_REGISTRY` is an ordered array of `{ id, title, render: (r: LensResult) => ReactElement, defaultSpan: {w,h}, minSpan?, maxSpan?, defaultVisible }`, one entry per widget. `render` wraps the finalized widget component (`<XWidget result={r} />`), so the grid never touches widget internals. **`defaultSpan.w` is the authoritative width; `defaultSpan.h` is now a MINIMUM FLOOR** ("never render shorter than this", to keep intentional shapes like the caution-score square) — measurement raises it as needed, so floors are set low: `position-actions 2×3, lens-brief 7×3, caution-score 3×3, total-equity 6×2, composition 6×3, portfolio-momentum 3×3, positions 5×3, sharpe 3×2, beta 3×2, dividend-calendar 4×2`. **Exception - `lockHeight?: boolean`:** when set (currently `lens-brief` and `position-actions`), `defaultSpan.h` is an EXACT locked height, not a floor - the grid uses it verbatim and skips the measure-raise, so the widget never grows a row regardless of content. A locked widget must contain its own overflow (the Lens Brief scrolls its text area and pins the Analysis button below; Position Actions just fills its cell with two buttons); it is also excluded from the DEV clip guard. `title` labels the Add Widget menu and the remove control; `defaultVisible` seeds the default pack; `minSpan`/`maxSpan` are still unused (data-ready for the future resize phase). `getWidget(id)` looks up an entry. It exports **data + a render map only, never a component** (keeps oxlint `react/only-export-components` happy). **Registry order == default dashboard order** (fed to the packer); the top band tiles cleanly (`[position-actions(2) | lens-brief(7) | caution(3)]` = 12), then later groupings overflow 12 so those widgets wrap onto their own rows; each row's height is set by measurement (except the `lockHeight` widgets).
- **`widgetLayout.ts`** — grid geometry + layout model + fit math + the edit-mode helpers. `GRID_COLUMNS = 12` (clean divisibility: 2/3/4/6) and `GRID_GAP = 24` (px, matches the §6 `gap-6` gutter) are the single source of grid size. `LayoutItem = { widgetId, x, y, w, h }`, `SavedLayoutItem = { widgetId, x, y, w }` (cell units). `placeWidgets(footprints, columns)` is the deterministic first-fit packer (default placement). The **pure fit helpers** are the clip-avoidance calculation, side-effect-free: `widgetPxWidth(w, cellSize, gap)`; `rowsForHeight(contentPx, cellSize, gap) = ceil((contentPx + gap) / (cellSize + gap))`; `fitSpan(floorH, contentPx, cellSize, gap) = max(floorH, rowsForHeight(...))`. The **edit-mode helpers** are pure (clone-then-mutate, identity = `widgetId`) and **non-displacing — no widget is ever moved to make room for another** (there is no reflow/compaction engine): `collides(a,b)` (AABB, never self); `getColliders(layout, item)`; `tryMoveElement(layout, id, tx, ty)` (clamp in bounds; returns the new layout **only if the destination is free**, else `null` so the caller rejects the drop); `placeNew(layout, item)` (first-fit scan for the first free slot, append — nothing else moves); `removeWidget(layout, id)` (drop the item, leaving its gap open). Callers always pass a fresh array; state is never mutated in place.
- **`useGridMetrics.ts`** — a `ResizeObserver` hook returning `{ ref, cellSize }` where `cellSize = (containerWidth - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS`. The grid sets `grid-auto-rows: {cellSize}px` inline so **row height == column width == square cells**. `cellSize` is `0` until first measured.
- **`WidgetGrid.tsx`** (`{ result }`) — **two-pass measure-then-place** plus edit-mode interaction (full mechanics in §7). PASS 1 renders **every registry widget** (not just placed ones, so any can be added) in a hidden off-screen layer at its true column pixel width (auto height) and measures each natural content height. On load it builds the layout: **if a saved layout exists** it rebuilds from the cookie's `(x, y, w)` + freshly measured `h` **at its exact saved position** (no compaction); **otherwise** it runs the default first-fit pack (unchanged). PASS 2 renders the real grid at explicit coordinates, each cell an `h-full w-full [&>*]:h-full` wrapper stretching the widget's **outer Panel** into its cell **without editing the widget**. No fixed height, so it grows with content and inherits the AppShell `<main>` scroll (scrollbar only when the page overflows the viewport).

**The `lens_layout` cookie is authoritative for PLACEMENT (`x`, `y`, `w`) only; `h` is always re-measured.** On load the saved placement is rebuilt with fresh measured heights **exactly where the user left each widget** (no reflow/compaction, so an arrangement never shuffles on reload; the trade-off is that a widget whose content grows past its slot can overlap the one below until it is moved). **The last layout is always the current one:** the cookie is written on every edit (drag drop / add / delete) via `commit()`, **and also once when the default pack is first computed** (no cookie yet), so a fresh visitor's initial arrangement is persisted immediately rather than recomputed each load. `clearLayout()` (Reset) clears the cookie and drops back to the default measured pack (which is then re-persisted).

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

1. **Real engine outputs**, read straight from the response via safe accessors (`rec`/`num`/`str` coerce defensively against the loosely-typed `pool_results`): `totalEquity`, `portfolioSlopePct`/`slopeState`, `portfolioVolPct`, `portfolioBeta`, `sectorWeights`/`sectorCount`/`concentrationSeverity`, `tickerTrendPct`, `tickerCurrentPrice`, `dividendRows`. These dig into `result.pool_results[analyzer].portfolio_result` / `.ticker_results` and `result.pool_results._positions_summary`. Two more breakdowns feed the Composition widget's cyclable pie: `tickerWeights(result, positions)` (equity-% per ticker, live price from the result) and `assetTypeWeights(positions)` (equity-% per asset type). The latter is a **heuristic**, not an engine output: `classifyAssetType(p)` maps a position to `Stock | ETF | Mutual Fund | Bond` from the data already on it (resolved sector `'ETF'` -> ETF, a known bond-ETF set -> Bond, a 5-letter-ending-in-X ticker -> Mutual Fund, else Stock). Swap it to a real `quote_type` field once the lens-api exposes one.
2. **Derived estimates** the engine does NOT return (see `../lens-api/CLAUDE.md` §13) — these are computed deterministically and **must stay labelled as estimates in the UI**:
   - **Sharpe ratio** = `(slope - 4.5%) / volatility`, `RISK_FREE_PCT = 4.5`. `sharpeRatio()` returns `null` when vol is ~0.
   - **Monte Carlo fan** (`buildMonteCarlo`) — the **projection** (right of "Today") is analytic GBM quantile bands from portfolio drift + vol (these are distribution percentiles, so they are smooth by definition, not simulated random paths). Quantile z-scores p10/p90 = ±1.2816, p25/p75 = ±0.6745. Builds a "current" and an "improved" scenario (acting on CTAs trims vol and nudges drift up, scaled by caution score) and an `improvementDollars` delta. The **historical lead-in** (left of "Today") now uses the **real** equity curve when `buildMonteCarlo(result, historyEquity)` is passed one (down-sampled to 12 % -return points); it falls back to a smooth drift back-cast when history is absent.
   - **Equity chart / timeframe** — `TotalEquityWidget` renders the **real** portfolio equity curve from `usePortfolioHistory('5y')` (jagged daily closes) through the `EquityChart` wrapper. A vertical up/down cycler (`VerticalCycleControl`) steps the timeframe (1D / 1W / 1M / 3M / 1Y / ALL, **default 1Y**); the widget fetches the max range once and re-slices to the selected window client-side (`windowPoints`). Because the lens-api serves **daily** closes only, 1D / 1W are coarse (a handful of points). It falls back to a slope-synthesized straight line (`synthPoints`, with generated dates) only while history is loading or if it fails. The big equity number and the area color green/red by the selected window's net change. The Portfolio Vector chart stays a straight line **by design** — it is the literal linear-regression line, not a price series.
     - **X-axis is the "Ruler"**: faint full-height guide lines through the plot at ~5 evenly spaced points with a date label at the base of each (formatted per timeframe by `fmtShort`). Positions are computed against a hidden numeric x-domain (`[0, n-1]`) so the HTML guide lines/labels align to the data points. The hover tooltip always shows the full date + equity. (Four other axis styles were prototyped and removed once Ruler was chosen.)

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
| Brand/semantic | `accent-teal #4cb1f9` (interactive accent / selection — a solid mid-tone of the brand gradient; **token name is legacy**, the accent is now blue not teal), `accent-blue #38bdf8` (brand gradient start), `accent-green #3ecf8e` (gain), `accent-red #f16b6b` (loss), `accent-yellow`/`accent-orange #f5a623` (caution — the spec has no orange) |

Note the **text-role rule**: helper copy, timestamps, footnotes and form labels use `text-secondary`; `text-muted` is reserved for disabled/placeholder/empty (`--`). Don't use `text-muted` for captions.

There is also a set of **semantic aliases** (`background`, `foreground`, `border`, `input`, `ring`, `destructive`, etc.) kept so the leftover shadcn primitives still render in dark mode.

**Light / dark theming.** Dark is the default — the `@theme` values above are the dark palette. Light mode is a **`.light` class on `<html>`** that re-declares the surface/text tokens (and `.tick-grid-bg` / scrollbar) under a `:root.light { ... }` block in `index.css`; the generated Tailwind utilities read `var(--color-*)`, so everything re-themes automatically. Brand + semantic colors (accent-teal/blue/green/red/yellow) are **shared** across both themes. `ThemeContext` (`src/contexts/ThemeContext.tsx`, provider in `App.tsx`) owns the `'light' | 'dark'` state, toggles the class, and persists to `localStorage['lens-theme']`; `index.html` applies the class pre-paint to avoid a flash. Switch it via the `TopBar` sun/moon button or the Settings → General → Theme dropdown. The `Logo` component is theme-aware (its `full` wordmark swaps to the dark-text asset in light mode). Note: the chart wrapper layer (`chartUtils.tsx` `CHART_COLORS`) still uses fixed hexes for grid/axis (recharts needs literal colors, not `var()`), so charts aren't fully retuned for light — grid/axis read as mid-gray on white, which is acceptable but not theme-perfect.

**Type scale** (`--text-axis`/`caption`/`label`/`body`/`ui`/`heading-sm`/`heading-md`/`metric`/`score` = 11/12/13/14/14/16/20/28/56px, defined in `@theme`). Weight discipline: only **400 / 500 / 600** (never 700/800/300); 600 is reserved for meaningful numbers (metric values, the caution score) and headings, not descriptive/label text. Tracking: text >=20px tightens to `-0.02em` (a base rule covers `h1-h3`; add `tracking-[-0.02em]` on large metric spans). Card/section titles are heading-md (`text-xl`/600), page titles too; metrics are `text-[28px]`/600; the caution score is 56px/600.

**Spacing**: 8px base, every gap a multiple. Card padding 24px (`p-6`, baked into `Panel`), section gaps 32px (`space-y-8`), grid gutters 24px (`gap-6`), max content width `1280px` centered (set in `AppShell`). `--space-1..6` are exposed in `:root` for raw CSS.

**Gradient discipline (hard rule):** the brand gradient `linear-gradient(135deg, #38bdf8 0%, #60a5fa 100%)` appears in only these places — (1) the Caution Score gauge arc + 56px value, (2) the primary CTA button fill (`button` `gradient` variant), (3) gradient hairline separators, (4) the active sidebar nav indicator. Charts additionally use it as an SVG line/area stroke per the styling.md §Charts spec. Helpers `.text-gradient` / `.bg-gradient-brand` are defined in `index.css`; do not add gradient anywhere else (no gradient badges, progress bars, step dots, success circles — those were removed).

**Signature elements** (in `index.css`): `.tick-grid-bg` (sparse `+` crosshair SVG, applied to the `AppShell` root canvas only — never cards/modals/sidebar; do not raise its contrast) and `.gradient-hairline` (1px horizontal rule fading to transparent at both ends, layout separators only, max 2 per screen — currently used on the Commodity page's About panel, plus the sidebar's vertical active-nav bar).

**Motion** (`index.css`): default interactive transition is `200ms ease-out` (never ease-in); `.page-fade` (opacity 0->1, 150ms) wraps the `AppShell` content and the standalone Login/Onboard/Success pages; `.caution-arc` sweeps the gauge 0->value once on load (600ms `cubic-bezier(0.16,1,0.3,1)`) — the only load animation. **No skeleton pulse** — loading blocks are static dim (`opacity-60`) surfaces.

**Cards/tables**: `Panel` is the standard card (bg-surface, 1px subtle border, `rounded-lg` = 8px, `p-6`, **no shadow** — depth comes from the surface lift over the tick grid). No `border-radius` above 8px on data cards (controls use 6px `rounded-md`). Tables/list-rows: 13px/500 uppercase secondary headers, row `hover:bg-card-hover`, no zebra striping; charts have horizontal grid lines only (`vertical={false}`), transparent background, 11px tertiary axis labels.

**Scroll areas (one framework)**: there is a single app-wide dark scrollbar styled on `*` in `index.css` (10px, `#2a2d35` thumb, `scrollbar-width: thin`); it applies to the page scroll and to any in-card scroll area, so all scrolling looks the same. To make a list scrollable, give it `max-h-[...] overflow-y-auto` and it inherits the chrome — no per-list scrollbar styling. The Positions widget list does this (caps at 4 rows, `max-h-[232px] overflow-y-auto overflow-x-hidden`, with a matching `pr-2` on the header so columns stay aligned against the scrollbar gutter); `overflow-x-hidden` is needed there because the rows use a `-mx-2` hover bleed that would otherwise trigger a horizontal scrollbar.

Use the tokens; do not hardcode hex values in components (the one acceptable exception is recharts `stroke`/`fill`/`stopColor`/gradient-stop props, which take literal colors — match the brand/semantic hexes `#38bdf8`, `#60a5fa`, `#3ecf8e`, `#f16b6b`, `#2a2d35`, `#4a4f5e`).

### Brand / logo assets

The product's full name is **Lens Arc**. Anywhere a brand mark is shown, render the real logo, **never** the bare text "Lens" or "Lens Arc".

- **Source artwork** lives in `assets/lens-arc/` (PNG, repo-tracked source of truth) and is mirrored into `src/assets/lens-arc/` so Vite can hash-bundle it via `import`. Keep the two in sync if you add/replace files. `public/lens-arc-icon.png` (a copy of `icon-rounded.png`) is the favicon, referenced from `index.html`.
- **Files:** `lens-arc-{white,dark}.png` (full icon + "Lens Arc" wordmark, ~4.5:1), `arc-{white,dark}.png` (icon + "Arc" only, for tight lockups), `icon-nobg.png` (1:1 transparent mark), `icon-square.png` / `icon-rounded.png` (1:1 mark on dark navy, rounded is the app-icon style). White variants are for the app's dark surfaces; dark variants are for light backgrounds (none in-app yet).
- **Use the `Logo` component** (`src/components/common/Logo.tsx`), never raw `<img>`. It exposes `variant: 'full' | 'full-dark' | 'icon' | 'icon-rounded'` (default `full` = white wordmark) and takes a `className` for sizing (e.g. `h-7 w-auto`); the image keeps its own aspect ratio. Current usages: Sidebar header (`full`), Login (`full`), Success page (`full`). The `full` wordmark already contains the icon, so don't pair `icon` next to it.
- The old `.text-gradient` "Lens" wordmarks in the Sidebar and Login have been replaced by the logo. Page titles are now solid `text-primary` (not gradient), per the gradient discipline in §6; `.text-gradient` remains defined but is not currently used in JSX.

---

## 7. Screen-by-screen map

All authed screens render inside `AppShell` (`src/components/layout/AppShell.tsx`): a fixed 220px `Sidebar` + a scrollable `<main className="ml-[220px] ... p-8">`. The sidebar (`Sidebar.tsx`) has the gradient "Lens" wordmark, four `NavLink`s (Dashboard, Analysis, Profile, Settings) with an active teal state, and a logout button at the bottom that calls `logout()` then navigates to `/login`. `PageHeader` is a **slim inline bar**: title and breadcrumb on one line (`Title · path`), an optional `right` actions slot, and a thin `border-b` divider beneath — kept compact so it frames the page without dominating it. The Dashboard passes three placeholder widget-management icon buttons (Plus / Trash2 / Pencil, no behavior yet) into `right`.

| Page | File | Behavior |
|---|---|---|
| **Login** | `pages/Login.tsx` | Sign in / Sign up tabs (local `tab` state, no route change). Sign-in field is "Username or email". Sign-up posts username/email/password then auto-logs-in. On success -> `/dashboard`. Has a non-functional "Forgot password?" / "Remember me" and a TOS/Privacy notice with `href="#"` placeholders (not yet wired). |
| **Onboard** | `pages/Onboard.tsx` | 2-step wizard with a `StepDots` indicator. Step 1 = `RiskProfileCards` (tier select). Step 2 = add positions via `AddPositionModal`, multi-select to remove. "Launch Lens" writes `setSettings`/`setPositions` cookies and navigates `/dashboard`. Guarded but **not** subscription-gated (a user must be able to onboard before paying). |
| **Dashboard** | `pages/Dashboard.tsx` | Redirects to `/onboard` when no positions cookie. Wraps its body in `DashboardEditProvider` and (once subscribed) a `PositionsManagerProvider` whose value is the `usePositionsManager()` created here. If `!isSubscribed(user)` renders `<UpgradePrompt/>`. Otherwise it is **just** `<WidgetGrid result={result} />` (the data-driven 10-widget grid + edit mode, see §5) - there is no fixed top row anymore. Both the **Lens Brief** (`lens-brief`, `7×3`) and the **Position Actions** box (`position-actions`, `2×3`, add / manage holdings) are now grid widgets, movable/removable like any other. Loading shows static skeletons; error shows a retry panel. The three header buttons (`WidgetHeaderControls`) are now wired: **Pencil** toggles edit mode (accent `teal` variant when on), **Plus** opens the Add Widget menu (turning edit mode on first), **Trash2** resets the layout behind a small inline confirm popover. Position add/remove lives in `PositionActions`, Onboard and Settings (unrelated to widget management). |
| **Analysis** | `pages/Analysis.tsx` | Same onboard-redirect + subscription gate. Renders Lens Brief (with a fixed legal `DISCLAIMER`), Caution gauge + CTA list, two Monte Carlo charts (current vs "With All Lens Projections +$X"), a projection-explanation panel (uses `result.full_report`), and current vs projected sector pies. The MC fan and projected allocation are derived (see §5). |
| **Profile** | `pages/Profile.tsx` | Avatar (first initial), username, member-since, total equity (from `useLensAnalysis`), and an info table (username/email/plan badge/member since/beta access). Read-only. |
| **Settings** | `pages/Settings.tsx` | General (Theme/Date format dropdowns — **display-only, not persisted**), Investment Style (`RiskProfileCards`, persists + invalidates query), Subscription (Pro badge + "Manage Billing" via `POST /stripe/portal` when subscribed, else "Upgrade to Lens Pro" via `POST /stripe/create-checkout-session`), six **placeholder** `Collapsible` sections ("coming soon"), Positions CRUD (add/remove, "Edit" is disabled), and an About section that pings `lensApi.health()` for live API status. |
| **Success** | `pages/Success.tsx` | Stripe post-checkout landing. Shows a checkmark + "Subscription active", auto-redirects to `/dashboard` after 3s. |

### Components

- `components/charts/` — the **chart wrapper layer**, the only place that imports `recharts` (§3). Components: `LensLineChart` (line chart, optional brand-gradient stroke + dashed baseline), `LensAreaChart` (area/sparkline, vertical fill gradient; optional hover `Tooltip` via `showTooltip` + `tooltipFormatter`/`hideTooltipLabel`, with a styled active dot — Total Equity uses it to show the equity value as currency), `LensAreaFanChart` (projection fan: tuple bands + median/historical lines + "Today" marker; built-in hover `Tooltip` (`FanTooltip`) that resolves the hovered row from the recharts payload — the historical x labels aren't unique — and shows the projected/historical value plus the outer-band range, formatted by `valueFormatter`, with an active dot on the line), `LensPieChart` (donut + custom JSX legend, hover-lift active slice, colors from the data), `CyclablePieChart` (composes `LensPieChart`; takes `views: { label, data: PieSlice[] }[]` and renders two rounded-triangle arrows that cycle the breakdowns with wrap-around, re-animating the pie on each switch via a `key` remount), and `EquityChart` (the Total Equity area chart: date-aware hover tooltip + a "ruler" x-axis of faint full-height guide lines with dated labels, driven by a hidden numeric x-domain so the HTML overlays align to the data points). `chartUtils.tsx` holds the shared internals (`CHART_COLORS`, `PIE_COLORS`, `GradientDefs`, `LensTooltip`, `AXIS_TICK_PROPS`, `GRID_PROPS`, `useAnimateOnce`). `PIE_COLORS` is canonical here and re-exported from `@/lib/lensData` for back-compat. All four wrappers animate once on mount only (no re-animation on data refetch). To add or change a chart, edit this layer; never import recharts elsewhere.
- `components/common/` — `Logo` (the Lens Arc brand mark, see §6), `Panel` + `CardLabel` (the standard dark card + 11px uppercase label, used everywhere), `BriefText` (renders `tokenizeBrief` output with per-kind colors), `RiskProfileCards`, `AddPositionModal` (validates the ticker via `lensApi.getTickerInfo` and builds the `Position` from the live price/sector/name; rejects unknown tickers), `SectorPie` (thin wrapper over `LensPieChart`; keeps its `{ slices, height }` props), `CycleControl` (the reusable left/right rounded-triangle arrow pair + centered label; `CycleArrow` also does up/down, and `VerticalCycleControl` is the up/label/down variant used by Total Equity's timeframe stepper), `UpgradePrompt` (the paywall card; hits Stripe checkout).
- `components/widgets/DashboardWidgets.tsx` — most of the dashboard widgets, each takes `{ result: LensResult }` (Portfolio Vector, Caution Score, and Position Actions each live in their own file, re-exported from here; Position Actions takes no props and pulls its manager from context). `LensBriefWidget` (the `lens-brief` grid widget, `lockHeight` so it is always exactly `7×3`) renders `BriefText` + an "Analysis" link as a flex-column Panel (`overflow-hidden`; the text area is `flex-1 min-h-0 overflow-y-auto` so a long brief scrolls inside the locked cell, and the Analysis button sits pinned below); it uses `useNavigate` for the link. Total Equity renders the real equity curve via `EquityChart` with a timeframe stepper and swappable x-axis (see §5); Positions reads live per-ticker price/trend from the result; Composition/Beta/Sharpe/Dividend Calendar read their respective analyzer outputs. The `CompositionWidget` uses `CyclablePieChart` to cycle three breakdowns (By Sector / By Ticker / By Type) built from `sectorWeights` / `tickerWeights` / `assetTypeWeights`; a local `colorize()` assigns `PIE_COLORS` by index. The widget owns the view index (controlled `index`/`onIndexChange` on `CyclablePieChart`) so the card header count tracks the active view ("5 sectors" / "8 stocks" / "3 types"). The cycle control rides in `LensPieChart`'s `legendFooter` slot so it sits centered under the legend list (not the whole card), letting the pie run larger. Hovering a slice or a legend row lifts the matching slice and gives the legend row a tinted hover box in the slice color (mirroring the Portfolio Momentum rungs); the donut itself carries no labels. When a `legendFooter` is present the legend column is fixed to the pie height and the list fills the space above it (`flex-1 min-h-0 overflow-y-auto`), so the footer (the cycle control) stays pinned at the bottom at a constant vertical position no matter the item count; without a footer the list just caps at the pie height and scrolls. Either way the widget keeps a fixed height as holdings grow.
- `components/widgets/PortfolioVector.tsx` — the **Portfolio Momentum** widget (titled "Portfolio Momentum"; the file/component keep the `PortfolioVector` name), deliberately **not a chart**: a glanceable "which way is the book heading" indicator. The equity-weighted regression slope is classified into one of 5 ordered tiers (`crash | down | flat | up | moon`, labelled Falling / Slipping / Flat / Rising / Surging, red->orange->grey->green->teal) by `classifyTier()` and rendered as a **Status Ladder** (moon on top, crashing at the bottom). A glowing rail slides to the portfolio's current rung on mount (600ms `cubic-bezier(0.16,1,0.3,1)`, matching the caution arc), rows stagger-fade in, and hovering any rung previews that level (row highlight + a caption that follows the hovered rung), mirroring the pie charts' hover model. Thresholds (±4% / ±15% on the slope) are tunable in `classifyTier`. The other four explorational styles and the `CycleControl` cycler were removed once this one was chosen.
- `components/widgets/CautionScoreWidget.tsx` — the **Caution Score** widget, Lens Arc's flagship differentiator on the dashboard (a compact square tile). Reuses the Analysis-page `CautionGauge` at `size="sm"` (gradient arc + score value + band-color label word from `cautionClass`, plus the `.caution-arc` sweep) so the two never diverge, with its built-in caption suppressed (`caption=""`). Takes `{ result: LensResult }`.
- `components/analysis/` — `CautionGauge` (hand-rolled SVG arc, not recharts; takes `size?: 'sm' | 'lg'` (default `lg`, scales the whole gauge) and an optional `caption` — an empty string hides the sub-label; reused compact by the Caution Score dashboard widget), `CtaList`, `MonteCarloChart` (thin wrapper over `LensAreaFanChart`; keeps its `{ points }` prop).
- `components/ui/` — `button.tsx` (CVA variants: `gradient`, `default`, `outline`, `teal`, `red`, `ghost`, `destructive`, `link`; sizes `default`/`sm`/`lg`/`icon`; `asChild` via radix `Slot`) and `input.tsx`. The rest are unused.
- `components/layout/` — `AppShell`, `Sidebar`, `PageHeader`, `TopBar` (fixed top bar: screen-centered search, notifications + security popovers).
- `components/dashboard/PositionActions.tsx` — `PositionActionsWidget`, the `position-actions` grid widget (a `2×3` locked tile, placeholder content for now): a big gradient **+** (opens `AddPositionModal`) and a **Manage** button (slider icon) that opens a right slide-over **drawer** for editing share counts / deleting holdings, two buttons filling the cell. It reads its holdings manager from `PositionsManagerContext` (`src/contexts/PositionsManagerContext.tsx`), whose value is the `usePositionsManager` (`src/hooks/usePositionsManager.ts`) created in `DashboardBody` - **not** in the widget - so a mutation (which persists to the `lens_positions` cookie and invalidates `['lens-analysis']`) re-renders the page and `useLensAnalysis` refetches its keyed-by-positions query. This is **position** management, unrelated to widget management.
- `components/dashboard/WidgetGrid.tsx` — `WidgetGrid` (`{ result }`), the data-driven grid renderer, **two-pass measure-then-place** plus opt-in edit mode. **PASS 1 (measure):** a hidden layer (`absolute; left:-9999px; visibility:hidden; pointer-events:none; aria-hidden`, in layout so it measures) renders **every registry widget** (so any can be added) at exactly `widgetPxWidth(defaultSpan.w, cellSize, gap)` wide with **auto height**; each `getBoundingClientRect().height` goes into a ref map. **BUILD** (in a `useLayoutEffect` keyed `[cellSize, result]`, guarded `cellSize > 0`, `GridSkeleton` until then): if `getLayout()` returns a saved placement, rebuild from `(x,y,w)` + fresh `fitSpan`-measured `h` **at its exact position** (no compaction); else default `placeWidgets` pack, which is then **persisted to the cookie** (only when there was no saved layout) so the first computed default becomes the stored current layout. **PASS 2 (place):** the real grid renders at explicit `gridColumn`/`gridRow`, each cell an `h-full w-full [&>*]:h-full` wrapper stretching the outer Panel without editing the widget. **Edit mode (from `useDashboardEdit`, OFF by default → base render is pixel-identical):** each cell becomes a whole-card drag handle via native **Pointer Events** — `pointerdown` records the grab offset + `setPointerCapture` (ignored if it starts on the remove `[data-remove]` button); `pointermove` past a 4px threshold maps the card corner to a target `(col,row)` against the grid's live `getBoundingClientRect()` (accounts for scroll), then calls `tryMoveElement` — **placement is non-displacing, so the other widgets never move**; the call returns the committable layout when the target is open or `null` when it overlaps another widget (tracked as `drag.valid`, which flags the dragged card with a red ring). The dragged card translates to follow the pointer; `pointerup` commits **only a valid move onto open space** (`setLayout` state + cookie), while an invalid drop or a sub-threshold move (click) leaves the layout untouched (snap back). In edit mode the inner content is `pointer-events-none` (so drags aren't stolen by widget internals), the card gets a teal ring + `cursor-grab`, and a red **X** remove control (top-right, `stopPropagation` on its `pointerdown`) removes the widget (`removeWidget` + persist, leaving its gap open). Add/reset are published up via `setGridActions({ availableWidgets, addWidget, resetLayout })` for the header. A **DEV-only** `useEffect` warns on any content-exceeds-cell clip (`"<id> CLIPS: ..."`) or AABB overlap after every commit — the standing guard that the layout stays overlap-free. Backed by `@/lib/widgetRegistry`, `@/lib/widgetLayout` (fit helpers + non-displacing edit helpers), `@/lib/cookies`, `@/hooks/useGridMetrics`, `@/contexts/DashboardEditContext`.
- `components/dashboard/AddWidgetMenu.tsx` — presentational popover anchored under the header Plus button (TopBar popover styling: Panel surface, subtle border, backdrop blur, no gradient). Lists the `available` registry widgets (not currently placed) by title; clicking one calls `onAdd(id)`. Empty state "All widgets added". Positioning + outside-click dismissal are owned by `WidgetHeaderControls` in the Dashboard header.
- `contexts/DashboardEditContext.tsx` — `DashboardEditProvider` + `useDashboardEdit()`. Holds edit-mode UI state (`editMode` + `toggleEditMode`, `addMenuOpen` + `openAddMenu`/`closeAddMenu` where `openAddMenu` enables edit mode first) and the `gridActions` slot that `WidgetGrid` publishes its `{ availableWidgets, addWidget, resetLayout }` into for the header to invoke. Edit mode is never persisted — always OFF on load.

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

New page or route -> §4/§7. New widget (add a registry entry with a low `h` floor + a `title`; measurement sizes it, edit mode can add/move/remove it) or derived metric -> §5/§7. Change to the grid model (columns, gap, packer, fit helpers, non-displacing edit helpers, measure/place passes, edit mode, layout cookie, cell sizing) -> §5/§7. New design token -> §6. New lens-api method or changed response -> §8 (+ `../lens-api/CLAUDE.md`). New Fastify call or auth change -> §4/§9 (+ `../CLAUDE.md`). New dependency or build/lint change -> §2/§3. Treat the doc as part of the diff.
