# CLAUDE.md

Reference for working in `lens-ref-web/`. Read this before changing anything here. Keep it current: if a change makes a claim below stale, fix the claim in the same change (same rule as the root `CLAUDE.md`).

## 1. What this is

The full **lens-arc.com marketing site** for Lens Arc (the web product that lives in `lens-app/`, deployed separately at `app.lens-arc.com`). It grew out of the pre-launch referral landing page; the referral/waitlist flow still exists intact, relocated under `/referral`. The product is messaged as **launched and paid**: real payments, no "get started free" CTAs anywhere, and the referral program is framed as earned Pro time being redeemed (see §5 and §6).

A **persistent NavBar** (`src/components/NavBar.tsx`, mounted app-wide in `App.tsx`) sits fixed on every page: wordmark, Engine link, Referral program link, the account slot (`AccountMenu`, backed by the **real Fastify account system**), and the "Enter Lens Arc" CTA to `APP_URL`. The design is **Hairline** (winner of a 3-variant comparison; Float/Ledger and the switcher are deleted) and the bar is **theme-adaptive**: dark glass over `data-nav-dark` sections, light glass with dark text over white content (see §5).

Routes (all matched by `src/App.tsx`, no router library):

| Path | Page | Notes |
|---|---|---|
| `/` | `src/landing/LandingPage.tsx` | Landing page in the established house style (see §5) |
| `/lens-arc` | `src/pages/EnginePage.tsx` | Plain-language technical dive into the Lens engine, trust-building for non-technical investors. Every claim grounded in `lens-api/CLAUDE.md` §11; do not invent capabilities |
| `/login` | `src/pages/LoginPage.tsx` | The site's account page, Sign in tab. **The one route with NO NavBar** (see §5 "The account") |
| `/signup` | `src/pages/LoginPage.tsx` | Same page, opens on the Create account tab. Also no NavBar |
| `/legal/terms` | `src/pages/TermsPage.tsx` | Referral-program Terms, verbatim from `legal-raw/lens-arc-referral-terms.md` |
| `/legal/privacy` | `src/pages/PrivacyPage.tsx` | Referral-site Privacy Policy, verbatim from `legal-raw/lens-arc-referral-privacy-policy.md` |
| `/referral` | `src/layouts/Layout4.tsx` | The original referral landing page (historical file name), copy updated to post-launch messaging |
| `/referral/ref/:code` | `src/layouts/Layout4.tsx` | Canonical referral share links (code captured by `useAccountFlow` on mount) |
| `/verify?token=...` | `src/layouts/Layout4.tsx` | Magic-link return path, consumed by `useAccountFlow` on mount |

**Legacy redirects (do not remove):** `/ref/:code` and `/r/:code` were shared publicly (DMs, LinkedIn) before the restructure. `App.tsx` rewrites them in place (`history.replaceState`, code preserved) to `/referral/ref/:code` before any page mounts. `/terms` and `/privacy` similarly rewrite to `/legal/terms` / `/legal/privacy`. Unknown paths fall through to the landing page.

- **Wired to two real backends.**
  - **Fastify** (`backend/`) via `src/lib/authApi.ts`, base URL `VITE_API_URL` (defaults to `http://localhost:3000`). This is the **account system**: `/login`, `/signup`, `/me`, `/logout` against the `users` table, the same accounts `lens-app` uses. Auth is the httpOnly `session` cookie.
  - **referral-service** (`referral-service/`, FastAPI on Railway) via `src/lib/api.ts`, base URL `VITE_REFERRAL_API_URL` (defaults to `http://localhost:8000`). This now serves **only the `/referral` page**: the `waitlist` table's verify/status calls, i.e. how much Pro time a pre-launch member earned. It is no longer a login.
- Standalone project on the frontend side: shares no code or build with `backend/`, `lens-api/`, `lens-app/`, or `referral-service/`. Its only runtime dependencies are those two HTTP APIs.

History, so the file names make sense: the site started as five alternate pre-launch layouts switched with arrow keys; the product-preview layout won and kept its `Layout4.tsx` name (now the `/referral` page). The `/` landing page went through the same process during the restructure: four complete designs (Classic, Noir, Brutalist, Swiss) behind an arrow-key crossfade switcher, compared live; **Classic won** and the other three plus the switcher were deleted outright (git history only, not a reference to build from).

## 2. Commands

Run from `lens-ref-web/`:

| Task | Command | Notes |
|---|---|---|
| Install deps | `npm install` | |
| Dev server | `npm run dev` | Vite, `http://localhost:5173` |
| Type check | `npx tsc --noEmit` | Single flat `tsconfig.json`, so a bare `tsc --noEmit` works here |
| Build | `npm run build` | `tsc --noEmit && vite build` to `dist/` |
| Preview build | `npm run preview` | |
| Test / lint | *(none)* | No test framework, no linter. Match existing style (2-space indent, double quotes). |

## 3. Stack

- **Vite 6 + React 19 + TypeScript (strict)**. React plugin plus `@tailwindcss/vite`.
- **Tailwind CSS v4**: no `tailwind.config.js`; theme tokens live in `src/index.css` under `@theme`: `--font-sans` AND `--font-display` are both **Sora** (the one site face; `font-display` classes are redundant but harmless), and `--font-serif` is **Times New Roman**, reserved for the actual legal document bodies (via `SimplePage`'s `serif` prop). `src/index.css` also holds the landing hero glow (`.hero-pulse`, `prefers-reduced-motion`-guarded), the `.savings-slider` chrome, and the legacy `.dial-max` / `.readout-drift` (unused, kept for a future readout).
- **lucide-react** for icons.
- **@vercel/analytics**: `<Analytics />` mounted once in `src/main.tsx`. Import path is `@vercel/analytics/react`. All navigation is real `<a href>` full page loads, so every route change is a fresh pageview.
- **Fonts** load from Google Fonts via `<link>` in `index.html`: **Sora only** (Times New Roman is a system font).

## 4. File map

```
lens-ref-web/
├── index.html                     # Font links, favicon, Open Graph/Twitter meta (og:image -> /og-image.png), #root
├── vercel.json                    # Catch-all rewrite to /index.html (SPA fallback for every route)
├── public/                        # lens-arc-icon.png (favicon), og-image.png (link preview, interim brand mark)
├── assets/
│   ├── lens-arc/                  # Brand artwork, mirror of lens-app/assets/lens-arc (see §7)
│   ├── video/                     # The four 2K 16:9 product recordings (see §7)
│   └── protonyx-company/          # Protonyx wordmarks, still unused
├── src/
│   ├── main.tsx                   # ReactDOM bootstrap + Vercel <Analytics /> mount
│   ├── App.tsx                    # Path router + legacy redirects (see §1 route table), wrapped in
│   │                              # AuthProvider > AccountProvider with the persistent NavBar above the routed page
│   ├── content.ts                 # Copy/config source of truth: APP_URL, appSignupUrl(email), appOpenUrl(email),
│   │                              # authUrl(mode, next), ROUTES, NAV, REFERRAL_REF_BASE,
│   │                              # LEGACY_LEGAL_PATHS, HERO, REFERRAL_MILESTONES, BRAND,
│   │                              # LEGAL_PAGES (/legal/* paths), COPY (paid-product microcopy + account strings),
│   │                              # AUTH (login/signup page + account menu strings)
│   ├── index.css                  # Tailwind v4 @theme tokens + landing animations + the Mercury button
│   │                              # mechanics ported from lens-app + the .fluid-btn hero-CTA sim (see §5 Buttons)
│   ├── lib/
│   │   ├── api.ts                 # Typed referral-service client (join, verify, status). /referral page ONLY now
│   │   └── authApi.ts             # Typed Fastify client (login, signup, me, logout) over the `users` table;
│   │                              # httpOnly session cookie, credentials: "include" (see §5 The account)
│   ├── hooks/
│   │   ├── authContext.tsx        # AuthProvider + useAuth(): the site's REAL session (see §5 The account)
│   │   ├── useAccountFlow.ts      # Referral state machine. Routing-facing bits: captures /referral/ref/<code>
│   │   │                          # (plus legacy /ref/<code>, /r/<code>, ?ref=), cleans URLs to /referral
│   │   └── accountContext.tsx     # AccountProvider + useAccount(): the ONE shared flow instance (see §5)
│   ├── components/
│   │   ├── NavBar.tsx             # Persistent site nav (Hairline, comparison winner), theme-adaptive via
│   │   │                          # the data-nav-dark section markers (see §5)
│   │   ├── AccountMenu.tsx        # The nav's account slot: Sign in link (out) / account popover (in)
│   │   ├── buttons.tsx            # Btn/BtnLink (lens-app Mercury roles) + HeroButton (static gradient hero CTA)
│   │   └── SimplePage.tsx         # THE shared content-page template: title block, content slot, basic footer
│   │                              # (no header of its own; the app-wide NavBar covers it). Used by /lens-arc
│   │                              # and both /legal/* pages. Replaced pages/LegalPage.tsx.
│   ├── landing/
│   │   ├── LandingPage.tsx        # The / page: the established frontend/ house style (see §5)
│   │   ├── SavingsSection.tsx     # The savings calculator section (slider -> 1% AUM fee vs Lens Arc, see §5)
│   │   ├── landingContent.ts      # ALL landing copy (CLASSIC + SAVINGS incl. the calculator's math constants)
│   │   │                          # + the VIDEOS map. Components never hardcode text
│   │   └── shared.tsx             # Reveal (IntersectionObserver fade-up) + Clip (autoplay video)
│   ├── readouts/                  # Post-verify hero readout (SignalReadout + shared.tsx), unchanged, still mid-rework
│   ├── layouts/Layout4.tsx        # The /referral page (historical name). Post-launch copy; countdown replaced by LiveBadge
│   └── pages/
│       ├── LoginPage.tsx          # /login + /signup: the account page (tabs, ?next=, ?email=), see §5
│       ├── EnginePage.tsx         # /lens-arc content (SimplePage shell)
│       ├── legalContent.tsx       # Legal typography primitives (LegalSection/List/Table/Contact)
│       ├── TermsPage.tsx          # SimplePage + Terms body (verbatim from legal-raw/)
│       └── PrivacyPage.tsx        # SimplePage + Privacy body (verbatim from legal-raw/)
├── legal-raw/                     # Source-of-truth legal doc drafts (markdown), NOT wired into the build
└── CLAUDE.md                      # This file
```

## 5. Architecture

### content.ts and landingContent.ts are the only places copy lives

Components never hardcode text. `src/content.ts` holds shared copy/config (routes, nav, referral copy, legal page registry). `src/landing/landingContent.ts` holds the landing designs' copy (exports `CLASSIC`, `NOIR`, `BRUT`, `SWISS`, and `VIDEOS`) because it is large and landing-only. The pre-launch `LAUNCH_DATE` / countdown exports are gone; `COPY` now carries post-launch strings (`liveBadge`, `claimHeading`, `claimSub`, `openApp`, `alreadyHaveAccount`).

`COPY.referralLinkBase` is `"lens-arc.com" + REFERRAL_REF_BASE` (i.e. `lens-arc.com/referral/ref/`), so newly copied share links use the canonical route. Old `lens-arc.com/r/<code>` links keep working through the App.tsx redirect.

### The landing page (src/landing/)

`LandingPage.tsx` is the single `/` page, in the established Protonyx house style ported from `frontend/` (`index.html` + `landing.css`), set in Sora like the rest of the site: dark `#0c0f16` hero with the pulsing radial glow (`.hero-pulse`), teal/blue `#2dd4bf -> #38bdf8` gradient accents on the "Investing Answers You Can Trust." headline (two locked lines from `CLASSIC.headlineTop`/`headlineBottom`, gradient words from `CLASSIC.accentWords`; the same headline lives in `HERO`/`HERO_ACCENTS` in `content.ts` for the /referral hero, and the two must stay in step), macOS-framed demo windows (traffic-light chrome), dark three-step discovery walkthrough (the three discovery clips, headed "Three steps. One loop." with no eyebrow), **the savings calculator section**, a two-item light trust strip ("Nothing to connect." with an Unplug icon, "Your data is secure." with a ShieldCheck icon; the icons live in `TRUST_ICONS` in `LandingPage.tsx`, order-matched to `CLASSIC.trust`), light closing CTA ("Start now.", no eyebrow), footer. Credibility (the "real, tested" message) is carried by the real product recordings and the /lens-arc page; the old third trust item stating it outright was cut.

**The savings calculator** (`SavingsSection.tsx`, between discovery and the trust strip) is a headline element, not a footnote: a range slider of money invested (25k-1M, default 250k) drives a live comparison card - a typical financial advisor fee (1% AUM) computed from the amount, Lens Arc's flat $120/year beneath it, and the difference as the big gradient "You'd save $X / year" number. All copy and every math constant (`advisorRate: 0.01`, `lensAnnual: 120`, slider bounds) live in `SAVINGS` in `landingContent.ts`; the asterisk footnote states the 1% AUM assumption and that the comparison is illustrative. Keep `lensAnnual` in sync with real Lens Arc pricing if it changes. Slider chrome is `.savings-slider` in `index.css` (the filled/unfilled track split is an inline gradient set by the component).

The page carries the three required messages: the product is an investment tool that makes choosing stocks simple (hero + workflow), user data is secure (trust strip), and this is real, tested software (the four real product recordings + the /lens-arc page). Copy comes from `CLASSIC` in `landingContent.ts`; scroll sections fade in via `Reveal` (`shared.tsx`).

This page was picked from a four-design comparison (Classic / Noir / Brutalist / Swiss behind an arrow-key crossfade switcher); the losers and the switcher are deleted, see §1 History and the Gotchas. The page has no header of its own anymore; the app-wide NavBar floats over the dark hero (the hero + discovery sections carry `data-nav-dark` for its adaptive theme). Its hero and closing primary CTAs are `HeroButton`s. The hero's "See the engine" is deliberately a **bare text link** (quieter than the CTA by design, don't promote it back to a button), and the closing section has a **single** CTA (the old "Check your Pro time" secondary button was removed; the closing sub-copy still mentions earned Pro time).

### The nav (components/NavBar.tsx)

Mounted once in `App.tsx`, fixed on every page. The design is **Hairline**, winner of a 3-variant arrow-key comparison (Float and Ledger, the switcher, and the `lens_nav_variant` localStorage key were all deleted with the loss): a slim h-12 translucent bar, links with gradient underline sweeps, and the Mercury-primary CTA. **It always carries the same controls** (a requirement, not a style choice): wordmark -> `/`, Engine -> `/lens-arc`, Referral program -> `/referral`, the `AccountMenu` slot (takes a `light` prop for its trigger colors), and "Enter Lens Arc" -> `APP_URL`.

**The bar is theme-adaptive.** Over a dark section it is dark glass (`bg-[#0c0f16]/70`, white links, white wordmark); over light content it flips to light glass (`bg-white/80`, slate links, dark wordmark), with all colors crossfading 300 ms and the two wordmark images crossfading in place, so it never reads as a murky gray strip on white. Detection: dark sections opt in with a **`data-nav-dark` attribute** (today: the landing hero + discovery sections); on every scroll/resize the bar probes whether a marked section covers its midline (y=24) and picks the theme. **Any new dark-background section must set `data-nav-dark`** or the bar will render its light theme on top of it.

### The account (hooks/authContext.tsx + lib/authApi.ts + pages/LoginPage.tsx + components/AccountMenu.tsx)

**The site's login is the real one: the Fastify `users` table, the same accounts `lens-app` authenticates against.** An account created on this site signs straight into `app.lens-arc.com`, and (if the email matches a verified waitlist row) the backend grants the earned Pro time during that very signup, via `grantWaitlistProTime()`. There is no separate marketing-site identity.

- **`src/lib/authApi.ts`** is the typed client: `login(usernameOrEmail, password)` (the backend resolves either), `signup(username, email, password)`, `me()`, `logout()`. Every call sets `credentials: "include"` because auth rides the **httpOnly `session` cookie**; no token is ever read or stored in JS. Errors read the backend's `message` field, and every call goes through a `request()` wrapper that converts fetch's bare `TypeError: Failed to fetch` into a named, actionable message (see the API-base gotcha in §8).
- **`AuthProvider` / `useAuth()`** (`hooks/authContext.tsx`, mounted at the App root **above** `AccountProvider`) exposes `{ user, isAuthenticated, loading, login, signup, logout }`. It **mirrors lens-app's `AuthContext` deliberately**, including the rule that **authentication is gated on `GET /me` succeeding, not on `POST /login`**: a correct password does not prove a usable session, since every later call rides the cookie. Do not relax that to an unconditional `setUser`.
- **`pages/LoginPage.tsx`** is `/login` (Sign in tab) and `/signup` (Create account tab), one component, tab state local so the user can switch without a navigation. Sign in takes username-or-email + password; sign up takes username + email + password (min 8 chars, checked client-side only) plus the Terms notice that makes the backend's silent TOS stamping at signup meaningful. It reads `?email=` to prefill and `?next=` to decide where to land afterwards. **`?next=` is deliberately restricted to same-origin absolute paths** (`safeNext()` rejects anything not starting with `/`, plus protocol-relative `//host`), or the page becomes an open redirect.
- **The auth route is the one page with no NavBar.** `App.tsx` gates the bar on `isAuthRoute(path)`: it is a standalone single-purpose screen, and the nav's own account slot on top of a sign-in form is both redundant and a way to wander off mid-flow. The page's wordmark is therefore a link home (plus a "Back to lens-arc.com" line), since it is the only way out.
- **`AccountMenu`** is the nav's account slot: signed out it is a plain link to `/login` carrying the current path as `?next=`; signed in it opens a popover with the username, email, plan, "Open Lens Arc", "View referral status", and Log out.

**Neither the nav slot nor the login form waits on the session check, and that is deliberate.** Both used to render a placeholder until `GET /me` resolved, which left the nav with a blank gap and `/login` with an empty card for as long as the call took, and *indefinitely* when the API was slow or unreachable. Both now render their signed-out state immediately: `AccountMenu` shows "Sign in", `LoginPage` shows the form. Nothing is lost by that guess, because a returning signed-in visitor is painted from the cached account below on the very first render, and a first-load-with-live-cookie corrects itself the moment `/me` lands (on `/login`, by redirecting).

**The session is cached in `sessionStorage` under `lens_account`.** This site has no router: every nav click is a **full page load**, so without the cache the account slot would blank and re-resolve on every page, and each view would spend one request against the backend's **20 requests / 60s per IP** limit before anything rendered. Two rules keep that safe:

- It is a **display** cache, never an authorization one. The httpOnly cookie still authenticates every call, and `/me` revalidates on each load.
- **`authApi.me()` returns `null` only for a 401 and throws for anything else** (429, 5xx, offline). `AuthProvider` clears the cached account on `null` and **keeps** it on a throw. Collapsing a 429 into "signed out" would log a visitor out of the nav for browsing quickly.

### The referral flow is no longer a login (hooks/accountContext.tsx)

`AccountProvider` still calls `useAccountFlow()` **once** and shares it via `useAccount()`, and that is still load-bearing: the flow consumes the single-use `/verify?token=` magic link on mount, so exactly one instance may exist: **never call `useAccountFlow()` directly from a component**. What changed is its reach: **only `Layout4` (`/referral`) reads it now.** The nav, the landing page, and the engine page all moved to `useAuth()`.

**The magic-link sign-in was removed from the nav.** It authenticated against the referral-service `waitlist` table, which is a pre-launch mailing list, not an account store, and a real account needs a username/email/password (more than a popover can carry). `flow.submitEmail` / `resendEmail` / `emailError` / `dismissVerify` are now **dormant**, and `Layout4`'s `VerifyDialog` is unreachable in practice (nothing sets `step` to `"verifying"` any more); they are kept so restoring the flow is putting a caller back, not rebuilding it.

**Known consequence, accepted as temporary:** a waitlist member who clears browser storage can no longer restore the `/referral` verified view, because nothing sends magic links from the site. Their earned Pro time is unaffected: it is granted by email match at signup (`backend/src/waitlist.ts`), which never depended on this site. `COPY.programClosedMember` was rewritten to say exactly that instead of pointing at the removed popover.

### Buttons (components/buttons.tsx + the Mercury block in index.css)

The site replicates the **lens-app button experience**: the five Mercury role classes (`.btn-primary/.btn-secondary/.btn-ghost/.btn-accent/.btn-danger`) are ported from `lens-app/src/index.css` with the lens-app dark-theme color values inlined (flat fills, 160 ms color-only transitions, **no motion, no shadow**), and `Btn`/`BtnLink` wrap them with lens-app's geometry (h-10 / px-5 / 500 weight / 15 px radius / teal focus ring; sizes sm/lg). Keep the block in lockstep with lens-app's. **`HeroButton`** is the major-hero CTA (landing hero + closing): the house gradient at hero scale, static, with a Mercury-quiet hover (slight `brightness` darken, no motion, no lift, no glow). The earlier fluid/water-ripple canvas sim that lived here was **cut entirely** (git history only, do not resurrect).

### The referral program is closed (affects /referral)

The program no longer accepts new participants (`WAITLIST_OPEN=false` in
`referral-service`). The site splits on the **`flow.step === "account"`** test,
which is exactly the existing localStorage restore path: `useAccountFlow` sets
step to `"account"` on mount when `lens_ref_code` is present, so a stored code
means "returning member" and anything else means "visitor with nothing to
restore". Two consequences on `/referral`:

- **New visitor:** the hero's `EmailCapture` is replaced by `ProgramClosedNotice`
  (local to `Layout4`), and the milestone-schedule section is not rendered at all,
  so no refer-to-earn or code-sharing messaging is shown to anyone who cannot act
  on it. `EmailCapture` was deleted outright rather than disabled: the service
  rejects an unknown address with a 403, and an input that can only fail is worse
  than saying so. Restore it from git history if the program ever reopens.
- **Returning member:** `VerifiedBox`, `RedemptionNote` with its claim CTA, and
  the milestone section render exactly as before. **`SignalReadout` is the one
  exception**: its forward-looking affordances were stripped, because referring is
  impossible for everyone now, not just new visitors. Gone are the share-link row,
  the "refer 1 more friend, unlock N months" caption, and the progress bar (it
  tracked referrals toward the 12-month cap, so a partly filled bar implied
  headroom that no longer exists). What remains is the earned-months odometer and
  its "months free" label: a statement of what they already have. The earned
  amount and claim CTA were deliberately left untouched.

The notice points existing members at the nav's `AccountMenu` **Sign in** popover,
which is deliberately kept: it runs the same `flow.submitEmail()` -> `POST /join`
call, and that still succeeds for any address that already has a waitlist row.
That is the recovery path for a member who cleared their browser storage, so do
not remove it while any unredeemed row exists.

### The /referral page (src/layouts/Layout4.tsx)

Deliberately minimal now: **hero + milestone timeline + footer, nothing else.** The page's job is "see the Pro time you earned and watch it redeem", not "get early access". Top to bottom: hero (gradient headline; subhead points program members at verifying to see their earned time; email capture (`COPY.emailCta` "Continue with email") or, once verified, `VerifiedBox` **plus `RedemptionNote`**; an "Already verified? Open Lens Arc" line; disclaimer; beside the demo video or the post-verify `SignalReadout`), the five-node milestone stepper (headed "The referral program", presented as the earning schedule), and the footer (legal links from `LEGAL_PAGES`). The `VerifyDialog` renders at the page root whenever the flow step is `"verifying"`. The page's own header is gone (the app-wide NavBar covers it, the hero pads past the fixed bar), and so are the old how-it-works video rows and the closing "Lens Arc is live" claim section (cut in the launch trim; the hero's `EmailCapture` is now the only one, though the component still accepts the `className`/`onSubmitted` props the removed second instance used).

**`RedemptionNote`** (local to Layout4) renders under the `VerifiedBox`: the earned amount (`COPY.rewardSummary(flow.earnedMonths)`, which takes the month count itself, not a pre-formatted reward string) plus `COPY.redeemNote` (the time applies automatically when signing in to the app with the same email, matching the Terms §3 redemption language). It then carries **the claim CTA**, the exit from this page: `COPY.claimNote` (earned time is claimed by creating an app account with this same email; a different address will not carry it) above a full-width primary `BtnLink` labelled `COPY.claimCta`, linking to `appSignupUrl(flow.email)` from `content.ts` (`APP_URL + /login?mode=signup&email=<encodeURIComponent(email)>`). **The app's Login page reads both params** (opens on its Sign Up tab with the email prefilled, see `lens-app/CLAUDE.md` §7), so the param names are a contract between the two projects: renaming either one silently breaks the prefill. **The earned-Pro summary is now shown only here**: the nav's `AccountMenu` used to repeat it, but that menu was rebuilt on the real `users` session and no longer knows anything about the waitlist. The flow comes from `useAccount()` (the shared context), not a local hook call; the email submit button uses `.btn-primary` (Mercury).

### The referral state machine (hooks/useAccountFlow.ts)

Unchanged in its API logic (`/join`, `/verify`, `/status` via `src/lib/api.ts`; magic-link only; server-issued referral code; localStorage persistence under `lens_ref_code` / `lens_ref_email`; DEV-only `devSimulateVerify`). What the restructure touched, deliberately confined to routing:

- `referralCodeFromUrl()` matches `/referral/ref/<code>`, legacy `/ref/<code>` and `/r/<code>`, or `?ref=<code>`.
- URL cleanup after capturing a code or consuming a `/verify` token now `history.replaceState`s to `/referral` (was `/`), so the user stays on the referral page.

The `/verify` route must keep rendering the referral page in `App.tsx`; the hook only consumes the token if it mounts. **The hook is instantiated exactly once**, by `AccountProvider` in App.tsx; components read it via `useAccount()` (see "The account" above).

### The post-verify readout (src/readouts/)

`SignalReadout` still replaces the hero video once `flow.step === "account"`, still mid-rework, still light-surface colors, wrapped in the boxless `aspect-[16/9] scale-125` div in `Layout4.tsx`. It is now **just the earned-months odometer + its "months free" label** (plus the `maxed` sparkle at 12 months): the referral-link row, the next-milestone caption, and the progress bar were removed when the program closed, since none of them can be acted on any more. `CopyChip` and `NextMilestoneLine` are still exported from `readouts/shared.tsx`, and `referralLink` / `nextMilestone` / `progress` are still on the flow, all **dormant** and unrendered, so reopening the program means putting them back rather than rebuilding them. `useCopyToClipboard` / `useShare` in `useAccountFlow.ts` are dormant for the same reason.

### Simple content pages (SimplePage + pages/)

`src/components/SimplePage.tsx` is the one shared template for content-first pages: sticky basic navbar (wordmark -> `/`, engine link, Get free Pro, dark "Get started" button -> `APP_URL`), `<h1>` + optional subtitle/effectiveDate, open children slot, basic footer (copyright + legal links + referral link). No hero, no gradients, no motion. It replaced `pages/LegalPage.tsx` (deleted). A `wide` prop widens the shell from `max-w-3xl` to `max-w-5xl` (EnginePage uses it).

`TermsPage.tsx` / `PrivacyPage.tsx`: both pass `serif` to `SimplePage`, so the document area (title + body) renders in **Times New Roman** (matching the old `frontend/` legal styling; the nav/footer chrome stays Sora). Bodies are unchanged, still hand-transcribed **verbatim** from `legal-raw/lens-arc-referral-terms.md` / `legal-raw/lens-arc-referral-privacy-policy.md` (the `legal-raw/*.md` files remain the source of truth and are not read at build time; update the page component when they change). Note these documents cover the **referral program / waitlist site**, not the Lens Arc application itself; both docs say the app will have its own separate Terms/Privacy, which do not exist in this repo yet.

`EnginePage.tsx` (/lens-arc): reassuring plain-language walkthrough of the engine for non-technical investors. Content is grounded in `lens-api/CLAUDE.md` §11 (8 analyzers, severity scale, caution score 1-99 formula shape, 11-level CTA priorities, sector-aware buys, risk tiers, Monte Carlo, determinism, the 50-portfolio x 3-tier parity harness) plus documented backend security facts (no brokerage credentials, httpOnly cookies, bcrypt, holdings excluded from the persisted client cache). **Do not add capabilities, stats, or advice-framed language the engine docs do not support.**

## 6. Copy rules

- **No em dashes anywhere** (copy, comments, commit messages). Use a comma, colon, period, or hyphen.
- **Sentence case only**, never Title Case or ALL CAPS in source strings. Two sanctioned exceptions: the hero headline "Investing Answers You Can Trust." (Title Case, matching the `frontend/` hero style it replaced), and the Brutalist design which renders sentence-case strings uppercase via CSS.
- **Tool-framed language** (diagnostic, analysis, flags, caution score). Never advice-framed language (recommend, guarantee, will outperform).
- The product is **launched and paid**: never reintroduce "coming soon" / countdown-to-launch copy, and never write "free" CTAs ("Get started free", "Join free", etc.). The app CTA is "Enter Lens Arc". The only sanctioned "free" wording is about **already-earned referral Pro time** (which really is free time being redeemed) and the milestone schedule's reward labels.

## 7. Brand and media assets (assets/)

`assets/lens-arc/` is mostly a mirror of `lens-app/assets/lens-arc/` (source of truth; recopy if that artwork changes) plus the local `link-ad.png`:

| File | Used here |
|---|---|
| `lens-arc-dark.png` | Wordmark on light surfaces: SimplePage nav, /referral header/footer, Classic design footer |
| `lens-arc-white.png` | Wordmark on dark surfaces: Classic design nav, Noir design nav |
| `arc-dark.png` / `arc-white.png` / `icon-nobg.png` / `icon-square.png` | Not currently used |
| `icon-rounded.png` | Copied to `public/lens-arc-icon.png` (favicon) |
| `icon-square.png` | Also copied to `public/og-image.png` (link-preview image), see §8 |
| `link-ad.png` | The OLD referral link-preview ad ("Free Pro. Just Your Email."). **No longer served anywhere**; kept only as the design source if a real card gets made. Do not copy it back over `public/og-image.png` |

`assets/video/` holds the four product recordings, re-exported at 2K (2560x1440, 16:9), copies of `frontend/assets/video/`:

| File | Used |
|---|---|
| `1vector_demo.mp4` | /referral hero; / hero demo window |
| `discovery_enter.mp4` | / workflow step 1 |
| `discovery_read.mp4` | / workflow step 2 |
| `discovery_act.mp4` | / workflow step 3 |

The landing page imports them through the `VIDEOS` map in `src/landing/landingContent.ts`; `Layout4.tsx` imports only `1vector_demo.mp4` (its how-it-works video rows were removed in the launch trim, so the discovery clips now appear only on `/`).

## 8. Gotchas

- **Dev server port**: Vite defaults to 5173 and auto-increments if taken. **`lens-app` also dev-serves on 5173**, so whichever starts second lands on 5174. Both ports are allowlisted by **both** backends: `allow_origins` in `referral-service/main.py`, and the `cors` origin list in `backend/src/server.ts` (5174 was added there for exactly this reason). Any other port fails CORS on the auth calls.
- **The API base is environment-defaulted, and the production default is hardcoded on purpose.** `src/lib/authApi.ts` resolves `VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:3000" : "https://api.lens-arc.com")`. **Vite inlines `VITE_*` at BUILD time**, so a var that is merely absent on the deploy host silently ships the dev default in the production bundle. That is exactly what happened on the first deploy: the live site had `http://localhost:3000` baked in, tried to POST to the visitor's own machine over http from an https page, and every call died as `Failed to fetch`. Do not "clean this up" back to a single localhost fallback. Verify a build with `grep -o "api\.lens-arc\.com" dist/assets/*.js`.
- **Any production override must stay on `api.lens-arc.com`**, never the raw `*.up.railway.app` host. The `session` cookie is the only browser auth path, and only the `api.lens-arc.com` form is **same-site** with `lens-arc.com`, which keeps that cookie first-party. On the Railway host it is a third-party cookie that Safari and any third-party-cookie-blocking browser drops: `POST /login` still succeeds, then `/me` 401s and the visitor silently appears signed out. Same constraint as lens-app's; see the root `CLAUDE.md` §4 "API domain".
- **`Failed to fetch` is never a login-form bug.** `fetch` rejects with that one bare `TypeError` for connection refused, DNS failure, blocked mixed content, and a rejected CORS preflight alike. `authApi.request()` now rewrites it to name the host it could not reach. In dev the usual cause is simply that `backend/` is not running on port 3000.
- **Signup is beta-gated server-side.** `POST /signup` returns **403** when `BETA_ACTIVE=false` or the user count has reached `MAX_BETA_USERS` (`backend/src/betaConfig.ts`). That surfaces on the page as "The open beta is currently closed/full", which is a server state, not a bug in the form. The site does **not** poll `GET /beta/status` to pre-empt it.
- **`tsc --noEmit` is part of `npm run build`**; `noUnusedLocals` means dead imports break the build.
- **SPA fallback is required for every route**: `/lens-arc`, `/legal/*`, `/referral`, `/referral/ref/<code>`, `/verify`, and the legacy `/ref/<code>`, `/r/<code>`, `/terms`, `/privacy`. None are real files; `vercel.json`'s catch-all rewrite serves `index.html` for all of them on Vercel, and Vite's dev server does history-API fallback automatically.
- **The legacy redirects in `App.tsx` are load-bearing**: `/ref/<code>` and `/r/<code>` were distributed publicly pre-restructure. Removing them breaks real shared links. They rewrite via `history.replaceState` before any page mounts, which is what lets `useAccountFlow` capture the code from the canonical path.
- Every arrow-key switcher this project has ever had is now deleted: the pre-launch 5-layout exploration, the readouts' `ReadoutSwitcher`, and the restructure's 4-design landing switcher. The rejected layouts (`Ring`/`Ticket`/`Track`/`Glass` readouts; `Noir`/`Brutalist`/`Swiss` landing designs) are gone wholesale and are not a reference to build from. If another comparison is ever needed, build a fresh temporary switcher and delete it with the losers.
- **Exactly one `useAccountFlow()` instance may exist** (`AccountProvider`). A second instance would double-consume the single-use `/verify` magic-link token. Always read the flow through `useAccount()`.
- Verified state persists in `localStorage` (`lens_ref_code` / `lens_ref_email`); the count refreshes via `GET /status` on load; a stale code clears itself back to signup.
- **New dark-background sections must carry `data-nav-dark`**, or the adaptive NavBar renders its light theme over them (see §5 The nav). Every arrow-key comparison this project has run (landing designs, nav variants, readouts) is now resolved and deleted; the losers are git history, not references.
- **Earned Pro time is a LINEAR formula, not a step function.** `earnedMonths(referralCount) = min(REFERRAL_BASE_MONTHS + referrals, REFERRAL_MAX_MONTHS)` in `content.ts` is the site's single source of truth, and it mirrors `backend/src/waitlist.ts` (the code that actually grants at signup) and `referral-service/entitlement.py`. All three must change together. `REFERRAL_MILESTONES` is now **derived** from `earnedMonths()` at display points `[0, 1, 3, 5, 11]`, so the /referral stepper cannot drift from the formula. It was previously an independent step table (0/1/3/5/10 → 1/2/4/6/Lifetime) that rounded in-between counts **down**, which made the site show "2 months" for an account the backend granted 3; the lifetime tier was unbackable since the grant caps at 12 months. Do not reintroduce thresholds, and do not hand-write reward labels.
- **The published referral Terms still describe the OLD step schedule** (`legal-raw/lens-arc-referral-terms.md` → `src/pages/TermsPage.tsx`), including a "10+ → Lifetime" row. That legal text was deliberately left untouched when the code was reconciled and currently contradicts it. See the open item in the root `CLAUDE.md`.
- **Query-carrying app links must target `/login` directly**, never bare `APP_URL`: lens-app's catch-all `<Navigate to="/login" replace />` does not preserve search params, so `${APP_URL}?email=...` arrives stripped. `content.ts` exposes two builders. `appSignupUrl(email)` → `/login?mode=signup&email=...` for CTAs that explicitly mean "create your account" (the claim CTA); it degrades to a bare `?mode=signup` rather than emitting a dangling `email=`. `appOpenUrl(email)` → `/login?email=...` for generic Enter/Open Lens Arc buttons: it carries the email so the sign-up form is prefilled if the visitor switches tabs, but deliberately does **not** force the sign-up tab (a member who already has an app account wants to sign in), and falls back to bare `APP_URL` with no verified email. Every generic CTA reads `flow.appHref` (from `useAccountFlow`), which picks between them.
- **Open Graph meta in `index.html` hardcodes `https://lens-arc.com`** for `og:url`/`og:image`/`twitter:image`; update all three (and re-verify with a link-preview debugger) if the domain changes.
- **Link-preview copy must never advertise free Pro again.** The `og:title`/`twitter:title` used to read "Get 1 month of Lens Arc Pro free.", which became false when the referral program closed; they now lead with what the tool does. Keep `description`, `og:description` and `twitter:description` identical to each other and keep every claim tied to real engine output (concentration, volatility, beta, caution score, no brokerage connection), same rule as the rest of the site's copy.
- **`public/og-image.png` is an interim placeholder: a byte copy of `assets/lens-arc/icon-square.png`** (the flat 1025x1025 brand mark on dark navy). It replaced the old referral ad, which rendered "Free Pro. Just Your Email." as the largest text on the card and kept advertising the dead offer no matter what the meta tags said. Because the placeholder is **1:1**, `twitter:card` is `summary` (small square thumb), not `summary_large_image`, and `og:image:width`/`height` are declared. **When a real card is designed, export it at 1200x630, copy it over `public/og-image.png`, set `twitter:card` back to `summary_large_image`, and update the width/height.** `assets/lens-arc/link-ad.png` still holds the old ad as a design source only; never copy it back.
- The app the nav's "Get started" button opens is `APP_URL` in `content.ts` (`https://app.lens-arc.com`), one place to change if the app domain moves.
