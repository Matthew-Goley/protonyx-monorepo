// Every scene duration and every line of on-screen copy lives in this file, so
// the video can be retimed to a voiceover (or reworded) without touching scene
// code. Durations are in seconds; scenes play back to back in array order.
//
// Copy may contain {tokens}. They are filled from data/sample.json at render
// time (see TOKENS in data.ts), so no number in this file is a data value.
//
// Copy rules, enforced by `npm run check` (scripts/check-copy.mjs): no em or en
// dashes, no exclamation marks, no predictive language. Data scenes carry the
// "Sample portfolio" tag, and the end card carries the disclaimer.
//
// Plain object literals only: scripts/check-copy.mjs imports this file directly
// through Node's built-in TypeScript type stripping.

export const FPS = 30
export const WIDTH = 1920
export const HEIGHT = 1080

// Shown on every scene that displays engine data.
export const SAMPLE_TAG = 'Sample portfolio'

export const FULL_CUT = {
  // The cut is specified as 40s. check-copy warns if the scenes stop summing to it.
  targetSeconds: 40,
  // Frames spent fading each scene in and out (slow, eased).
  fadeInFrames: 18,
  fadeOutFrames: 15,
  scenes: [
    {
      id: 'intro',
      seconds: 4,
      copy: {
        headline: 'Read your portfolio clearly.',
        sub: 'Lens Arc runs a full check on what you hold.',
      },
    },
    {
      id: 'portfolio',
      seconds: 6,
      copy: {
        headline: 'Start with what you own.',
        sub: '{holdingCount} holdings, {totalEquity} in total.',
      },
    },
    {
      id: 'analyzers',
      seconds: 7,
      copy: {
        headline: '{analyzerCount} checks, every time.',
        sub: 'Each one rates its finding from none to critical.',
        labels: {
          slope: 'Trend',
          volatility: 'Volatility',
          concentration: 'Concentration',
          earnings: 'Earnings',
          dividends: 'Dividends',
          beta: 'Market sensitivity',
          performance: 'Gain and loss',
          index_fund: 'Index funds',
        },
        severities: {
          none: 'Clear',
          low: 'Low',
          moderate: 'Moderate',
          high: 'High',
          critical: 'Critical',
        },
      },
    },
    {
      id: 'caution',
      seconds: 6,
      copy: {
        headline: 'One caution score.',
        sub: 'How much of the portfolio the findings touch, from 1 to 99.',
      },
    },
    {
      id: 'brief',
      seconds: 7,
      copy: {
        headline: 'In plain words.',
        // The lines themselves are the engine's brief (brief.display in sample.json).
      },
    },
    {
      id: 'actions',
      seconds: 6,
      copy: {
        headline: 'Ranked by priority.',
        maxActions: 4,
        verbs: {
          sell: 'Sell',
          rebalance: 'Rebalance',
          buy_new: 'Buy',
          buy_more: 'Buy more',
          hold: 'Hold',
        },
      },
    },
    {
      id: 'end',
      seconds: 4,
      copy: {
        headline: 'Lens Arc',
        url: 'lens-arc.com',
        disclaimer:
          'Educational tool only. Not investment advice. Figures shown are Lens engine output for a sample portfolio, using market data as of {asOf}.',
      },
    },
  ],
} as const

export const HERO_LOOP = {
  seconds: 12,
  // Every motion in the loop completes a whole number of cycles per loop, so
  // the last frame flows straight back into the first.
  arcTurnsPerLoop: 1,
  barBreathsPerLoop: 2,
  gridDriftTilesPerLoop: 1,
} as const

export type FullCutScene = (typeof FULL_CUT.scenes)[number]
export type SceneId = FullCutScene['id']

export const sceneFrames = (s: { seconds: number }) => Math.round(s.seconds * FPS)
export const fullCutFrames = () => FULL_CUT.scenes.reduce((n, s) => n + sceneFrames(s), 0)
