# CLAUDE.md

Reference for working in `lens-ref-web/`. Read this before changing anything here. Keep it current: if a change makes a claim below stale, fix the claim in the same change (same rule as the root `CLAUDE.md`).

## 1. What this is

The pre-launch marketing landing page for **Lens Arc** (the web product that lives in `lens-app/`). The page has exactly one job: capture an email address before launch. Free access opens on a launch date, and signups earn free Pro time that scales with referrals.

- **Wired to a real backend.** The signup flow (email -> magic-link verification -> post-verify referral readout) calls the **referral-service** (`referral-service/`, FastAPI on Railway) via `src/lib/api.ts`. It is no longer mocked. The base URL comes from `VITE_REFERRAL_API_URL` (defaults to `http://localhost:8000`; see `.env.example`).
- **Not deployed yet.** The referral share-link domain is `lens-arc.com/r/...` (`content.ts` `referralLinkBase`); magic links point at `{FRONTEND_BASE_URL}/verify?token=...` (configured on the service side).
- Standalone project on the frontend side: it shares no code, tooling, or build with `backend/`, `lens-api/`, `lens-app/`, or `referral-service/`. Its only runtime dependency is the referral-service HTTP API.

History, so the file names make sense: this started as five complete alternate layouts switched live with arrow keys. The product-preview layout (number 4) won; the other four and the switcher were deleted. `src/layouts/Layout4.tsx` keeps its historical name and is now the entire page. The post-verify readout (§5) went through the same "build several, compare, delete the losers" process separately, on a smaller scale.

## 2. Commands

Run from `lens-ref-web/`:

| Task | Command | Notes |
|---|---|---|
| Install deps | `npm install` | |
| Dev server | `npm run dev` | Vite, `http://localhost:5173` |
| Type check | `npx tsc --noEmit` | Single flat `tsconfig.json` (not the solution-style setup lens-app has), so a bare `tsc --noEmit` works here |
| Build | `npm run build` | `tsc --noEmit && vite build` to `dist/` |
| Preview build | `npm run preview` | |
| Test / lint | *(none)* | No test framework, no linter. Match existing style (2-space indent, double quotes). |

## 3. Stack

- **Vite 6 + React 19 + TypeScript (strict)**. React plugin plus `@tailwindcss/vite`.
- **Tailwind CSS v4**: no `tailwind.config.js`; theme tokens live in `src/index.css` under `@theme` (`--font-sans` Inter, `--font-display` Sora). Custom CSS in that file is `.dial-max` (a celebration glow, `prefers-reduced-motion`-guarded) and `.readout-drift` (a slow-drifting background glow, same guard); both are currently unused, they belonged to two of the four rejected readout layouts (see §5), left in case a future readout wants them.
- **lucide-react** for icons.
- **Fonts** (Sora for display/wordmark, Inter for body) load from Google Fonts via `<link>` in `index.html`.

## 4. File map

```
lens-ref-web/
├── index.html                     # Font links, favicon (/lens-arc-icon.png), #root
├── public/
│   └── lens-arc-icon.png          # Favicon, a copy of assets/lens-arc/icon-rounded.png
├── assets/
│   ├── lens-arc/                  # Brand artwork, mirror of lens-app/assets/lens-arc (see section 7)
│   ├── video/                     # Demo videos, copies of frontend/assets/video (hero demo + 3 discovery clips)
│   └── protonyx-company/          # Protonyx company wordmarks (white/black), present but not used yet
├── src/
│   ├── main.tsx                   # ReactDOM bootstrap
│   ├── App.tsx                    # Renders Layout4 (the dev-only DemoReferralControl was removed with the demo store)
│   ├── lib/
│   │   └── api.ts                 # Typed referral-service client (join, verify, status); base URL from VITE_REFERRAL_API_URL
│   ├── content.ts                 # SINGLE SOURCE OF TRUTH for all copy, dates, milestones, brand values
│   ├── index.css                  # Tailwind v4 @theme tokens + dial-max animation
│   ├── vite-env.d.ts              # vite/client types (import.meta.env, .png imports)
│   ├── hooks/
│   │   └── useAccountFlow.ts      # Signup state machine + referral derivations + clipboard/share helpers
│   ├── readouts/                  # The post-verify hero readout (see §5). Was a 5-way comparison; 4 were rejected
│   │   │                          # wholesale ("none of them are close") and deleted, not tuned - do not resurrect
│   │   │                          # them as a starting point, RingReadout/TicketReadout/TrackReadout/GlassReadout are gone.
│   │   ├── shared.tsx             # useEntrance, RewardText, CopyChip, NextMilestoneLine, gradient - reusable readout bits
│   │   └── SignalReadout.tsx      # The one kept, still mid-rework (see §5), not a finished design
│   └── layouts/
│       └── Layout4.tsx            # The entire page (historical name, winner of the 5-layout exploration)
├── package.json / tsconfig.json / vite.config.ts
└── CLAUDE.md                      # This file
```

## 5. Architecture

### content.ts is the only place copy lives

Every user-facing string, date, and number renders from `src/content.ts`. Components never hardcode text. Exports:

- `LAUNCH_DATE` ("2026-08-05", placeholder) and `LAUNCH_DATE_DISPLAY` (derived human-readable form, e.g. "August 5, 2026"), shown as the heading of the footer countdown section (see below).
- `HERO` (headline "Actionable Insight for Everyone." plus subhead) and `HERO_ACCENTS` (the words rendered in the brand gradient; matches the `frontend/` hero treatment). The headline casing deliberately matches `frontend/`, an exception to the sentence-case rule below. The headline is rendered as a **locked 3-line layout** ("Actionable" / "Insight" / "for Everyone.") regardless of viewport width, see `Headline()` in `Layout4.tsx`, not left to wrap naturally.
- `HOW_IT_WORKS`, `REFERRAL_MILESTONES` (0/1/3/5/10 referrals), `BRAND` (gradient hexes + wordmark text).
- `COPY`: all microcopy, including template functions (`magicInstruction`, `nextStep`, `rewardShort`, `referralUnit`, `dialCaption`). `eyebrow` and `countdownUnits` were leftovers from the deleted layouts, kept "in case it comes back"; it did, they now back the footer countdown section (see below). `countdownCaption` ("until free access opens") is still a leftover, it briefly backed that section too but was cut for being redundant with the heading. `previewHeading`, `previewSub`, `dialCaption` are still unused, harmless, reuse or delete as needed. The post-verify reward card (dial + referral link) was removed from the page for now, so `unlockedWord`, `referralRowLabel`, `copyLabel`, `copiedLabel`, and `shareLabel` are currently unused too, kept in case it comes back.
### The page (src/layouts/Layout4.tsx)

Light theme. Top to bottom: header (wordmark image left, bare `dd:hh:mm:ss` countdown text right, driven by `LAUNCH_DATE`), hero (gradient-accented headline, subhead, then an email capture form that, once verified, is replaced in the exact same slot by a `VerifiedBox`, disclaimer) beside a hero visual that is **either** the Vector demo video (logged out) **or** the post-verify readout (logged in), see below, a "how it works" walkthrough of three stacked rows (each a 16/9 `DemoWindow` discovery video on the left, gradient step number + title + detail on the right, copy from `HOW_IT_WORKS`), a five-node referral milestone stepper (horizontal on `md+`, stacked cards on mobile, static, not tied to the live referral count), **a second, centered section repeating the countdown (this time with labeled day/hour/minute/second tiles and the launch date) plus a second email box**, and the footer. The `VerifyDialog` (magic-link verification) renders at the page root whenever the flow step is `"verifying"`.

`VerifiedBox` is the only thing rendered in the hero's signup slot once `flow.step === "account"`: a single bordered box, same `px-4 py-3` height as the email input it replaces, reading "Verified as `{email}`" with a check icon on the left (`COPY.verifiedAs`) and a small "Log out" link on the right (`flow.logout`). The same component is reused verbatim in the footer countdown section once verified, so that second email box doesn't sit there asking for an email that's already been submitted.

### The footer countdown section (src/layouts/Layout4.tsx)

Sits between the referral milestone stepper and the `<footer>`, its own `<section>`: `COPY.eyebrow` ("Free access opens") as a small uppercase label, `LAUNCH_DATE_DISPLAY` as the heading, 4 tiles (`bg-[#f6f7f9]` chips, one per entry in `parts` from `useCountdown()` zipped with `COPY.countdownUnits`) showing the zero-padded day/hour/minute/second counts with their unit labels underneath, then either `EmailCapture` or `VerifiedBox` depending on `flow.step`, same condition as the hero.

**This `EmailCapture` is the same component as the hero's, not a copy**, called with two extra props the hero instance doesn't pass: `className="mx-auto"` (the default is `"max-w-lg"`, left-aligned for the hero's column; this one needs centering under the countdown) and `onSubmitted={() => window.scrollTo({ top: 0, behavior: "smooth" })}`. Both instances share the same `flow.email`/`flow.setEmail` state, so typing in one and switching to the other preserves whatever was typed. `EmailCapture`'s `submit()` handler now calls `flow.submitEmail()` (which returns `true`/`false` depending on whether the email passed validation and the verifying step actually opened) and only fires `onSubmitted` on `true`, so a validation error at the bottom never triggers a pointless scroll-to-top; a real submit does, landing the user back at the hero right as the `VerifyDialog` opens (a `fixed inset-0` overlay, so it's already visible mid-scroll regardless), meaning once they complete verification they're looking at the hero's `VerifiedBox`/readout, not stranded at the bottom of the page.

`DemoWindow` is adapted from the `frontend/` `.demo-window` but deliberately drops its macOS-style chrome bar: just a rounded dark frame with a border and shadow around the clip. All videos are `autoPlay muted loop playsInline preload="metadata"`. The walkthrough is deliberately compact (capped at `max-w-5xl`, moderate step-number sizes) so it does not upstage the referral section. The earlier mocked diagnostic-report window (caution gauge + severity flags + action panel) was replaced by the hero video; recover it from git history if it is ever wanted back.

### The post-verify readout (src/readouts/)

Once `flow.step === "account"`, the hero's demo-video slot is replaced by `SignalReadout` (imported directly in `Layout4.tsx`, no switcher). **Status: not settled.** This started as 5 candidate layouts (`Signal`/`Ring`/`Ticket`/`Track`/`Glass`) compared side by side through a temporary `ReadoutSwitcher` arrow control, same pattern as the earlier OTP-vs-magic-link comparison. The verdict was "none of them are close", but `Signal` was kept as the least-wrong starting point while the other four and the switcher were deleted outright (not tuned, not merged, just gone; don't go looking for `RingReadout` etc., they no longer exist and are not a reference to build from). Expect another pass at `SignalReadout` itself, it is not a finished design.

`Layout4.tsx` wraps `SignalReadout` in a plain `<div className="aspect-[16/10] scale-125">`, no background, no border, no shadow at all, it has never reproduced the video's crisp boxed frame and now has no box whatsoever. The `aspect-[16/10]` reserves the same layout footprint as the video (so nothing else on the page reflows when it swaps in) while `scale-125` (the native CSS `scale` property, not `transform: scale()`, so don't go looking for it on `getComputedStyle(...).transform`) renders it about 25% bigger than that reserved box, bleeding into the surrounding whitespace rather than being clipped to it. The ambient blur-glow div behind it (the ``.absolute -inset-6 rounded-[2rem] opacity-15 blur-2xl`` sibling in `Layout4.tsx`, shared with the logged-out video) is now the only backdrop the readout sits on, since there's no opaque panel to mask it, it reads as a soft color wash behind the text rather than a halo around a box.

**Because there is no dark backdrop anymore, `SignalReadout`'s own colors are light-surface colors**, not the dark-surface ones the first draft used: the progress track is `bg-slate-900/10` (was `bg-white/10`, invisible on light), the link pill is `border-slate-200 bg-white shadow-sm` (was `border-white/10 bg-white/5`), and its text is `text-slate-600` (was `text-slate-300`) with the next-milestone caption at `text-slate-400`. If a future readout iteration brings back a dark panel, these will need to flip back; if it stays boxless, keep new elements on this light-surface palette to match.

**The months number is the dominant element of the whole readout** (`text-8xl`, `font-display font-bold`, solid `text-slate-900`, deliberately not the brand gradient, the ask was specifically "black"). It's rendered by two local components in `SignalReadout.tsx`: `OdometerDigit` (a column of 0-9 stacked vertically inside an `overflow-hidden` box, `translateY(-{digit}em)` on a `transition-transform`) and `OdometerNumber` (two `OdometerDigit`s, always zero-padded to 2 digits, `"00"`/`"01"`/etc). Changing the `digit` prop mid-transition rolls visibly through every digit in between purely from the CSS transition interpolating the transform, no per-frame JS, so going from 1 to 4 rolls through 2 and 3 on the way, the "dial" effect. `monthsFromReward()` (back in `shared.tsx`) parses the number out of `flow.currentReward`; `useEntrance()` gates the displayed value at `0` until first paint so it always rolls up from `"00"` on mount, then rolls again from wherever it last landed on every milestone change, it never resets to 0 after the initial reveal. The maxed "Lifetime" tier isn't numeric, so it swaps the whole odometer out for a static ∞ glyph (same size/weight/color) plus a sparkle + "lifetime free" caption instead of "`{months}` month(s) free".

Below the number: the "month(s) free" / "lifetime free" caption, then the single-line next-milestone nudge (`NextMilestoneLine`, wraps `nextStepLine(flow)`), then the slim animated progress line, then the link row with `CopyChip` (icon-only copy button, ping-burst + checkmark swap, no text label). Shared bits any future readout should reuse live in `shared.tsx`: `useEntrance()`, `monthsFromReward()`, `CopyChip`, `NextMilestoneLine`, and the `gradient` string. `RewardText` (the old gradient-text reward display) and the dial-specific `MAX_MONTHS`/`useCountUp` helpers built for the now-deleted `RingReadout` were both removed since nothing uses them anymore, the odometer replaced what `RewardText` did and needed a different animation approach than `useCountUp`'s per-frame JS tween.

### The signup flow (hooks/useAccountFlow.ts)

State machine `signup -> verifying -> account`, exposed as `useAccountFlow()` and typed as `AccountFlow`:

- `submitEmail()` is **async**: it regex-validates, then `POST`s `/join` (via `src/lib/api.ts`) with the email and any captured referral code, and opens the verifying step on success. It still **returns `true`/`false`** so the footer `EmailCapture`'s `onSubmitted` can react only on real success. `resendEmail()` re-`POST`s `/join` (the "Resend link" button). `dismissVerify()` goes back. `logout()` clears the persisted code/email from `localStorage` and resets state.
- **Verification is magic-link only** (`Layout4.tsx`'s `VerifyDialog`): the emailed link opens the SPA at `/verify?token=...`, which the hook reads **on mount** and passes to `api.verify()`; on success it stores the server-issued code + email and shows the account view. The dialog's "I clicked the link" button is now **DEV-only** (`import.meta.env.DEV`) and calls `devSimulateVerify()` — a local preview that does not hit the server (stripped from production builds). Do not reintroduce an OTP switcher.
- **Referral capture:** on mount the hook reads a `/r/<code>` share path (or `?ref=<code>`) and stashes the code to send on the next `/join`. Both URL forms are cleaned via `history.replaceState`.
- **Referral code is server-issued** (returned by `/verify` and `/status`), not a client hash. The old FNV-1a `codeFromEmail` is gone. `referralLink` is `COPY.referralLinkBase + code`.
- **Persistence:** the verified code + email are stored in `localStorage` (keys `lens_ref_code` / `lens_ref_email`); on load the hook restores the account view and refreshes the live count via `GET /status`. A stale/unknown code (e.g. a DB reset) clears itself and falls back to signup.
- Derivations from `REFERRAL_MILESTONES`: `currentReward`, `nextMilestone`, `progress` (`min(count / 10, 1)`), `maxed`. `referralCount` now comes from the server (`/verify`, `/status`), not a demo store. `nextStepLine(flow)` produces the single next-step sentence. Consumed by `SignalReadout` (see §5).
- `useCopyToClipboard()` uses the real clipboard API (with a textarea fallback) and flips a `copied` flag for ~1.8 s, used by `CopyChip` in `src/readouts/shared.tsx`. `useShare()` wraps `navigator.share` when present but isn't wired into the readout (the ask was copy only; add a share affordance only if requested).

### App.tsx

`App.tsx` now just renders `Layout4`. The old dev-only `DemoReferralControl` pill (which stepped a mock referral count) and the module-level demo store (`setDemoReferralCount` / `useDemoReferralCount`) were **removed** when the count went server-backed — preview every milestone by seeding referrals in the referral-service DB instead. For a quick visual check of the readout without a running backend, the `VerifyDialog`'s DEV-only "I clicked the link" button (`devSimulateVerify`) jumps to the account view.

## 6. Copy rules

- **No em dashes anywhere** (copy, comments, commit messages). Use a comma, colon, period, or hyphen.
- **Sentence case only**, never Title Case or ALL CAPS. One sanctioned exception: the hero headline "Actionable Insight for Everyone." matches the `frontend/` hero verbatim.
- **Tool-framed language** (diagnostic, analysis, flags, caution score). Never advice-framed language (recommend, guarantee, will outperform).

## 7. Brand and media assets (assets/)

`assets/lens-arc/` is a mirror of `lens-app/assets/lens-arc/` (which is the source of truth; recopy from there if artwork changes). Semantics:

| File | What it is | Used here |
|---|---|---|
| `lens-arc-dark.png` | Full wordmark, dark text, for light surfaces | Header and footer logo in `Layout4.tsx` (imported from outside `src/`, which Vite allows) |
| `lens-arc-white.png` | Full wordmark, white text, for dark surfaces | Not currently used (page is light) |
| `arc-dark.png` / `arc-white.png` | The arc mark alone | Not currently used |
| `icon-nobg.png` | Square icon mark, transparent background | Not currently used |
| `icon-rounded.png` | Rounded app-tile icon | Copied to `public/lens-arc-icon.png` as the favicon |
| `icon-square.png` | Square app-tile icon | Not currently used |

`assets/video/` holds copies of `frontend/assets/video/`:

| File | Used here |
|---|---|
| `1vector_demo.mp4` | Hero demo window (16/10) |
| `discovery_enter.mp4` | How-it-works step 1 (Add your positions) |
| `discovery_read.mp4` | How-it-works step 2 (Get your caution score) |
| `discovery_act.mp4` | How-it-works step 3 (See what to fix) |

The mapping lives in `STEP_VIDEOS` in `Layout4.tsx` and must stay aligned with the order of `HOW_IT_WORKS` in `content.ts`. `assets/protonyx-company/` holds the Protonyx company wordmarks (white and black); they are present but not used anywhere on the page yet.

## 8. Gotchas

- **Dev server port**: Vite defaults to 5173 and auto-increments if it is taken. The referral-service CORS allowlist covers `localhost:5173` and `5174`, so if Vite lands on a different port the API calls will fail CORS — either free up 5173/5174 or add the port to `allow_origins` in `referral-service/main.py`.
- **`tsc --noEmit` is part of `npm run build`**; a type error fails the build, and `noUnusedLocals` means dead imports break it too.
- The whole-page arrow-key switcher (the original 5-layout exploration) and the readout's own 5-way `ReadoutSwitcher` are both gone for good, do not reintroduce either. If another readout redesign needs comparing, a fresh temporary switcher is fine, but the four rejected layouts it deleted (`Ring`/`Ticket`/`Track`/`Glass`) are not a starting point, they were rejected wholesale.
- **SPA fallback is required for `/verify` and `/r/<code>`.** These are read by the app on load (not real routes/files). Vite's dev server does history-API fallback automatically, so they work in `npm run dev`. When the static build is deployed, the host must serve `index.html` for unmatched paths (e.g. `/verify`, `/r/*`) or those links 404. Both URLs are cleaned to `/` via `history.replaceState` once read.
- Verified state now **persists** across refreshes: the server-issued referral code + email are kept in `localStorage` (`lens_ref_code` / `lens_ref_email`) and the count is re-fetched via `GET /status` on load. Clearing those keys (or `flow.logout()`) returns to the signup step.
- `REFERRAL_MILESTONES` drives three things at once: the account-flow derivations, the milestone stepper section, and `SignalReadout`. Changing tiers updates all of them, and **must be mirrored in `referral-service/entitlement.py`'s `MILESTONES`** — the backend computes entitlement from the same table, so the two will disagree if only one is changed.
