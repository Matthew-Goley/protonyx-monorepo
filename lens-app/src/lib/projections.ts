import type { CTA, LensResult } from '@/api/lens'
import { portfolioSlopePct, portfolioVolPct, totalEquity } from '@/lib/lensData'

/*
  Forward-looking projection engine for the Analysis page.

  The /analyze response carries no time series (see lens-api/CLAUDE.md §13): it
  returns scalars: an annualized drift (regression slope), an annualized
  volatility, a caution score and a list of CTAs. Everything here is derived
  deterministically from those scalars plus the REAL historical equity curve
  (usePortfolioHistory -> /tickers/history), and must stay labelled as an
  estimate in the UI.

  Two things are modelled:

  1. Five projection METHODS, all producing the same {median, bands} shape so a
     single chart can render any of them:
       monte_carlo    - sampled GBM paths, percentile bands across paths
       gbm            - the analytic backbone MC samples around (smooth fan)
       bootstrap      - resampled real historical daily returns (fat tails)
       regression     - exponential least-squares fit on the equity curve
       moving_average - the 50-day MA slope extended forward
  2. The effect of APPLYING Lens CTAs, either all of them or a single one.
     Every CTA carries a dollar amount; its share of total equity is its weight.
     Summed weights reproduce the engine's own caution score (caution =
     total CTA dollars / total equity x 100), so "all applied" here matches the
     legacy buildMonteCarlo() improvement math in lensData.ts.
*/

export type ProjectionMethod =
  | 'monte_carlo'
  | 'gbm'
  | 'bootstrap'
  | 'regression'
  | 'moving_average'

export const PROJECTION_METHODS: ReadonlyArray<{ id: ProjectionMethod; label: string }> = [
  { id: 'monte_carlo', label: 'Monte Carlo' },
  { id: 'gbm', label: 'GBM' },
  { id: 'bootstrap', label: 'Bootstrap' },
  { id: 'regression', label: 'Regression' },
  { id: 'moving_average', label: 'Moving Avg' },
]

const TRADING_DAYS = 252
/** Forward horizon, in trading days (~6 months). */
export const HORIZON_DAYS = 126
/** Historical lead-in points kept on the chart. */
const HIST_POINTS = 60
/** Sampled paths for the two simulation methods. */
const N_PATHS = 240

// ---------------------------------------------------------------------------
// CTA weighting
// ---------------------------------------------------------------------------

/** A CTA's share of total equity. Hold CTAs move no money, so they weigh 0. */
export function ctaWeight(cta: CTA, equity: number): number {
  if (equity <= 0 || cta.action === 'hold') return 0
  return Math.max(0, cta.dollars) / equity
}

/**
 * How acting on a set of CTAs (combined weight `w`) reshapes the portfolio:
 * risk comes down proportionally, drift is nudged up modestly. The same shape
 * the legacy buildMonteCarlo() used, expressed per-selection instead of only
 * for the whole CTA list.
 */
export interface LensEffect {
  /** Multiplier applied to volatility. */
  volScale: number
  /** Percentage points added to the annualized drift. */
  driftAdd: number
}
export function lensEffect(weight: number): LensEffect {
  const w = Math.max(0, Math.min(1, weight))
  return { volScale: 1 - Math.min(0.5, w * 0.5), driftAdd: w * 4 }
}

/** Combined weight of the selected CTAs. `selection` is a list of CTA indices. */
export function selectionWeight(ctas: CTA[], selection: number[], equity: number): number {
  return selection.reduce((sum, i) => sum + (ctas[i] ? ctaWeight(ctas[i], equity) : 0), 0)
}

// ---------------------------------------------------------------------------
// Deterministic RNG + statistics helpers
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Box-Muller standard normal from a uniform generator. */
function gauss(rand: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rand()
  while (v === 0) v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

/** Hash a string to a 32-bit int, so a given selection always seeds the same paths. */
function hashSeed(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Linear-interpolated percentile of an unsorted sample. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

function sampleEvenly<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr.slice()
  const out: T[] = []
  for (let i = 0; i < n; i++) out.push(arr[Math.round((i / (n - 1)) * (arr.length - 1))])
  return out
}

/** Log returns of an equity curve, finite values only. */
function logReturns(curve: number[]): number[] {
  const out: number[] = []
  for (let i = 1; i < curve.length; i++) {
    if (curve[i - 1] > 0 && curve[i] > 0) {
      const r = Math.log(curve[i] / curve[i - 1])
      if (Number.isFinite(r)) out.push(r)
    }
  }
  return out
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length
}

function stdev(xs: number[]): number {
  if (xs.length < 2) return 0
  const m = mean(xs)
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1))
}

// ---------------------------------------------------------------------------
// Method implementations. Each returns a fan anchored at e0 (index 0 = today).
// ---------------------------------------------------------------------------

export interface Fan {
  /** median[k] = projected equity k trading days out; median[0] === e0. */
  median: number[]
  /** [p10, p90]-style outer band, or null when the method has no bands. */
  outer: Array<[number, number]> | null
  /** [p25, p75]-style inner band, or null. */
  inner: Array<[number, number]> | null
}

/** Percentile bands across simulated paths. `paths[i][k]` = path i at step k. */
function fanFromPaths(paths: number[][], horizon: number): Fan {
  const median: number[] = []
  const outer: Array<[number, number]> = []
  const inner: Array<[number, number]> = []
  for (let k = 0; k <= horizon; k++) {
    const col = paths.map((p) => p[k]).sort((a, b) => a - b)
    median.push(percentile(col, 0.5))
    outer.push([percentile(col, 0.1), percentile(col, 0.9)])
    inner.push([percentile(col, 0.25), percentile(col, 0.75)])
  }
  return { median, outer, inner }
}

/** Simulate N paths from a per-step return sampler. */
function simulate(e0: number, horizon: number, drawReturn: () => number): Fan {
  const paths: number[][] = []
  for (let i = 0; i < N_PATHS; i++) {
    const path = [e0]
    let v = e0
    for (let k = 1; k <= horizon; k++) {
      v *= Math.exp(drawReturn())
      path.push(v)
    }
    paths.push(path)
  }
  return fanFromPaths(paths, horizon)
}

/** Analytic GBM quantile fan: the deterministic backbone Monte Carlo samples around. */
function gbmFan(e0: number, driftPct: number, volPct: number, horizon: number): Fan {
  const mu = driftPct / 100
  const sigma = Math.max(volPct / 100, 0.0001)
  const median: number[] = []
  const outer: Array<[number, number]> = []
  const inner: Array<[number, number]> = []
  for (let k = 0; k <= horizon; k++) {
    const t = k / TRADING_DAYS
    const center = (mu - (sigma * sigma) / 2) * t
    const spread = sigma * Math.sqrt(t)
    const at = (z: number) => e0 * Math.exp(center + spread * z)
    median.push(at(0))
    outer.push([at(-2), at(2)]) // +/- 2 sigma
    inner.push([at(-1), at(1)]) // +/- 1 sigma
  }
  return { median, outer, inner }
}

/** Sampled GBM: normal daily returns, percentile bands taken across paths. */
function monteCarloFan(
  e0: number,
  driftPct: number,
  volPct: number,
  horizon: number,
  seed: number,
): Fan {
  const mu = driftPct / 100 / TRADING_DAYS
  const sigma = Math.max(volPct / 100, 0.0001) / Math.sqrt(TRADING_DAYS)
  const rand = mulberry32(seed)
  return simulate(e0, horizon, () => mu - (sigma * sigma) / 2 + sigma * gauss(rand))
}

/**
 * Bootstrap: resample the portfolio's REAL historical daily returns with
 * replacement, so fat tails and volatility clustering survive instead of being
 * flattened into a normal distribution. Falls back to Monte Carlo when there is
 * not enough history to resample.
 */
function bootstrapFan(
  e0: number,
  returns: number[],
  effect: LensEffect,
  horizon: number,
  seed: number,
  fallback: () => Fan,
): Fan {
  if (returns.length < 20) return fallback()
  const rand = mulberry32(seed)
  const m = mean(returns)
  // The Lens effect on a resampled path: shrink each return's deviation from the
  // mean (less risk) and add the drift boost per day.
  const dailyBoost = effect.driftAdd / 100 / TRADING_DAYS
  return simulate(e0, horizon, () => {
    const r = returns[Math.floor(rand() * returns.length)]
    return m + (r - m) * effect.volScale + dailyBoost
  })
}

interface LogTrend {
  slopePerDay: number
  residStd: number
  /** Sample size, mean x and Sxx, needed for the OLS prediction interval. */
  n: number
  xBar: number
  sxx: number
}

/** Least-squares fit of ln(equity) against time: the exponential trendline. */
function fitLogTrend(curve: number[]): LogTrend {
  const pts = curve.filter((v) => v > 0)
  if (pts.length < 3) return { slopePerDay: 0, residStd: 0, n: 0, xBar: 0, sxx: 0 }
  const n = pts.length
  const ys = pts.map((v) => Math.log(v))
  const xBar = (n - 1) / 2
  const yBar = mean(ys)
  let num = 0
  let den = 0
  for (let i = 0; i < n; i++) {
    num += (i - xBar) * (ys[i] - yBar)
    den += (i - xBar) * (i - xBar)
  }
  const slopePerDay = den === 0 ? 0 : num / den
  const resid = ys.map((y, i) => y - (yBar + slopePerDay * (i - xBar)))
  return { slopePerDay, residStd: stdev(resid), n, xBar, sxx: den }
}

/**
 * Trend extrapolation: extend the fitted exponential trend forward, anchored at
 * today's equity. Not predictive in any real sense, but very legible: "if the
 * trend continues...".
 *
 * The band is the standard OLS **prediction interval**,
 *   se(x) = residStd * sqrt(1 + 1/n + (x - xBar)^2 / Sxx),
 * which widens only gently as the fit is extrapolated. Do NOT scale the
 * residual std by sqrt(k) as if it were a random-walk innovation: a trend
 * residual is not an innovation, and over a 126-day horizon that mistake blows
 * the band out to roughly a 3x fan, far wider than GBM's own 2-sigma cone. It
 * then dominates the chart's shared y domain and flattens every other method.
 */
function regressionFan(
  e0: number,
  curve: number[],
  effect: LensEffect,
  horizon: number,
): Fan {
  const { slopePerDay, residStd, n, xBar, sxx } = fitLogTrend(curve)
  const slope = slopePerDay + effect.driftAdd / 100 / TRADING_DAYS
  const sigma = residStd * effect.volScale
  const median: number[] = []
  const outer: Array<[number, number]> = []
  const inner: Array<[number, number]> = []
  for (let k = 0; k <= horizon; k++) {
    // Extrapolating past the last observed x (n - 1).
    const x = n - 1 + k
    const leverage = n > 0 && sxx > 0 ? 1 / n + ((x - xBar) * (x - xBar)) / sxx : 0
    const spread = sigma * Math.sqrt(1 + leverage)
    const center = slope * k
    const at = (z: number) => e0 * Math.exp(center + spread * z)
    median.push(at(0))
    outer.push([at(-2), at(2)])
    inner.push([at(-1), at(1)])
  }
  return { median, outer, inner }
}

/** Simple moving average of a curve. */
function movingAverage(curve: number[], window: number): number[] {
  if (window <= 1 || curve.length < window) return curve.slice()
  const out: number[] = []
  let sum = 0
  for (let i = 0; i < curve.length; i++) {
    sum += curve[i]
    if (i >= window) sum -= curve[i - window]
    if (i >= window - 1) out.push(sum / window)
  }
  return out
}

/**
 * Extend the 50-day moving average forward at its recent slope, as a plain
 * visual anchor. No distribution, so no bands.
 */
function movingAverageFan(
  e0: number,
  curve: number[],
  effect: LensEffect,
  horizon: number,
): Fan {
  const window = Math.min(50, Math.max(2, Math.floor(curve.length / 2)))
  const ma = movingAverage(curve, window)
  const look = Math.min(20, ma.length - 1)
  let slope = 0
  if (look > 0) {
    const a = ma[ma.length - 1 - look]
    const b = ma[ma.length - 1]
    if (a > 0 && b > 0) slope = Math.log(b / a) / look
  }
  slope += effect.driftAdd / 100 / TRADING_DAYS
  const median: number[] = []
  for (let k = 0; k <= horizon; k++) median.push(e0 * Math.exp(slope * k))
  return { median, outer: null, inner: null }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** One row of the comparison chart: historical past, then both projected futures. */
export interface ProjectionRow {
  label: string
  /** Real equity curve. Null once the projection starts. */
  hist: number | null
  /** Projected equity holding the portfolio as-is. Null before today. */
  current: number | null
  /** Projected equity with the selected Lens projections applied. Null before today. */
  lens: number | null
  currentBand: [number, number] | null
  lensBand: [number, number] | null
  lensInnerBand: [number, number] | null
}

export interface ProjectionSeries {
  rows: ProjectionRow[]
  /** Row index of the "Today" divider. */
  todayIndex: number
  /** Equity today (the anchor both projections start from). */
  startEquity: number
  currentFinal: number
  lensFinal: number
  /** lensFinal - currentFinal at the horizon. */
  improvementDollars: number
  /** True when the method has no confidence band (moving average). */
  hasBands: boolean
}

export interface BuildProjectionArgs {
  result: LensResult
  /** Real portfolio equity curve, oldest first. May be empty. */
  historyEquity: number[]
  method: ProjectionMethod
  /** Indices into `result.ctas` to apply. */
  selection: number[]
  horizon?: number
}

/** Forward label every ~21 trading days (a month), blank in between. */
function forwardLabel(k: number): string {
  if (k === 0) return 'Today'
  if (k % 21 === 0) return `${k / 21}m`
  return ''
}

export function buildProjection({
  result,
  historyEquity,
  method,
  selection,
  horizon = HORIZON_DAYS,
}: BuildProjectionArgs): ProjectionSeries {
  const equity = totalEquity(result) || 1
  const drift = portfolioSlopePct(result)
  const vol = portfolioVolPct(result) || 20
  const ctas = result.ctas ?? []

  const weight = selectionWeight(ctas, selection, equity)
  const effect = lensEffect(weight)
  const noEffect: LensEffect = { volScale: 1, driftAdd: 0 }

  // Anchor both projections at the last real equity value so the lines connect
  // to the historical curve; fall back to the engine's total equity.
  const curve = historyEquity.filter((v) => Number.isFinite(v) && v > 0)
  const e0 = curve.length > 0 ? curve[curve.length - 1] : equity
  const returns = logReturns(curve)

  const seed = hashSeed(`${method}|${selection.join(',')}|${Math.round(e0)}`)

  const fanFor = (eff: LensEffect, seedOffset: number): Fan => {
    const d = drift + eff.driftAdd
    const v = vol * eff.volScale
    switch (method) {
      case 'gbm':
        return gbmFan(e0, d, v, horizon)
      case 'bootstrap':
        return bootstrapFan(e0, returns, eff, horizon, seed + seedOffset, () =>
          monteCarloFan(e0, d, v, horizon, seed + seedOffset),
        )
      case 'regression':
        return regressionFan(e0, curve.length >= 3 ? curve : [e0, e0, e0], eff, horizon)
      case 'moving_average':
        return movingAverageFan(e0, curve.length >= 3 ? curve : [e0, e0, e0], eff, horizon)
      case 'monte_carlo':
      default:
        return monteCarloFan(e0, d, v, horizon, seed + seedOffset)
    }
  }

  const currentFan = fanFor(noEffect, 0)
  // Same seed for both scenarios so the two lines share their random draws and
  // the difference between them is the Lens effect, not sampling noise.
  const lensFan = fanFor(effect, 0)

  const rows: ProjectionRow[] = []

  // Historical lead-in (real data, down-sampled). Dropped when there is none.
  const hist = sampleEvenly(curve, HIST_POINTS)
  for (const v of hist.slice(0, -1)) {
    rows.push({
      label: '',
      hist: v,
      current: null,
      lens: null,
      currentBand: null,
      lensBand: null,
      lensInnerBand: null,
    })
  }
  const todayIndex = rows.length

  for (let k = 0; k <= horizon; k++) {
    rows.push({
      label: forwardLabel(k),
      // Join the historical line to today so there is no visual break.
      hist: k === 0 ? e0 : null,
      current: currentFan.median[k],
      lens: lensFan.median[k],
      currentBand: currentFan.outer ? currentFan.outer[k] : null,
      lensBand: lensFan.outer ? lensFan.outer[k] : null,
      lensInnerBand: lensFan.inner ? lensFan.inner[k] : null,
    })
  }

  const currentFinal = currentFan.median[horizon]
  const lensFinal = lensFan.median[horizon]

  return {
    rows,
    todayIndex,
    startEquity: e0,
    currentFinal,
    lensFinal,
    improvementDollars: lensFinal - currentFinal,
    hasBands: lensFan.outer !== null,
  }
}

/**
 * A y domain spanning every drawn value across one or more series.
 *
 * The chart MUST be given a fixed domain rather than recharts' `'auto'`: each
 * method produces a different spread (a 2-sigma Monte Carlo fan is far wider
 * than a moving-average line), so an auto domain rescales on every method
 * switch and the portfolio-value line jumps vertically even though its value
 * has not changed. Feeding one domain built from all methods keeps the lines
 * pinned, which is the only way the methods can be compared against each other.
 *
 * Pass the series for every method (built from the widest selection). Any
 * narrower CTA selection is bounded by them: a subset's weight is <= the full
 * weight, so its Lens line sits between the current and fully-applied lines and
 * its bands are no wider than the current one's.
 */
export function projectionYDomain(series: ProjectionSeries[]): [number, number] {
  const ys: number[] = []
  for (const s of series) {
    for (const r of s.rows) {
      if (r.hist != null) ys.push(r.hist)
      if (r.current != null) ys.push(r.current)
      if (r.lens != null) ys.push(r.lens)
      if (r.currentBand) ys.push(r.currentBand[0], r.currentBand[1])
      if (r.lensBand) ys.push(r.lensBand[0], r.lensBand[1])
    }
  }
  if (ys.length === 0) return [0, 1]
  const lo = Math.min(...ys)
  const hi = Math.max(...ys)
  const pad = Math.max(1, (hi - lo) * 0.05)
  return [Math.floor(lo - pad), Math.ceil(hi + pad)]
}
