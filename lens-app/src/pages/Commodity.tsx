import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { TrendingUp, TrendingDown, Info, ShieldCheck } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Panel, CardLabel } from '@/components/common/Panel'
import { LensLineChart } from '@/components/charts/LensLineChart'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/*
  Commodity (instrument) detail screen. Layout and styling are the focus here;
  the numbers are placeholder/example data until this is wired to real quotes.
  Reachable today only via searching "example" in the top bar -> /commodity/example.
*/

// ── Placeholder instrument ───────────────────────────────────────────────────
const EXAMPLE = {
  symbol: 'EXMPL',
  name: 'Example Corporation',
  type: 'Stock',
  exchange: 'NASDAQ',
  currency: 'USD',
  price: 184.62,
  prevClose: 181.3,
  open: 182.04,
  dayHigh: 186.11,
  dayLow: 181.42,
  yearHigh: 211.74,
  yearLow: 142.18,
  volume: '38.4M',
  avgVolume: '41.2M',
  marketCap: '1.46T',
  peRatio: 28.7,
  eps: 6.43,
  dividendYield: 0.62,
  beta: 1.08,
  sector: 'Technology',
  industry: 'Consumer Electronics',
  description:
    'Example Corporation is a large, established company used here as placeholder data. In the real product this space explains, in plain language, what the company does, how it makes money, and why it might matter to your portfolio so you can decide with context rather than guesswork.',
}

const RANGES = ['1D', '1W', '1M', '3M', '1Y', '5Y'] as const
type Range = (typeof RANGES)[number]

// Deterministic pseudo-random series so the chart is stable across renders but
// changes shape per range. Shifted so the final point equals the live price.
function seriesForRange(range: Range, endPrice: number) {
  const cfg: Record<Range, { points: number; seed: number; vol: number; drift: number }> = {
    '1D': { points: 80, seed: 11, vol: 0.004, drift: 0.0002 },
    '1W': { points: 56, seed: 23, vol: 0.008, drift: 0.0006 },
    '1M': { points: 44, seed: 37, vol: 0.012, drift: 0.0009 },
    '3M': { points: 66, seed: 51, vol: 0.016, drift: 0.0011 },
    '1Y': { points: 120, seed: 71, vol: 0.02, drift: 0.0014 },
    '5Y': { points: 130, seed: 93, vol: 0.03, drift: 0.0019 },
  }
  const { points, seed, vol, drift } = cfg[range]
  let s = seed
  const rand = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  let p = endPrice * 0.78
  const raw: number[] = []
  for (let i = 0; i < points; i++) {
    p = Math.max(1, p * (1 + drift + (rand() - 0.5) * vol))
    raw.push(p)
  }
  // Additive shift so the series ends exactly on the displayed price.
  const shift = endPrice - raw[raw.length - 1]
  return raw.map((v, i) => ({ t: i, price: Number((v + shift).toFixed(2)) }))
}

function money(n: number) {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function Commodity() {
  const { symbol } = useParams()
  const [range, setRange] = useState<Range>('3M')

  // Only "example" exists for now; any symbol resolves to the placeholder.
  const c = EXAMPLE
  const data = useMemo(() => seriesForRange(range, c.price), [range, c.price])

  const change = c.price - c.prevClose
  const changePct = (change / c.prevClose) * 100
  const up = change >= 0
  const dayRangePct = ((c.price - c.dayLow) / (c.dayHigh - c.dayLow)) * 100

  return (
    <AppShell>
      <PageHeader
        title="Markets"
        breadcrumb={`Search / ${symbol?.toUpperCase() ?? c.symbol}`}
      />

      {/* ── Identity + live price ─────────────────────────────────────────── */}
      <Panel className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg border border-subtle bg-elevated text-lg font-semibold text-primary">
            {c.symbol.slice(0, 2)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-primary">{c.symbol}</h2>
              <TypeBadge type={c.type} />
            </div>
            <p className="mt-0.5 text-sm text-secondary">
              {c.name} <span className="text-muted">·</span> {c.exchange} <span className="text-muted">·</span>{' '}
              {c.currency}
            </p>
          </div>
        </div>

        <div className="md:text-right">
          <div className="flex items-baseline gap-3 md:justify-end">
            <span className="text-[28px] font-semibold tracking-[-0.02em] text-primary">{money(c.price)}</span>
            <span
              className={cn(
                'flex items-center gap-1 text-sm font-medium',
                up ? 'text-accent-green' : 'text-accent-red',
              )}
            >
              {up ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
              {up ? '+' : ''}
              {change.toFixed(2)} ({up ? '+' : ''}
              {changePct.toFixed(2)}%)
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-secondary md:justify-end">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-green" />
            </span>
            Example data · not a live quote
          </p>
        </div>
      </Panel>

      {/* ── Chart + key statistics ────────────────────────────────────────── */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <CardLabel>Price</CardLabel>
            <div className="flex items-center gap-1 rounded-md border border-subtle bg-elevated p-0.5">
              {RANGES.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={cn(
                    'rounded px-2.5 py-1 text-xs font-medium transition-colors duration-200 ease-out',
                    r === range
                      ? 'bg-accent-teal/15 text-accent-teal'
                      : 'text-secondary hover:text-primary',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <LensLineChart
            data={data}
            xKey="t"
            lines={[{ key: 'price', color: '#38bdf8', width: 2 }]}
            gradientStroke
            height={320}
            showGrid
            showAxes
            showTooltip
          />

          {/* Day range track: where the current price sits between low and high. */}
          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-xs text-secondary">
              <span>Day low {money(c.dayLow)}</span>
              <span>Day high {money(c.dayHigh)}</span>
            </div>
            <div className="relative h-1.5 w-full rounded-full bg-elevated">
              <div className="absolute inset-y-0 left-0 rounded-full bg-accent-teal" style={{ width: `${dayRangePct}%` }} />
              <div
                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-base bg-primary"
                style={{ left: `${dayRangePct}%` }}
              />
            </div>
          </div>
        </Panel>

        <Panel>
          <CardLabel className="mb-4">Key statistics</CardLabel>
          <dl className="divide-y divide-subtle">
            <Stat label="Open" value={money(c.open)} />
            <Stat label="Previous close" value={money(c.prevClose)} />
            <Stat label="Day range" value={`${money(c.dayLow)} - ${money(c.dayHigh)}`} />
            <Stat label="52-week range" value={`${money(c.yearLow)} - ${money(c.yearHigh)}`} />
            <Stat label="Volume" value={c.volume} />
            <Stat label="Avg. volume" value={c.avgVolume} />
            <Stat label="Market cap" value={`$${c.marketCap}`} />
            <Stat label="P/E ratio" value={c.peRatio.toFixed(1)} />
            <Stat label="EPS" value={money(c.eps)} />
            <Stat label="Dividend yield" value={`${c.dividendYield.toFixed(2)}%`} />
            <Stat label="Beta" value={c.beta.toFixed(2)} />
          </dl>
        </Panel>
      </div>

      {/* ── About + at-a-glance ───────────────────────────────────────────── */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <CardLabel className="mb-3 flex items-center gap-2">
            <Info size={14} /> About {c.name}
          </CardLabel>
          <p className="text-sm leading-relaxed text-secondary">{c.description}</p>

          <div className="gradient-hairline my-6" />

          <div className="grid grid-cols-[repeat(2,minmax(0,max-content))] gap-x-16 gap-y-6 sm:grid-cols-[repeat(3,minmax(0,max-content))]">
            <Fact label="Sector" value={c.sector} />
            <Fact label="Industry" value={c.industry} />
            <Fact label="Asset type" value={c.type} />
            <Fact label="Exchange" value={c.exchange} />
            <Fact label="Currency" value={c.currency} />
            <Fact label="Symbol" value={c.symbol} />
          </div>
        </Panel>

        <Panel className="flex flex-col">
          <CardLabel className="mb-3 flex items-center gap-2">
            <ShieldCheck size={14} /> For new investors
          </CardLabel>
          <p className="text-sm leading-relaxed text-secondary">
            A <span className="text-primary">stock</span> is a share of ownership in a company. When the
            company does well its price tends to rise; when it struggles, it tends to fall. The numbers on
            this page describe how the stock is priced and traded right now. None of this is a
            recommendation.
          </p>
          <div className="mt-auto pt-6">
            <Button variant="gradient" className="w-full">
              Add to portfolio
            </Button>
          </div>
        </Panel>
      </div>
    </AppShell>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-sm text-secondary">{label}</dt>
      <dd className="text-sm font-medium text-primary">{value}</dd>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-secondary">{label}</p>
      <p className="mt-0.5 text-sm text-primary">{value}</p>
    </div>
  )
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="rounded-md border border-accent-teal/30 bg-accent-teal/10 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-accent-teal">
      {type}
    </span>
  )
}
