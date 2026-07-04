import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, ChevronRight } from 'lucide-react'
import { type LensResult } from '@/api/lens'
import { Panel } from '@/components/common/Panel'
import { BriefText } from '@/components/common/BriefText'
import { Button } from '@/components/ui/button'
import {
  EquityChart,
  CyclablePieChart,
  CHART_COLORS,
  PIE_COLORS,
  type PieView,
  type Timeframe,
  type EquityChartPoint,
} from '@/components/charts'
import { VerticalCycleControl } from '@/components/common/CycleControl'
import {
  portfolioSlopePct,
  portfolioBeta,
  betaClass,
  sharpeRatio,
  sharpeClass,
  RISK_FREE_PCT,
  sectorWeights,
  tickerWeights,
  assetTypeWeights,
  sectorCount,
  concentrationSeverity,
  dividendRows,
  tickerTrendPct,
  tickerCurrentPrice,
  totalEquity,
  formatCurrency,
  formatSignedCurrency,
  formatPercent,
  type SectorSlice,
} from '@/lib/lensData'
import { getPositions } from '@/lib/cookies'
import { usePortfolioHistory } from '@/hooks/usePortfolioHistory'

// Card title = styling.md --text-heading-md (20px / 600, tightened tracking).
function WidgetHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-xl font-semibold text-primary">{title}</h3>
      {right && <span className="text-xs text-secondary">{right}</span>}
    </div>
  )
}

// Shared table-header row styling (styling.md §Tables): 13px / 500, uppercase,
// secondary, slight positive tracking.
const TH = 'text-[13px] font-medium uppercase tracking-[0.01em] text-secondary'

// Portfolio Vector lives in its own file (5 cyclable indicator styles); re-export
// it here so the Dashboard's single widget import keeps working.
export { PortfolioVectorWidget } from './PortfolioVector'

// Caution Score (flagship differentiator) lives in its own file; re-exported here
// so the Dashboard imports every widget from one place.
export { CautionScoreWidget } from './CautionScoreWidget'

// Position Actions (add / manage holdings) lives in the dashboard folder with its
// modal + drawer; re-exported here so the registry imports every widget from one place.
export { PositionActionsWidget } from '@/components/dashboard/PositionActions'

// ---------------------------------------------------------------------------
// Lens Brief
// ---------------------------------------------------------------------------

// The plain-English brief, now a first-class grid widget (was a fixed top-row
// Panel). Flex column so the Analysis button pins to the bottom of whatever cell
// height the grid gives it; overflow-visible so long briefs spill rather than clip.
export function LensBriefWidget({ result }: { result: LensResult }) {
  const navigate = useNavigate()
  return (
    // Height is locked to the cell (lockHeight in the registry), so the widget
    // must contain its own content: overflow-hidden + a scrollable text area, with
    // the Analysis button pinned below.
    <Panel className="flex h-full flex-col overflow-hidden">
      <WidgetHeader title="Lens Brief" />
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        <BriefText result={result} className="text-base leading-[1.6] text-primary" />
      </div>
      <div className="flex justify-end pt-4">
        <Button variant="teal" size="sm" onClick={() => navigate('/analysis')}>
          Analysis <ChevronRight size={16} />
        </Button>
      </div>
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

export function PositionsWidget({ result }: { result: LensResult }) {
  const positions = getPositions()

  return (
    <Panel>
      <WidgetHeader title="Positions" right={`${positions.length} positions`} />
      <div className={`grid grid-cols-[1.6fr_0.8fr_0.9fr_1fr_0.9fr] gap-2 border-b border-subtle pb-2 px-2 ${TH}`}>
        <span>Ticker</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Price</span>
        <span className="text-right">Equity</span>
        <span className="text-right">6mo</span>
      </div>
      {/* Scrolls after 4 rows using the app-wide dark scrollbar (index.css). The
          px-2 here + on the header keeps the columns aligned against the gutter and
          gives the row hover box's -mx-2 bleed room so its left edge isn't clipped. */}
      <div className="max-h-[232px] divide-y divide-subtle overflow-y-auto overflow-x-hidden px-2">
        {positions.map((p) => {
          const price = tickerCurrentPrice(result, p.ticker) || p.price
          const equity = price * p.shares
          const trend = tickerTrendPct(result, p.ticker)
          return (
            <div
              key={p.ticker}
              className="-mx-2 grid grid-cols-[1.6fr_0.8fr_0.9fr_1fr_0.9fr] items-center gap-2 rounded-sm px-2 py-2.5 text-sm transition-colors duration-200 ease-out hover:bg-card-hover"
            >
              <div className="min-w-0">
                <p className="font-semibold text-primary">{p.ticker}</p>
                <p className="truncate text-xs text-secondary">{p.name ?? p.ticker}</p>
              </div>
              <span className="text-right text-secondary">{p.shares}</span>
              <span className="text-right text-secondary">{formatCurrency(price)}</span>
              <span className="text-right font-semibold text-primary">
                {formatCurrency(equity)}
              </span>
              <span
                className={`text-right ${trend >= 0 ? 'text-accent-green' : 'text-accent-red'}`}
              >
                {formatPercent(trend, 1)}
              </span>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Total Equity
// ---------------------------------------------------------------------------

const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL']
// Lookback window per timeframe, in calendar days (ALL = the whole curve).
const TF_DAYS: Record<Timeframe, number> = {
  '1D': 1,
  '1W': 7,
  '1M': 31,
  '3M': 93,
  '1Y': 366,
  ALL: Infinity,
}
// Stable empty array so useMemo below doesn't re-run every render while loading.
const NO_POINTS: EquityChartPoint[] = []

function dateMs(s: string): number {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1).getTime()
}

// Slice the full (5y) equity curve down to the selected timeframe window. Data is
// daily-close only, so 1D / 1W are coarse (a handful of closes). Falls back to a
// straight slope-synthesized line with generated dates when real history is
// unavailable (still loading or the ticker history calls failed).
function windowPoints(
  all: EquityChartPoint[],
  tf: Timeframe,
  equity: number,
  slope: number,
): EquityChartPoint[] {
  if (all.length >= 2) {
    if (tf === 'ALL') return all
    const end = dateMs(all[all.length - 1].date)
    const cutoff = end - TF_DAYS[tf] * 86400000
    const win = all.filter((p) => dateMs(p.date) >= cutoff)
    return win.length >= 2 ? win : all.slice(-2)
  }
  return synthPoints(tf, equity, slope)
}

function synthPoints(tf: Timeframe, equity: number, slope: number): EquityChartPoint[] {
  const days = TF_DAYS[tf] === Infinity ? 730 : TF_DAYS[tf]
  const n = Math.max(8, Math.min(60, Math.round(days / 5)))
  const periodReturn = (slope / 100) * (days / 365)
  const now = Date.now()
  return Array.from({ length: n }, (_, i) => {
    const frac = i / (n - 1)
    const d = new Date(now - days * 86400000 * (1 - frac))
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`
    return { date, equity: equity * (1 - periodReturn * (1 - frac)) }
  })
}

export function TotalEquityWidget({ result }: { result: LensResult }) {
  const equity = totalEquity(result)
  const slope = portfolioSlopePct(result)
  // One fetch of the max range; timeframe switching then just re-slices locally.
  const history = usePortfolioHistory('5y')
  const all = (history.data ?? NO_POINTS) as EquityChartPoint[]

  const [tfIndex, setTfIndex] = useState(4) // default 1Y
  const timeframe = TIMEFRAMES[tfIndex]

  const points = useMemo(
    () => windowPoints(all, timeframe, equity, slope),
    [all, timeframe, equity, slope],
  )

  const firstEq = points[0]?.equity ?? equity
  const lastEq = points[points.length - 1]?.equity ?? equity
  const changeDollars = lastEq - firstEq
  const changePct = firstEq ? (changeDollars / firstEq) * 100 : 0
  const up = changeDollars >= 0
  const numberColor = up ? 'text-accent-green' : 'text-accent-red'
  const chartColor = up ? CHART_COLORS.green : CHART_COLORS.red

  const stepTf = (delta: number) =>
    setTfIndex((i) => (i + delta + TIMEFRAMES.length) % TIMEFRAMES.length)

  return (
    <Panel>
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-xl font-semibold text-primary">Total Equity</h3>
          <p className={`mt-2 text-[28px] font-semibold tracking-[-0.02em] ${numberColor}`}>
            {formatCurrency(equity)}
          </p>
          {/* Net change over the selected timeframe window. */}
          <p className={`mt-1 text-sm ${numberColor}`}>
            {formatSignedCurrency(changeDollars)} &nbsp; {formatPercent(changePct)}
          </p>
        </div>
        {/* Vertical up/down cycler steps the timeframe (default 1Y). */}
        <VerticalCycleControl
          label={timeframe}
          onPrev={() => stepTf(-1)}
          onNext={() => stepTf(1)}
        />
      </div>

      <div className="mt-3">
        <EquityChart
          points={points}
          timeframe={timeframe}
          color={chartColor}
          valueFormatter={formatCurrency}
          height={190}
        />
      </div>
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Sharpe Ratio
// ---------------------------------------------------------------------------

const SHARPE_SCALE = [
  { label: 'Excellent', range: '> 2.0', test: (v: number) => v > 2 },
  { label: 'Good', range: '1 to 2', test: (v: number) => v >= 1 && v <= 2 },
  { label: 'Sub-optimal', range: '0 to 1', test: (v: number) => v >= 0 && v < 1 },
  { label: 'Poor', range: '< 0', test: (v: number) => v < 0 },
]

export function SharpeWidget({ result }: { result: LensResult }) {
  const value = sharpeRatio(result)

  return (
    <Panel>
      <WidgetHeader title="Sharpe Ratio" right="6 months" />
      {value === null ? (
        <p className="text-[28px] font-semibold text-muted">--</p>
      ) : (
        <>
          <div className="flex items-baseline gap-3">
            <span
              style={{ color: sharpeClass(value).color }}
              className="text-[28px] font-semibold tracking-[-0.02em]"
            >
              {value.toFixed(2)}
            </span>
            <span style={{ color: sharpeClass(value).color }} className="text-sm font-medium">
              {sharpeClass(value).label}
            </span>
          </div>
          <p className="mt-1 text-xs text-secondary">rf = {RISK_FREE_PCT}%</p>
          <div className="mt-4 space-y-1.5">
            {SHARPE_SCALE.map((row) => {
              const active = row.test(value)
              return (
                <div
                  key={row.label}
                  className={`flex items-center justify-between text-sm ${
                    active ? 'text-primary' : 'text-muted'
                  }`}
                >
                  <span>{row.label}</span>
                  <span>{row.range}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

// Assign brand palette colors to a sorted breakdown by index.
function colorize(slices: SectorSlice[]) {
  return slices.map((s, i) => ({
    name: s.name,
    value: s.value,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))
}

// Singular unit shown in the header for each breakdown, pluralized by count.
const COMPOSITION_UNITS: Record<string, string> = {
  'By Sector': 'sector',
  'By Ticker': 'stock',
  'By Type': 'type',
}

export function CompositionWidget({ result }: { result: LensResult }) {
  const positions = getPositions()
  const concentrated = ['moderate', 'high', 'critical'].includes(concentrationSeverity(result))
  const [viewIndex, setViewIndex] = useState(0)

  const views: PieView[] = [
    { label: 'By Sector', data: colorize(sectorWeights(result)) },
    { label: 'By Ticker', data: colorize(tickerWeights(result, positions)) },
    { label: 'By Type', data: colorize(assetTypeWeights(positions)) },
  ].filter((v) => v.data.length > 0)

  // Header count tracks the visible view: "5 sectors" / "8 stocks" / "3 types".
  const activeView = views.length > 0 ? views[viewIndex % views.length] : null
  const unit = activeView ? COMPOSITION_UNITS[activeView.label] ?? 'item' : 'sector'
  const count = activeView ? activeView.data.length : sectorCount(result)

  return (
    <Panel>
      <WidgetHeader title="Composition" right={`${count} ${unit}${count === 1 ? '' : 's'}`} />
      {concentrated && (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-accent-yellow">
          <AlertTriangle size={14} />
          Concentrated in one sector
        </p>
      )}
      {/* Cycle control lives under the legend list now, so the pie can run larger.
          Sized up to fill the wider 6-column card; `height` sets the legend-column
          height, so raising it drops the cycle control further down the card. */}
      <CyclablePieChart
        views={views}
        height={300}
        size={124}
        innerRadius={80}
        index={viewIndex}
        onIndexChange={setViewIndex}
      />
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Beta
// ---------------------------------------------------------------------------

export function BetaWidget({ result }: { result: LensResult }) {
  const beta = portfolioBeta(result)
  const cls = betaClass(beta)
  const fillPct = Math.min(100, Math.max(0, (beta / 2) * 100))

  return (
    <Panel>
      <WidgetHeader title="Beta" right="vs SPY · 6 months" />
      <div className="flex items-baseline gap-3">
        <span
          style={{ color: cls.color }}
          className="text-[28px] font-semibold tracking-[-0.02em]"
        >
          {beta.toFixed(2)}
        </span>
        <span style={{ color: cls.color }} className="text-sm font-medium">
          {cls.label}
        </span>
      </div>
      <div className="relative mt-4 h-2 w-full rounded-full bg-base">
        <div
          className="h-2 rounded-full"
          style={{ width: `${fillPct}%`, backgroundColor: cls.color }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-base bg-primary"
          style={{ left: `${fillPct}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-secondary">
        {beta < 0.9
          ? 'Less volatile than the market, the book should move less in both directions.'
          : beta <= 1.1
            ? 'Roughly tracks the broad market.'
            : 'More volatile than the market, expect amplified swings.'}
      </p>
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Dividend Calendar
// ---------------------------------------------------------------------------

function dueColor(days: number): string {
  if (days < 30) return 'bg-accent-red/15 text-accent-red'
  if (days <= 60) return 'bg-accent-yellow/15 text-accent-yellow'
  return 'bg-accent-teal/15 text-accent-teal'
}

export function DividendCalendarWidget({ result }: { result: LensResult }) {
  const rows = dividendRows(result)

  return (
    <Panel>
      <WidgetHeader title="Dividend Calendar" right="estimated" />
      {rows.length === 0 ? (
        <p className="text-sm text-secondary">No upcoming dividends detected.</p>
      ) : (
        <>
          <div className={`grid grid-cols-[0.7fr_0.8fr_1fr_1fr_0.8fr] gap-2 border-b border-subtle pb-2 ${TH}`}>
            <span>Due</span>
            <span>Ticker</span>
            <span>Est. Date</span>
            <span>Frequency</span>
            <span className="text-right">Per Share</span>
          </div>
          <div className="divide-y divide-subtle">
            {rows.map((row) => (
              <div
                key={row.ticker}
                className="-mx-2 grid grid-cols-[0.7fr_0.8fr_1fr_1fr_0.8fr] items-center gap-2 rounded-sm px-2 py-2.5 text-sm transition-colors duration-200 ease-out hover:bg-card-hover"
              >
                <span
                  className={`inline-flex w-fit rounded-md px-2 py-0.5 text-xs font-medium ${dueColor(
                    row.daysUntil,
                  )}`}
                >
                  +{row.daysUntil}d
                </span>
                <span className="font-semibold text-primary">{row.ticker}</span>
                <span className="text-secondary">{row.exDate ?? '--'}</span>
                <span className="text-secondary">{row.frequency ?? 'Quarterly'}</span>
                <span className="text-right text-primary">
                  {row.amount != null ? formatCurrency(row.amount) : '--'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Panel>
  )
}
