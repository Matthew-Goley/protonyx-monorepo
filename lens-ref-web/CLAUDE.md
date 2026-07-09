# CLAUDE.md

Reference for working in `lens-ref-web/`. Read this before changing anything here. Keep it current: if a change makes a claim below stale, fix the claim in the same change (same rule as the root `CLAUDE.md`).

## 1. What this is

The pre-launch marketing landing page for **Lens Arc** (the web product that lives in `lens-app/`). The page has exactly one job: capture an email address before launch. Free access opens on a launch date, and signups earn free Pro time that scales with referrals.

- **Fully client-side. No backend, no API calls, no auth.** The whole signup flow (email, verification code, account view) is mocked in the browser. The only "real" functionality is copy-to-clipboard and, where available, `navigator.share`.
- **Not deployed yet.** The referral link domain (`lensarc.com/r/...`) is a placeholder string in `content.ts`.
- Standalone project: it shares no code, tooling, or build with `backend/`, `lens-api/`, or `lens-app/`.

History, so the file names make sense: this started as five complete alternate layouts switched live with arrow keys. The product-preview layout (number 4) won; the other four and the switcher were deleted. `src/layouts/Layout4.tsx` keeps its historical name and is now the entire page.

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
- **Tailwind CSS v4**: no `tailwind.config.js`; theme tokens live in `src/index.css` under `@theme` (`--font-sans` Inter, `--font-display` Sora). Custom CSS in that file is limited to the `.dial-max` celebration animation and its reduced-motion guard.
- **lucide-react** for icons.
- **Fonts** (Sora for display/wordmark, Inter for body) load from Google Fonts via `<link>` in `index.html`.

## 4. File map

```
lens-ref-web/
├── index.html                     # Font links, favicon (/lens-arc-icon.png), #root
├── public/
│   └── lens-arc-icon.png          # Favicon, a copy of assets/lens-arc/icon-rounded.png
├── assets/lens-arc/               # Brand artwork, mirror of lens-app/assets/lens-arc (see section 7)
├── src/
│   ├── main.tsx                   # ReactDOM bootstrap
│   ├── App.tsx                    # Renders Layout4 + the dev-only DemoReferralControl (bottom right)
│   ├── content.ts                 # SINGLE SOURCE OF TRUTH for all copy, dates, milestones, brand values
│   ├── index.css                  # Tailwind v4 @theme tokens + dial-max animation
│   ├── vite-env.d.ts              # vite/client types (import.meta.env, .png imports)
│   ├── hooks/
│   │   ├── useAccountFlow.ts      # Signup state machine + referral derivations + clipboard/share helpers
│   │   └── useOtpInput.ts         # Segmented code-input mechanics (focus, advance, backspace, paste)
│   └── layouts/
│       └── Layout4.tsx            # The entire page (historical name, winner of the 5-layout exploration)
├── package.json / tsconfig.json / vite.config.ts
└── CLAUDE.md                      # This file
```

## 5. Architecture

### content.ts is the only place copy lives

Every user-facing string, date, and number renders from `src/content.ts`. Components never hardcode text. Exports:

- `LAUNCH_DATE` ("2026-08-05", placeholder) and `LAUNCH_DATE_DISPLAY` (derived human-readable form; currently unused since the hero launch-date chip was removed, kept for reuse).
- `OTP_LENGTH` (4). Changing it resizes the code dialog, the validation, and the instruction copy everywhere at once.
- `HERO` (headline "Actionable Insight for Everyone." plus subhead) and `HERO_ACCENTS` (the words rendered in the brand gradient; matches the `frontend/` hero treatment). The headline casing deliberately matches `frontend/`, an exception to the sentence-case rule below.
- `HOW_IT_WORKS`, `REFERRAL_MILESTONES` (0/1/3/5/10 referrals), `BRAND` (gradient hexes + wordmark text).
- `COPY`: all microcopy, including template functions (`otpInstruction`, `nextStep`, `rewardShort`, `referralUnit`, `dialCaption`). Some entries are leftovers from the deleted layouts and currently unused (`eyebrow`, `countdownUnits`, `countdownCaption`, `previewHeading`, `previewSub`, `dialCaption`); harmless, reuse or delete as needed.
- `PREVIEW`: the mocked diagnostic-report content (caution score 62 / "elevated", three severity-tagged flags, top ranked action) rendered in the hero mock.

### The page (src/layouts/Layout4.tsx)

Light theme. Top to bottom: header (wordmark image left, bare `dd:hh:mm:ss` countdown text right, driven by `LAUNCH_DATE`), hero (gradient-accented headline, subhead, email capture or account view, disclaimer) beside a dark mocked report window (traffic-dot title bar, caution-score gauge, flag list, gradient-edged action panel), a three-card "how it works" band, a five-node referral milestone stepper (horizontal on `md+`, stacked cards on mobile), and the footer. The OTP dialog renders at the page root whenever the flow step is `"verifying"`.

The caution gauge follows the dataviz conventions: the score number wears text ink, amber is a status hue carried by a chip with icon + label (never color alone), and the track is recessive.

### The signup flow (hooks/useAccountFlow.ts)

State machine `signup -> verifying -> account`, exposed as `useAccountFlow()` and typed as `AccountFlow`:

- `submitEmail()` regex-validates and opens the OTP step. `dismissVerify()` goes back; `completeVerify()` lands on the account view.
- **Any complete numeric code of `OTP_LENGTH` digits verifies.** There is no backend; do not add fake server latency or a "wrong code" path without a real API to back it.
- Referral code: FNV-1a hash of the lowercased email, base36, 6 chars. Referral link is `COPY.referralLinkBase + code`.
- Derivations from `REFERRAL_MILESTONES`: `currentReward`, `nextMilestone` (`{ remaining, reward }` or `null` at the top tier), `progress` (`min(count / 10, 1)`), `maxed`. `nextStepLine(flow)` produces the single next-step sentence so wording stays identical anywhere it appears.
- `useCopyToClipboard()` uses the real clipboard API (with a textarea fallback) and flips a `copied` flag for ~1.8 s. `useShare()` wraps `navigator.share` when present.
- The referral count comes from a module-level external store (`setDemoReferralCount` / `useDemoReferralCount` via `useSyncExternalStore`). In production this is where a real per-user count would plug in.

### The OTP input (hooks/useOtpInput.ts)

Mechanics only, zero styling: auto-focus first box, auto-advance per digit, backspace steps back, arrow keys move focus, pasting a full code fills every box from the first. `validate()` sets the incomplete-error message and returns a boolean. The dialog styles its own boxes in `Layout4.tsx`.

### The dial

SVG circle with `pathLength={100}` and a `strokeDasharray` arc, rotated -90deg. Two things to preserve:

- At `progress === 0` the arc circle is **not rendered at all**: a zero-length dash with `strokeLinecap="round"` would still paint a dot.
- At 10+ referrals the `maxed` state is visually distinct: full gradient ring, `dial-max` pulsing glow (defined in `index.css`, disabled under `prefers-reduced-motion`), sparkles icon, gradient "Lifetime unlocked" label.

### The demo control (App.tsx)

`DemoReferralControl` is a small pill fixed bottom-right that steps the referral count through the milestone breakpoints so the dial and next-step sentence can be previewed. It is wrapped in `import.meta.env.DEV`, so it exists in `npm run dev` and is stripped from production builds. Keep it; the user explicitly wants it there while evaluating.

## 6. Copy rules

- **No em dashes anywhere** (copy, comments, commit messages). Use a comma, colon, period, or hyphen.
- **Sentence case only**, never Title Case or ALL CAPS. One sanctioned exception: the hero headline "Actionable Insight for Everyone." matches the `frontend/` hero verbatim.
- **Tool-framed language** (diagnostic, analysis, flags, caution score). Never advice-framed language (recommend, guarantee, will outperform). This includes the mocked report content in `PREVIEW`.

## 7. Brand assets (assets/lens-arc/)

Mirror of `lens-app/assets/lens-arc/` (which is the source of truth; recopy from there if artwork changes). Semantics:

| File | What it is | Used here |
|---|---|---|
| `lens-arc-dark.png` | Full wordmark, dark text, for light surfaces | Header and footer logo in `Layout4.tsx` (imported from outside `src/`, which Vite allows) |
| `lens-arc-white.png` | Full wordmark, white text, for dark surfaces | Not currently used (page is light) |
| `arc-dark.png` / `arc-white.png` | The arc mark alone | Not currently used |
| `icon-nobg.png` | Square icon mark, transparent background | Not currently used |
| `icon-rounded.png` | Rounded app-tile icon | Copied to `public/lens-arc-icon.png` as the favicon |
| `icon-square.png` | Square app-tile icon | Not currently used |

The mocked report title bar still renders `BRAND.wordmark` as text; that is intentional (it imitates a window title, not a logo placement).

## 8. Gotchas

- **Dev server port**: Vite defaults to 5173 and auto-increments if it is taken. Nothing here depends on the port (no CORS, no backend).
- **`tsc --noEmit` is part of `npm run build`**; a type error fails the build, and `noUnusedLocals` means dead imports break it too.
- The react `key` on layout components and the arrow-key switcher are gone; do not reintroduce a switcher, the exploration phase is over.
- Verified state resets on refresh by design; nothing persists (no localStorage, no cookies).
- `REFERRAL_MILESTONES` drives three things at once: the account-flow derivations, the milestone stepper section, and the demo control's buttons. Changing tiers updates all of them.
