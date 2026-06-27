import type { LensResult, Position } from '@/api/lens'

/*
  Derivation helpers over the /analyze response.

  Everything the Lens API actually returns (brief, ctas, caution_score,
  action_type, recommended_tickers, net_cta_delta, full_report,
  projected_positions and the full per-analyzer pool_results) is read straight
  out of the response. A few dashboard surfaces in the design (Sharpe ratio, the
  Monte Carlo projection fan, the equity sparkline) are NOT in the response
  today (see lens-api/CLAUDE.md section 13), so they are derived deterministically
  from the real analyzer outputs and clearly labelled as estimates in the UI.
*/

// ---------------------------------------------------------------------------
// Safe pool_results accessors
// ---------------------------------------------------------------------------

type AnyRec = Record<string, unknown>

function rec(v: unknown): AnyRec {
  return v && typeof v === 'object' ? (v as AnyRec) : {}
}
function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}
function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback
}

function pool(result: LensResult): AnyRec {
  return rec(result.pool_results)
}
function analyzer(result: LensResult, name: string): AnyRec {
  return rec(pool(result)[name])
}
function portfolioResult(result: LensResult, name: string): AnyRec {
  return rec(analyzer(result, name).portfolio_result)
}
function tickerResults(result: LensResult, name: string): AnyRec {
  return rec(analyzer(result, name).ticker_results)
}
function summary(result: LensResult): AnyRec {
  return rec(pool(result)._positions_summary)
}

export function totalEquity(result: LensResult): number {
  return num(summary(result).total_equity)
}

// Portfolio Vector - equity-weighted regression slope (annualized %).
export function portfolioSlopePct(result: LensResult): number {
  return num(portfolioResult(result, 'slope').value)
}
export function slopeState(result: LensResult): string {
  return str(rec(portfolioResult(result, 'slope').details).state, 'mixed')
}

// Volatility - equity-weighted annualized %.
export function portfolioVolPct(result: LensResult): number {
  return num(portfolioResult(result, 'volatility').value)
}

// Beta - portfolio vs SPY.
export function portfolioBeta(result: LensResult): number {
  const details = rec(portfolioResult(result, 'beta').details)
  return num(details.beta, num(portfolioResult(result, 'beta').value, 1))
}

// Sector weights (percentages) for the diversification pie.
export interface SectorSlice {
  name: string
  value: number
}
export function sectorWeights(result: LensResult): SectorSlice[] {
  const details = rec(portfolioResult(result, 'concentration').details)
  const weights = rec(details.sector_weights)
  const slices = Object.entries(weights)
    .map(([name, v]) => ({ name, value: num(v) }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
  return slices
}
export function sectorCount(result: LensResult): number {
  return sectorWeights(result).length
}
export function concentrationSeverity(result: LensResult): string {
  return str(portfolioResult(result, 'concentration').severity, 'none')
}

// Per-ticker 6-month trend (annualized slope %).
export function tickerTrendPct(result: LensResult, ticker: string): number {
  return num(rec(tickerResults(result, 'slope')[ticker]).value)
}
// Per-ticker current price (from the performance analyzer).
export function tickerCurrentPrice(result: LensResult, ticker: string): number {
  const details = rec(rec(tickerResults(result, 'performance')[ticker]).details)
  return num(details.current_price)
}

// Dividend calendar rows.
export interface DividendRow {
  ticker: string
  daysUntil: number
  exDate: string | null
  amount: number | null
}
export function dividendRows(result: LensResult): DividendRow[] {
  const tr = tickerResults(result, 'dividends')
  const rows: DividendRow[] = []
  for (const [ticker, data] of Object.entries(tr)) {
    const details = rec(rec(data).details)
    const daysUntil = details.days_until
    if (typeof daysUntil === 'number') {
      rows.push({
        ticker,
        daysUntil,
        exDate: typeof details.next_ex_date === 'string' ? details.next_ex_date : null,
        amount: typeof details.amount === 'number' ? details.amount : null,
      })
    }
  }
  return rows.sort((a, b) => a.daysUntil - b.daysUntil)
}

// ---------------------------------------------------------------------------
// Sharpe ratio (derived). The pipeline does not return Sharpe, so approximate
// it as a return/risk ratio from the real portfolio slope and volatility:
//   (annualized return - risk free) / annualized volatility, rf = 4.5%.
// ---------------------------------------------------------------------------

export const RISK_FREE_PCT = 4.5

export function sharpeRatio(result: LensResult): number | null {
  const vol = portfolioVolPct(result)
  if (vol <= 0.0001) return null
  const ret = portfolioSlopePct(result)
  return (ret - RISK_FREE_PCT) / vol
}

export function sharpeClass(value: number): { label: string; color: string } {
  if (value > 2) return { label: 'Excellent', color: 'var(--color-accent-green)' }
  if (value >= 1) return { label: 'Good', color: 'var(--color-accent-green)' }
  if (value >= 0) return { label: 'Sub-optimal', color: 'var(--color-accent-yellow)' }
  return { label: 'Poor', color: 'var(--color-accent-red)' }
}

// ---------------------------------------------------------------------------
// Beta classification
// ---------------------------------------------------------------------------

export function betaClass(beta: number): { label: string; color: string } {
  if (beta > 1.3) return { label: 'Aggressive', color: 'var(--color-accent-red)' }
  if (beta > 1.05) return { label: 'Elevated', color: 'var(--color-accent-orange)' }
  if (beta >= 0.9) return { label: 'Market', color: 'var(--color-accent-blue)' }
  return { label: 'Defensive', color: 'var(--color-accent-green)' }
}

// ---------------------------------------------------------------------------
// Caution score classification
// ---------------------------------------------------------------------------

// Three tiers per styling.md §Caution Score: 1-33 gain, 34-66 caution, 67-99 loss.
// This colors the supplementary tier label/badge only; the gauge arc itself is
// always the brand gradient.
export function cautionClass(score: number): { label: string; color: string } {
  if (score <= 33) return { label: 'Manageable', color: 'var(--color-gain)' }
  if (score <= 66) return { label: 'Elevated', color: 'var(--color-caution)' }
  return { label: 'Critical', color: 'var(--color-loss)' }
}

// ---------------------------------------------------------------------------
// CTA action presentation
// ---------------------------------------------------------------------------

export function ctaActionLabel(action: string): string {
  switch (action) {
    case 'sell':
      return 'SELL'
    case 'rebalance':
      return 'REBALANCE'
    case 'buy_new':
    case 'buy_more':
      return 'BUY'
    case 'hold':
      return 'HOLD'
    default:
      return action.replace(/_/g, ' ').toUpperCase()
  }
}

export function ctaAccent(action: string): string {
  switch (action) {
    case 'sell':
      return 'var(--color-accent-red)'
    case 'rebalance':
      return 'var(--color-accent-yellow)'
    case 'buy_new':
    case 'buy_more':
      return 'var(--color-accent-teal)'
    case 'hold':
    default:
      return 'var(--color-accent-blue)'
  }
}

// ---------------------------------------------------------------------------
// Brief tokenizer - colors tickers, dollar amounts, percentages and action verbs
// ---------------------------------------------------------------------------

export type BriefKind = 'plain' | 'ticker' | 'money' | 'percent' | 'action'
export interface BriefSegment {
  text: string
  kind: BriefKind
}

const ACTION_WORDS = [
  'rebalance',
  'rebalancing',
  'sell',
  'sells',
  'selling',
  'sold',
  'buy',
  'buys',
  'buying',
  'trim',
  'trims',
  'trimming',
  'reduce',
  'reducing',
  'hold',
  'holding',
  'diversify',
  'diversifying',
]

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function tokenizeBrief(text: string, tickers: string[]): BriefSegment[] {
  const uniqueTickers = Array.from(new Set(tickers.filter(Boolean).map((t) => t.toUpperCase())))
  const tickerAlt = uniqueTickers.length
    ? `|(?<ticker>\\b(?:${uniqueTickers.map(escapeRe).join('|')})\\b)`
    : ''
  const re = new RegExp(
    `(?<money>\\$\\d[\\d,]*(?:\\.\\d+)?)` +
      `|(?<percent>[+-]?\\d[\\d,]*(?:\\.\\d+)?%)` +
      `|(?<action>\\b(?:${ACTION_WORDS.join('|')})\\b)` +
      tickerAlt,
    'gi',
  )

  const segments: BriefSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), kind: 'plain' })
    }
    const groups = match.groups ?? {}
    let kind: BriefKind = 'plain'
    if (groups.money) kind = 'money'
    else if (groups.percent) kind = 'percent'
    else if (groups.action) kind = 'action'
    else if (groups.ticker) kind = 'ticker'
    segments.push({ text: match[0], kind })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), kind: 'plain' })
  }
  return segments
}

// ---------------------------------------------------------------------------
// Monte Carlo projection (derived). The /analyze response has no Monte Carlo
// payload, so this builds a deterministic analytic GBM quantile fan from the
// real portfolio drift (slope) and volatility. It is a visual estimate, not an
// engine output. Quantile z-scores: p10/p90 = +/-1.2816, p25/p75 = +/-0.6745.
// ---------------------------------------------------------------------------

export interface ProjectionPoint {
  label: string
  /** historical line value (% return), null inside the projection region */
  hist: number | null
  /** median projection (% return), null in the historical region except today */
  median: number | null
  /** [p10, p90] band */
  outer: [number, number] | null
  /** [p25, p75] band */
  inner: [number, number] | null
}

const Z = { p10: -1.2816, p25: -0.6745, p75: 0.6745, p90: 1.2816 }
const MONTH_LABELS = ['Today', '1m', '2m', '3m', '4m', '5m']

function gbmQuantile(driftPct: number, volPct: number, months: number, z: number): number {
  const mu = driftPct / 100
  const sigma = Math.max(volPct / 100, 0.0001)
  const tau = months / 12
  const exponent = (mu - (sigma * sigma) / 2) * tau + sigma * Math.sqrt(tau) * z
  return Math.exp(exponent) - 1
}

// Evenly sample n values across an array (keeps first and last).
function sampleEvenly(arr: number[], n: number): number[] {
  if (arr.length <= n) return arr.slice()
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    out.push(arr[Math.round((i / (n - 1)) * (arr.length - 1))])
  }
  return out
}

function buildScenario(
  totalEquityVal: number,
  driftPct: number,
  volPct: number,
  histPath?: number[],
): ProjectionPoint[] {
  const points: ProjectionPoint[] = []
  // Historical lead-in. Prefer the real equity curve (jagged % returns relative
  // to today); fall back to a smooth drift back-cast when history is absent.
  if (histPath && histPath.length > 0) {
    for (const ret of histPath) {
      points.push({ label: '', hist: ret, median: null, outer: null, inner: null })
    }
  } else {
    const mu = driftPct / 100
    for (let m = -5; m < 0; m++) {
      points.push({
        label: '',
        hist: (Math.exp(mu * (m / 12)) - 1) * 100,
        median: null,
        outer: null,
        inner: null,
      })
    }
  }
  for (let m = 0; m <= 5; m++) {
    if (m === 0) {
      points.push({ label: 'Today', hist: 0, median: 0, outer: [0, 0], inner: [0, 0] })
      continue
    }
    points.push({
      label: MONTH_LABELS[m],
      hist: null,
      median: gbmQuantile(driftPct, volPct, m, 0) * 100,
      outer: [
        gbmQuantile(driftPct, volPct, m, Z.p10) * 100,
        gbmQuantile(driftPct, volPct, m, Z.p90) * 100,
      ],
      inner: [
        gbmQuantile(driftPct, volPct, m, Z.p25) * 100,
        gbmQuantile(driftPct, volPct, m, Z.p75) * 100,
      ],
    })
  }
  void totalEquityVal
  return points
}

export interface MonteCarlo {
  current: ProjectionPoint[]
  projected: ProjectionPoint[]
  improvementDollars: number
}

export function buildMonteCarlo(result: LensResult, historyEquity?: number[]): MonteCarlo {
  const equity = totalEquity(result) || 1
  const drift = portfolioSlopePct(result)
  const vol = portfolioVolPct(result) || 20
  const caution = result.caution_score ?? 0

  // Real historical lead-in: down-sample the equity curve to ~12 points and
  // express each as a % return relative to the latest value (so it lands at 0%
  // today). Both scenarios share this same real past. 12:6 history:projection
  // keeps the projection fan from being crushed against the right edge.
  let histPath: number[] | undefined
  if (historyEquity && historyEquity.length >= 2) {
    const last = historyEquity[historyEquity.length - 1]
    if (last > 0) {
      histPath = sampleEvenly(historyEquity, 12).map((v) => (v / last - 1) * 100)
    }
  }

  // "With all Lens projections": acting on the CTAs trims risk and nudges drift
  // up modestly. Reduction scales with how much caution there is to work off.
  const volReduction = Math.min(0.5, Math.max(0.05, (caution / 100) * 0.5))
  const improvedVol = vol * (1 - volReduction)
  const improvedDrift = drift + (caution / 100) * 4

  const current = buildScenario(equity, drift, vol, histPath)
  const projected = buildScenario(equity, improvedDrift, improvedVol, histPath)

  const medianCurrent = gbmQuantile(drift, vol, 5, 0)
  const medianProjected = gbmQuantile(improvedDrift, improvedVol, 5, 0)
  const improvementDollars = Math.max(0, (medianProjected - medianCurrent) * equity)

  return { current, projected, improvementDollars }
}

// Sector allocation from a raw positions list (for the projected-allocation pie).
export function sectorWeightsFromPositions(positions: Position[]): SectorSlice[] {
  const totals: Record<string, number> = {}
  let grand = 0
  for (const p of positions) {
    const value = p.equity || p.shares * p.price || 0
    const sector = p.sector && p.sector !== 'Unknown' ? p.sector : 'Other'
    totals[sector] = (totals[sector] ?? 0) + value
    grand += value
  }
  if (grand <= 0) return []
  return Object.entries(totals)
    .map(([name, v]) => ({ name, value: (v / grand) * 100 }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value)
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

export function formatCurrency(value: number, fractionDigits = 2): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

export function formatSignedCurrency(value: number, fractionDigits = 2): string {
  const sign = value >= 0 ? '+' : '-'
  return `${sign}${formatCurrency(Math.abs(value), fractionDigits)}`
}

export function formatPercent(value: number, fractionDigits = 2): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(fractionDigits)}%`
}

// Pie palette: brand teal/sky/gain, then cool slate shades. No purple (styling.md
// hard rule). The canonical definition now lives in the chart layer
// (src/components/charts/chartUtils.tsx); re-exported here so existing
// `import { PIE_COLORS } from '@/lib/lensData'` call sites keep working.
export { PIE_COLORS } from '@/components/charts'
