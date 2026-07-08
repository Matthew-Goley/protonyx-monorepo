import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { TrendingUp, TrendingDown, Info, ShieldCheck, AlertTriangle } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Panel, CardLabel } from '@/components/common/Panel'
import { PageLoader } from '@/components/common/PageLoader'
import { TimeframeAreaChart } from '@/components/common/TimeframeAreaChart'
import { type EquityChartPoint } from '@/components/charts'
import { AddPositionModal } from '@/components/common/AddPositionModal'
import { Button } from '@/components/ui/button'
import { usePositionsManager } from '@/hooks/usePositionsManager'
import { lensApi, type Position } from '@/api/lens'
import { cn } from '@/lib/utils'

/*
  Markets / instrument-detail screen. Fetches a live quote (GET /ticker/{symbol}/quote)
  and real daily price history (GET /ticker/{symbol}/history) from lens-api (yfinance),
  then renders identity + live price, a timeframe-stepped price chart (the same chart
  surface as the dashboard Portfolio Value widget), key statistics, and a
  plain-language "About" block. Reachable from the TopBar search.
*/

function money(n: number | null | undefined, currency = 'USD'): string {
  if (n === null || n === undefined) return '--'
  const sym = currency === 'USD' ? '$' : ''
  return `${sym}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Compact large-number formatter for market cap / volume (1.46T, 38.4M).
function compact(n: number | null | undefined): string {
  if (n === null || n === undefined) return '--'
  const abs = Math.abs(n)
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(2)}K`
  return `${n.toLocaleString('en-US')}`
}

function num(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return '--'
  return n.toFixed(digits)
}

// Pretty-print the raw yfinance quoteType/exchange for the badge and facts rows.
function prettyType(type: string): string {
  const map: Record<string, string> = {
    EQUITY: 'Stock',
    ETF: 'ETF',
    MUTUALFUND: 'Mutual Fund',
    INDEX: 'Index',
    CRYPTOCURRENCY: 'Crypto',
    CURRENCY: 'Currency',
  }
  return map[type?.toUpperCase()] ?? (type || 'Stock')
}

export function Commodity() {
  const { symbol } = useParams()
  const sym = (symbol ?? '').toUpperCase()
  const [addOpen, setAddOpen] = useState(false)
  const manager = usePositionsManager()

  const quoteQuery = useQuery({
    queryKey: ['ticker-quote', sym],
    queryFn: () => lensApi.getTickerQuote(sym),
    enabled: sym.length > 0,
    staleTime: 60 * 1000,
    retry: 1,
  })

  const historyQuery = useQuery({
    queryKey: ['ticker-history', sym, '5y'],
    queryFn: () => lensApi.getTickerHistory(sym, '5y'),
    enabled: sym.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const c = quoteQuery.data
  const history = historyQuery.data

  // Full 5y daily-close series mapped to the shared chart's point shape (its
  // `equity` field carries the close price here). TimeframeAreaChart windows it
  // per selected timeframe internally.
  const priceAll = useMemo<EquityChartPoint[]>(
    () => (history ?? []).map((p) => ({ date: p.date, equity: p.close })),
    [history],
  )

  function addPosition(p: Position) {
    manager.addPosition(p)
    setAddOpen(false)
  }

  if (quoteQuery.isLoading) {
    return (
      <AppShell>
        <PageLoader label={`Loading ${sym}`} />
      </AppShell>
    )
  }

  if (quoteQuery.isError || !c) {
    return (
      <AppShell>
        <PageHeader title="Markets" breadcrumb={`Search / ${sym}`} />
        <Panel className="flex flex-col items-center gap-3 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-red/10 text-accent-red">
            <AlertTriangle size={22} />
          </span>
          <h2 className="text-xl font-semibold text-primary">Couldn't find "{sym}"</h2>
          <p className="max-w-md text-sm text-secondary">
            We couldn't load data for that symbol. Check the ticker and try searching again from the
            bar above.
          </p>
        </Panel>
      </AppShell>
    )
  }

  const type = prettyType(c.type)
  const change = c.price !== null && c.prev_close !== null ? c.price - c.prev_close : null
  const changePct = change !== null && c.prev_close ? (change / c.prev_close) * 100 : null
  const up = (change ?? 0) >= 0

  return (
    <AppShell>
      <PageHeader title="Markets" breadcrumb={`Search / ${c.symbol}`} />

      {/* Identity + live price */}
      <Panel className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold tracking-[-0.02em] text-primary">{c.symbol}</h2>
              <TypeBadge type={type} />
            </div>
            <p className="mt-0.5 text-sm text-secondary">
              {c.name}
              {c.exchange && (
                <>
                  {' '}
                  <span className="text-muted">·</span> {c.exchange}
                </>
              )}{' '}
              <span className="text-muted">·</span> {c.currency}
            </p>
          </div>
        </div>

        <div className="md:text-right">
          <div className="flex items-baseline gap-3 md:justify-end">
            <span className="text-[28px] font-semibold tracking-[-0.02em] text-primary">
              {money(c.price, c.currency)}
            </span>
            {change !== null && changePct !== null && (
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
            )}
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-secondary md:justify-end">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-green opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-green" />
            </span>
            Live quote via Yahoo Finance
          </p>
        </div>
      </Panel>

      {/* Chart + key statistics */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          {historyQuery.isLoading ? (
            <div className="flex h-[320px] items-center justify-center text-sm text-muted">
              Loading price history...
            </div>
          ) : priceAll.length < 2 ? (
            <div className="flex h-[320px] items-center justify-center text-sm text-muted">
              No price history available.
            </div>
          ) : (
            // Same chart surface as the Portfolio Value widget (timeframe stepper,
            // hover + drag range inspection, signed $/% period-return readout),
            // minus the big value readout: the live price stays in the header above.
            // The period-return readout is promoted to the panel headline (`lg`),
            // standing in for a "Price" label.
            <TimeframeAreaChart
              all={priceAll}
              liveValue={c.price ?? priceAll[priceAll.length - 1].equity}
              height={320}
              readoutSize="lg"
            />
          )}
        </Panel>

        <Panel>
          <CardLabel className="mb-4">Key statistics</CardLabel>
          <dl className="divide-y divide-subtle">
            <Stat label="Open" value={money(c.open, c.currency)} />
            <Stat label="Previous close" value={money(c.prev_close, c.currency)} />
            <Stat
              label="Day range"
              value={`${money(c.day_low, c.currency)} - ${money(c.day_high, c.currency)}`}
            />
            <Stat
              label="52-week range"
              value={`${money(c.year_low, c.currency)} - ${money(c.year_high, c.currency)}`}
            />
            <Stat label="Volume" value={compact(c.volume)} />
            <Stat label="Avg. volume" value={compact(c.avg_volume)} />
            <Stat label="Market cap" value={c.market_cap !== null ? `$${compact(c.market_cap)}` : '--'} />
            <Stat label="P/E ratio" value={num(c.pe_ratio, 1)} />
            <Stat label="EPS" value={money(c.eps, c.currency)} />
            <Stat
              label="Dividend yield"
              value={c.dividend_yield !== null ? `${c.dividend_yield.toFixed(2)}%` : '--'}
            />
            <Stat label="Beta" value={num(c.beta, 2)} />
          </dl>
        </Panel>
      </div>

      {/* About + at-a-glance */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Panel className="lg:col-span-2">
          <CardLabel className="mb-3 flex items-center gap-2">
            <Info size={14} /> About {c.name}
          </CardLabel>
          <ExpandableText
            text={
              c.description ??
              `${c.name} is listed on ${c.exchange || 'a major exchange'}. A detailed business description is not available for this instrument.`
            }
          />

          {/* Wrapper carries the spacing: .gradient-hairline sets `margin: 0`
              (unlayered) which would override a `my-*` utility on the line itself. */}
          <div className="py-10">
            <div className="gradient-hairline" />
          </div>

          <div className="grid grid-cols-[repeat(2,minmax(0,max-content))] gap-x-16 gap-y-6 sm:grid-cols-[repeat(3,minmax(0,max-content))]">
            <Fact label="Sector" value={c.sector ?? '--'} />
            <Fact label="Industry" value={c.industry ?? '--'} />
            <Fact label="Asset type" value={type} />
            <Fact label="Exchange" value={c.exchange || '--'} />
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
            <Button variant="gradient" className="w-full" onClick={() => setAddOpen(true)}>
              Add to portfolio
            </Button>
          </div>
        </Panel>
      </div>

      {addOpen && (
        <AddPositionModal
          onClose={() => setAddOpen(false)}
          onAdd={addPosition}
          initialTicker={c.symbol}
        />
      )}
    </AppShell>
  )
}

// Business description, clamped to 4 lines with a Show more / Show less toggle.
// The toggle only appears when the text actually overflows 4 lines: we measure
// once while collapsed (scrollHeight vs the clamped clientHeight).
function ExpandableText({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false)
  const [overflows, setOverflows] = useState(false)
  const ref = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Measured on the initial (collapsed) render; not re-run on expand, so the
    // toggle stays put once shown.
    setOverflows(el.scrollHeight > el.clientHeight + 1)
  }, [text])

  return (
    <div>
      <p
        ref={ref}
        className={cn('text-sm leading-relaxed text-secondary', !expanded && 'line-clamp-4')}
      >
        {text}
      </p>
      {overflows && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-sm font-medium text-accent-teal transition-colors duration-200 ease-out hover:text-primary"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
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
