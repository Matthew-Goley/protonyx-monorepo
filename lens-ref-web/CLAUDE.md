# CLAUDE.md

Reference for working in `lens-ref-web/`. Read this before changing anything here. Keep it current: if a change makes a claim below stale, fix the claim in the same change (same rule as the root `CLAUDE.md`).

## 1. What this is

The pre-launch marketing landing page for **Lens Arc** (the web product that lives in `lens-app/`). The page has exactly one job: capture an email address before launch. Free access opens on a launch date, and signups earn free Pro time that scales with referrals.

- **Fully client-side. No backend, no API calls, no auth.** The whole signup flow (email, magic-link verification) is mocked in the browser.
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
- **Tailwind CSS v4**: no `tailwind.config.js`; theme tokens live in `src/index.css` under `@theme` (`--font-sans` Inter, `--font-display` Sora). Custom CSS in that file is limited to the `.dial-max` celebration animation and its reduced-motion guard, currently unused since the reward dial that applied this class was removed from the page (see §5).
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
│   ├── App.tsx                    # Renders Layout4 + the dev-only DemoReferralControl (bottom right)
│   ├── content.ts                 # SINGLE SOURCE OF TRUTH for all copy, dates, milestones, brand values
│   ├── index.css                  # Tailwind v4 @theme tokens + dial-max animation
│   ├── vite-env.d.ts              # vite/client types (import.meta.env, .png imports)
│   ├── hooks/
│   │   └── useAccountFlow.ts      # Signup state machine + referral derivations + clipboard/share helpers
│   └── layouts/
│       └── Layout4.tsx            # The entire page (historical name, winner of the 5-layout exploration)
├── package.json / tsconfig.json / vite.config.ts
└── CLAUDE.md                      # This file
```

## 5. Architecture

### content.ts is the only place copy lives

Every user-facing string, date, and number renders from `src/content.ts`. Components never hardcode text. Exports:

- `LAUNCH_DATE` ("2026-08-05", placeholder) and `LAUNCH_DATE_DISPLAY` (derived human-readable form; currently unused since the hero launch-date chip was removed, kept for reuse).
- `HERO` (headline "Actionable Insight for Everyone." plus subhead) and `HERO_ACCENTS` (the words rendered in the brand gradient; matches the `frontend/` hero treatment). The headline casing deliberately matches `frontend/`, an exception to the sentence-case rule below.
- `HOW_IT_WORKS`, `REFERRAL_MILESTONES` (0/1/3/5/10 referrals), `BRAND` (gradient hexes + wordmark text).
- `COPY`: all microcopy, including template functions (`magicInstruction`, `nextStep`, `rewardShort`, `referralUnit`, `dialCaption`). Some entries are leftovers from the deleted layouts and currently unused (`eyebrow`, `countdownUnits`, `countdownCaption`, `previewHeading`, `previewSub`, `dialCaption`); harmless, reuse or delete as needed. The post-verify reward card (dial + referral link) was removed from the page for now, so `unlockedWord`, `referralRowLabel`, `copyLabel`, `copiedLabel`, and `shareLabel` are currently unused too, kept in case it comes back.
### The page (src/layouts/Layout4.tsx)

Light theme. Top to bottom: header (wordmark image left, bare `dd:hh:mm:ss` countdown text right, driven by `LAUNCH_DATE`), hero (gradient-accented headline, subhead, then an email capture form that, once verified, is replaced in the exact same slot by a `VerifiedBox`, disclaimer) beside the Vector demo video in a `DemoWindow` (16/10 body, gradient glow behind), a "how it works" walkthrough of three stacked rows (each a 16/9 `DemoWindow` discovery video on the left, gradient step number + title + detail on the right, copy from `HOW_IT_WORKS`), a five-node referral milestone stepper (horizontal on `md+`, stacked cards on mobile, static, not tied to the live referral count), and the footer. The `VerifyDialog` (magic-link verification) renders at the page root whenever the flow step is `"verifying"`.

`VerifiedBox` is the only thing rendered in the hero's signup slot once `flow.step === "account"`: a single bordered box, same `px-4 py-3` height as the email input it replaces, reading "Verified as `{email}`" with a check icon (`COPY.verifiedAs`). The reward dial + "refer a friend" card that used to render below it (`AccountView`, `Dial`, `ReferralRow`) was removed for now, do not reintroduce it without being asked, the reward/referral UI may come back in a different shape.

`DemoWindow` is adapted from the `frontend/` `.demo-window` but deliberately drops its macOS-style chrome bar: just a rounded dark frame with a border and shadow around the clip. All videos are `autoPlay muted loop playsInline preload="metadata"`. The walkthrough is deliberately compact (capped at `max-w-5xl`, moderate step-number sizes) so it does not upstage the referral section. The earlier mocked diagnostic-report window (caution gauge + severity flags + action panel) was replaced by the hero video; recover it from git history if it is ever wanted back.

### The signup flow (hooks/useAccountFlow.ts)

State machine `signup -> verifying -> account`, exposed as `useAccountFlow()` and typed as `AccountFlow`:

- `submitEmail()` regex-validates and opens the verifying step. `dismissVerify()` goes back; `completeVerify()` lands on the account view.
- **Verification is magic-link only** (`Layout4.tsx`'s `VerifyDialog`): the dialog shows "check your email" copy and an "I clicked the link" button that stands in for the real click (there's no backend to email a real link to, and no route to catch it). Clicking it calls `flow.completeVerify()` directly. There is no backend; do not add fake server latency or a "wrong link" path without a real API to back it. An OTP-code alternative was prototyped and compared side by side via a mode switcher, then removed once magic link was picked, do not reintroduce a switcher.
- Referral code: FNV-1a hash of the lowercased email, base36, 6 chars. Referral link is `COPY.referralLinkBase + code`.
- Derivations from `REFERRAL_MILESTONES`: `currentReward`, `nextMilestone` (`{ remaining, reward }` or `null` at the top tier), `progress` (`min(count / 10, 1)`), `maxed`. `nextStepLine(flow)` produces the single next-step sentence so wording stays identical anywhere it appears. **None of these are currently read by `Layout4.tsx`** since the reward card that displayed them (`Dial`, `ReferralRow`, the `nextStepLine` line) was removed for now; they're still computed and exported, ready to wire back up.
- `useCopyToClipboard()` uses the real clipboard API (with a textarea fallback) and flips a `copied` flag for ~1.8 s. `useShare()` wraps `navigator.share` when present. Also currently unused in `Layout4.tsx` for the same reason.
- The referral count comes from a module-level external store (`setDemoReferralCount` / `useDemoReferralCount` via `useSyncExternalStore`). In production this is where a real per-user count would plug in.

### The demo control (App.tsx)

`DemoReferralControl` is a small pill fixed bottom-right that steps the referral count through the milestone breakpoints. It is wrapped in `import.meta.env.DEV`, so it exists in `npm run dev` and is stripped from production builds. **Currently has no visible effect on the page**: it used to drive the dial and next-step sentence in the removed reward card, and the static milestone stepper section further down the page was never tied to the live count. Kept per explicit instruction to leave it in place while the account-view redesign is in progress; flag to the user if it's still inert once that settles.

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

- **Dev server port**: Vite defaults to 5173 and auto-increments if it is taken. Nothing here depends on the port (no CORS, no backend).
- **`tsc --noEmit` is part of `npm run build`**; a type error fails the build, and `noUnusedLocals` means dead imports break it too.
- The react `key` on layout components and the arrow-key switcher are gone; do not reintroduce a switcher, the exploration phase is over.
- Verified state resets on refresh by design; nothing persists (no localStorage, no cookies).
- `REFERRAL_MILESTONES` drives three things at once: the account-flow derivations, the milestone stepper section, and the demo control's buttons. Changing tiers updates all of them.
