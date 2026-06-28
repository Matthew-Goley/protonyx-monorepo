import { AlertTriangle } from 'lucide-react'
import { type LensResult } from '@/api/lens'
import { Panel } from '@/components/common/Panel'
import {
  LensAreaChart,
  CyclablePieChart,
  CHART_COLORS,
  PIE_COLORS,
  type PieView,
} from '@/components/charts'
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

// ---------------------------------------------------------------------------
// Positions
// ---------------------------------------------------------------------------

export function PositionsWidget({ result }: { result: LensResult }) {
  const positions = getPositions()

  return (
    <Panel>
      <WidgetHeader title="Positions" right={`${positions.length} positions`} />
      <div className={`grid grid-cols-[1.6fr_0.8fr_0.9fr_1fr_0.9fr] gap-2 border-b border-subtle pb-2 pr-2 ${TH}`}>
        <span>Ticker</span>
        <span className="text-right">Shares</span>
        <span className="text-right">Price</span>
        <span className="text-right">Equity</span>
        <span className="text-right">6mo</span>
      </div>
      {/* Scrolls after 4 rows using the app-wide dark scrollbar (index.css). The
          pr-2 here + on the header keeps the columns aligned against the gutter. */}
      <div className="max-h-[232px] divide-y divide-subtle overflow-y-auto overflow-x-hidden pr-2">
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

export function TotalEquityWidget({ result }: { result: LensResult }) {
  const equity = totalEquity(result)
  const slope = portfolioSlopePct(result)
  const history = usePortfolioHistory('6mo')
  const real = history.data ?? []
  const hasReal = real.length >= 2

  let spark: { x: number; y: number }[]
  let changeDollars: number
  let changePct: number
  let footnote: string

  if (hasReal) {
    // Real daily equity curve (jagged). Sparkline shows the recent window; the
    // 5-day change compares the last close to ~5 trading days prior.
    const recent = real.slice(-40)
    spark = recent.map((pt, i) => ({ x: i, y: pt.equity }))
    const last = recent[recent.length - 1].equity
    const ref = recent[Math.max(0, recent.length - 6)].equity
    changeDollars = last - ref
    changePct = ref !== 0 ? (changeDollars / ref) * 100 : 0
    footnote = 'Live daily closes'
  } else {
    // Fallback until history loads (or if it fails): synthesize from the slope.
    changePct = (slope / 252) * 5
    changeDollars = (equity * changePct) / 100
    spark = Array.from({ length: 12 }, (_, i) => ({
      x: i,
      y: equity * (1 + (changePct / 100) * ((i - 11) / 11)),
    }))
    footnote = 'Estimated from 6-month trend'
  }

  const positive = changeDollars >= 0
  const color = positive ? 'text-accent-green' : 'text-accent-red'

  return (
    <Panel>
      <WidgetHeader title="Total Equity" right="5-day change" />
      <p className={`text-[28px] font-semibold tracking-[-0.02em] ${color}`}>
        {formatCurrency(equity)}
      </p>
      <p className={`mt-1 text-sm ${color}`}>
        {formatSignedCurrency(changeDollars)} &nbsp; {formatPercent(changePct)}
      </p>
      <div className="mt-3">
        <LensAreaChart
          data={spark}
          xKey="x"
          areas={[{ key: 'y', color: CHART_COLORS.green, strokeWidth: 2 }]}
          showGrid={false}
          showAxes={false}
          showTooltip
          tooltipFormatter={(v) => formatCurrency(Number(v))}
          hideTooltipLabel
          height={64}
        />
      </div>
      <p className="mt-1 text-[11px] text-secondary">{footnote}</p>
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
// Diversification
// ---------------------------------------------------------------------------

// Assign brand palette colors to a sorted breakdown by index.
function colorize(slices: SectorSlice[]) {
  return slices.map((s, i) => ({
    name: s.name,
    value: s.value,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }))
}

export function DiversificationWidget({ result }: { result: LensResult }) {
  const positions = getPositions()
  const concentrated = ['moderate', 'high', 'critical'].includes(concentrationSeverity(result))

  const views: PieView[] = [
    { label: 'By Sector', data: colorize(sectorWeights(result)) },
    { label: 'By Ticker', data: colorize(tickerWeights(result, positions)) },
    { label: 'By Type', data: colorize(assetTypeWeights(positions)) },
  ].filter((v) => v.data.length > 0)

  return (
    <Panel>
      <WidgetHeader title="Diversification" right={`${sectorCount(result)} sectors`} />
      {concentrated && (
        <p className="mb-3 flex items-center gap-1.5 text-xs text-accent-yellow">
          <AlertTriangle size={14} />
          Concentrated in one sector
        </p>
      )}
      <CyclablePieChart views={views} height={180} />
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
