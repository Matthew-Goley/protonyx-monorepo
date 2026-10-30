# CLAUDE.md - video

Remotion (TypeScript) project for the Lens Arc explainer video. Two 1920x1080, 30fps compositions:

| Composition | Length | Use |
|---|---|---|
| `FullCut` | 40s (sum of scene lengths in config) | Silent explainer, seven scenes |
| `HeroLoop` | 12s | Seamless, muted homepage hero background |

## Commands (from `video/`)

| Task | Command |
|---|---|
| Regenerate data | `npm run data` (offline, deterministic) or `npm run data:live` (live yfinance) |
| Preview | `npm run preview` (Remotion Studio) |
| Typecheck + copy rules | `npm run check` |
| Render everything | `npm run render` (runs `check` first, then the four renders below) |
| Single render | `render:full:mp4` (H.264 CRF 20, forced `yuv420p` + BT.709: Remotion's JPEG frames otherwise produce full-range `yuvj420p`, which Apple decoders handle poorly), `render:full:webm` (VP9 CRF 32), `render:loop:mp4` (H.264 CRF 26, muted), `render:loop:webm` (VP9 CRF 40, muted) |

Output goes to `out/`. **Rendered video is never committed here** (`out/`, `*.mp4`, `*.webm`, `*.mov` are gitignored).

**Where it ships:** the full cut is the video on lens-arc.com's `/lens-arc` page. To update it: `npm run render && npm run render:poster && npm run ship`. `render:poster` grabs frame 90 as a JPEG, and `ship` (`scripts/ship-to-site.mjs`) copies `lens-arc-full.{mp4,webm}` and the poster into `../lens-ref-web/assets/video/lens-engine{.mp4,.webm,-poster.jpg}`, which lens-ref-web does commit. The hero loop is not wired into any page yet.

`npm run data` needs lens-api's Python deps (`pip install -r ../lens-api/requirements.txt`).

## Data: `data/sample.json` is the only source

The video contains no hardcoded numbers. `scripts/generate_sample.py` runs the real engine (`lens-api/engine`, `generate_lens_full`) once on `data/portfolio.json` and writes `data/sample.json`: per-analyzer severities, caution score, brief, ranked actions, holdings and weights. `src/data.ts` types it and exposes `{tokens}` for config copy.

- **Offline mode (default) is byte-deterministic.** It reuses the lens-api parity harness approach (frozen `tests/parity/frozen_market_data.json`, DataStore forced fresh, yfinance blocked) and also pins the engine's `date.today()` (earnings + dividends analyzers) to `AS_OF`, the snapshot capture date. Without the pin, "upcoming" earnings and dividends drift out of the frozen snapshot as real time passes. The output for the default portfolio matches the parity baseline's `20 Moderate Winner Drift::regular` exactly.
- **`brief.raw` is the engine's brief verbatim. `brief.display` is what the video shows**: the brief split into clauses at its em dashes, keeping only clauses with no predictive wording. No words are rewritten. If every clause is filtered out, `npm run check` fails.
- Every ticker in `portfolio.json` must exist in the frozen market data, or offline generation exits with an error.

## Timing and copy: `src/config.ts`

Every scene length and every line of on-screen copy is in `src/config.ts`; scene components hold no copy. To retime to a voiceover, edit `seconds` per scene. Scenes play back to back, and intra-scene timing (for example the brief's line reveals) scales with scene length. `check` warns if the scenes stop summing to `targetSeconds`.

`HERO_LOOP` holds the loop length and cycle counts. **Every loop motion must complete a whole number of cycles per loop** or the loop will visibly jump.

## Copy rules (enforced by `scripts/check-copy.mjs`)

No em or en dashes, no exclamation marks, no predictive language (the word list is shared with `generate_sample.py`; keep the two in sync). Every data scene carries the `SAMPLE_TAG` ("Sample portfolio") label. The end card carries the educational-use disclaimer.

## Design

Near-black canvas (`#0a0b0e`), one accent (`#38bdf8`, the brand blue), everything else grey steps. Sora (brand font, via `@remotion/google-fonts`). Slow eased entrances (`rise`/`progress` in `src/components/motion.ts`, the app's `cubic-bezier(0.16, 1, 0.3, 1)` curve). One idea per scene. No stock imagery; the only image is the Lens Arc logo in `public/`.

## Layout

```
video/
├── data/portfolio.json        # fixed sample input
├── data/sample.json           # generated engine output (committed; the video's only data)
├── scripts/generate_sample.py # engine -> sample.json
├── scripts/check-copy.mjs     # copy-rule linter (imports src/config.ts via Node type stripping)
├── public/lens-arc-white.png  # copy of lens-app/assets/lens-arc/lens-arc-white.png
└── src/
    ├── config.ts              # scene lengths + all copy
    ├── data.ts / theme.ts
    ├── Root.tsx / FullCut.tsx / HeroLoop.tsx
    ├── components/            # Stage (scene shell + fades), Headline, SampleTag, motion
    └── scenes/                # Intro, Portfolio, Analyzers, Caution, Brief, Actions, EndCard (+ index.tsx registry)
```

To add a scene: add an entry to `FULL_CUT.scenes` in config, a component in `scenes/`, and its id in `scenes/index.tsx`.
