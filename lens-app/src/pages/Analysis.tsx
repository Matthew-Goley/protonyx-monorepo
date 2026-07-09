import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { isSubscribed } from '@/lib/subscription'
import { useLensAnalysis } from '@/hooks/useLensAnalysis'
import { usePositions } from '@/hooks/usePositions'
import { usePortfolioHistory } from '@/hooks/usePortfolioHistory'
import { type LensResult } from '@/api/lens'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Panel } from '@/components/common/Panel'
import { BriefText } from '@/components/common/BriefText'
import { PageLoader } from '@/components/common/PageLoader'
import { UpgradePrompt } from '@/components/common/UpgradePrompt'
import { Button } from '@/components/ui/button'
import { CautionGauge } from '@/components/analysis/CautionGauge'
import { HistoryModal } from '@/components/analysis/HistoryModal'
import { ProjectionCompareChart } from '@/components/charts'
import {
  buildProjection,
  ctaWeight,
  projectionYDomain,
  PROJECTION_METHODS,
  type ProjectionMethod,
  type ProjectionSeries,
} from '@/lib/projections'
import { ctaAccent, ctaActionLabel, formatCurrency, totalEquity } from '@/lib/lensData'
import { cn } from '@/lib/utils'
import { clearHistory, loadHistory, recordHistory } from '@/lib/lensHistory'

const DISCLAIMER =
  'Lens is an analytics tool, not a financial advisor. Everything here, readings, ' +
  'caution scores and projections, is informational only and not investment advice. ' +
  'Do your own research before making any investment decision.'

// No pulse animation (styling.md §Motion): a static dim surface block.
function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded-lg bg-card opacity-60 ${className ?? ''}`} />
}

export function Analysis() {
  const { user } = useAuth()
  const positionsQuery = usePositions()
  const query = useLensAnalysis()
  const history = usePortfolioHistory('6mo')

  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyEntries, setHistoryEntries] = useState(() => loadHistory(user?.id))

  // Reload the persisted list when the account changes (per-user key).
  useEffect(() => {
    setHistoryEntries(loadHistory(user?.id))
  }, [user?.id])

  // Record each new reading (caution score + brief) as it comes in, de-duped
  // against the most recent snapshot inside recordHistory.
  const brief = query.data?.brief
  const cautionScore = query.data?.caution_score
  useEffect(() => {
    if (brief == null || cautionScore == null) return
    setHistoryEntries(recordHistory(user?.id, { caution_score: cautionScore, brief }))
  }, [user?.id, brief, cautionScore])

  const header = (
    <PageHeader
      title="Analysis"
      breadcrumb="Lens / Analysis"
      right={
        <Button variant="outline" size="sm" onClick={() => setHistoryOpen(true)}>
          History
        </Button>
      }
    />
  )

  const historyModal = historyOpen && (
    <HistoryModal
      entries={historyEntries}
      onClose={() => setHistoryOpen(false)}
      onClear={() => setHistoryEntries(clearHistory(user?.id))}
    />
  )

  // Wait for positions before redirecting, so a refresh does not bounce the user.
  if (positionsQuery.isLoading) {
    return (
      <AppShell>
        {header}
        <PageLoader />
        {historyModal}
      </AppShell>
    )
  }

  if (positionsQuery.isSuccess && positionsQuery.data.length === 0) {
    return <Navigate to="/onboard" replace />
  }

  if (!isSubscribed(user)) {
    return (
      <AppShell>
        {header}
        <UpgradePrompt />
        {historyModal}
      </AppShell>
    )
  }

  const result = query.data

  return (
    <AppShell>
      {header}

      {query.isLoading && (
        <div className="space-y-8">
          <p className="text-center text-sm text-muted">Running analysis...</p>
          <Skeleton className="h-32" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      )}

      {query.isError && (
        <Panel>
          <p className="text-sm text-accent-red">
            {query.error instanceof Error ? query.error.message : 'Analysis failed.'}
          </p>
          <Button variant="outline" className="mt-4" onClick={() => query.refetch()}>
            Retry
          </Button>
        </Panel>
      )}

      {result && (
        <ProjectionLab
          result={result}
          historyEquity={(history.data ?? []).map((p) => p.equity)}
        />
      )}
      {historyModal}
    </AppShell>
  )
}

/** Which projections are applied to the Lens line: everything, or one CTA. */
type Selection = 'all' | number

/**
 * The chart is the page. Two lines on one pair of axes: the portfolio held as-is
 * and the portfolio with Lens projections applied. The left rail picks WHICH
 * projections are applied (all of them, or one at a time, so each CTA's own
 * contribution is visible); the strip under the chart picks HOW the future is
 * modelled (see lib/projections.ts). Brief and caution score ride above, as on
 * the dashboard.
 */
function ProjectionLab({
  result,
  historyEquity,
}: {
  result: LensResult
  historyEquity: number[]
}) {
  const [selection, setSelection] = useState<Selection>('all')
  const [method, setMethod] = useState<ProjectionMethod>('monte_carlo')

  const equity = totalEquity(result) || 1
  const ctas = useMemo(() => result.ctas ?? [], [result])

  // "All" applies every CTA that actually moves money (hold CTAs weigh nothing).
  const allIndices = useMemo(
    () => ctas.map((c, i) => (ctaWeight(c, equity) > 0 ? i : -1)).filter((i) => i >= 0),
    [ctas, equity],
  )

  // Every method, built once for the fully-applied selection. This is what fixes
  // the axes: the y domain is derived from ALL of them, so switching methods
  // rescales nothing and the portfolio-value line holds its vertical position.
  // Doubles as the cache for the `all` selection, so method switches are free.
  const allMethodSeries = useMemo(() => {
    const out = {} as Record<ProjectionMethod, ProjectionSeries>
    for (const m of PROJECTION_METHODS) {
      out[m.id] = buildProjection({ result, historyEquity, method: m.id, selection: allIndices })
    }
    return out
  }, [result, historyEquity, allIndices])

  const yDomain = useMemo(
    () => projectionYDomain(Object.values(allMethodSeries)),
    [allMethodSeries],
  )

  const projection = useMemo(
    () =>
      selection === 'all'
        ? allMethodSeries[method]
        : buildProjection({ result, historyEquity, method, selection: [selection] }),
    [allMethodSeries, result, historyEquity, method, selection],
  )

  const selectedLabel =
    selection === 'all'
      ? 'All projections applied'
      : `${ctaActionLabel(ctas[selection]?.action ?? 'hold')} ${ctas[selection]?.ticker ?? ''}`.trim()

  const improvement = projection.improvementDollars
  const positive = improvement >= 0

  return (
    <div className="space-y-6">
      {/* Brief + caution score, same pairing as the dashboard. */}
      <Panel className="flex flex-col items-center gap-8 lg:flex-row">
        <div className="min-w-0 flex-1">
          <BriefText result={result} className="text-xl leading-[1.6] text-primary" />
        </div>
        <div className="shrink-0 border-t border-subtle pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <CautionGauge score={result.caution_score} size="sm" caption="" />
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left rail: which projections are applied. */}
        <Panel className="lg:col-span-3">
          <h3 className="mb-4 text-xl font-semibold text-primary">Apply</h3>
          <ul className="space-y-2">
            <li>
              <SelectRow
                selected={selection === 'all'}
                onSelect={() => setSelection('all')}
                title="All projections"
                accent="var(--color-accent-blue)"
                amount={
                  allIndices.length > 0
                    ? `${allIndices.length} action${allIndices.length === 1 ? '' : 's'}`
                    : 'None'
                }
              />
            </li>
            {ctas.map((cta, i) => (
              <li key={i}>
                <SelectRow
                  selected={selection === i}
                  onSelect={() => setSelection(i)}
                  title={`${ctaActionLabel(cta.action)}${cta.ticker ? ` ${cta.ticker}` : ''}`}
                  accent={ctaAccent(cta.action)}
                  // A hold moves no money, so it has no projected effect to draw.
                  amount={cta.dollars > 0 ? formatCurrency(cta.dollars, 0) : 'No projected effect'}
                />
              </li>
            ))}
          </ul>
        </Panel>

        {/* The main event. */}
        <Panel className="lg:col-span-9">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
            <h3 className="text-xl font-semibold text-primary">{selectedLabel}</h3>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <span className="flex items-center gap-2 text-[13px] text-secondary">
                <span
                  className="h-0.5 w-6 rounded-full"
                  style={{ background: 'var(--color-secondary)' }}
                />
                Current
              </span>
              <span className="flex items-center gap-2 text-[13px] text-secondary">
                <span className="bg-gradient-brand h-0.5 w-6 rounded-full" />
                With Lens
              </span>
              <span
                className="text-[13px] font-semibold tabular-nums"
                style={{
                  color: positive ? 'var(--color-accent-green)' : 'var(--color-accent-red)',
                }}
              >
                {positive ? '+' : '-'}
                {formatCurrency(Math.abs(improvement), 0)}
              </span>
            </div>
          </div>

          <ProjectionCompareChart
            data={projection.rows}
            todayIndex={projection.todayIndex}
            height={440}
            showBands={projection.hasBands}
            yDomain={yDomain}
          />

          {/* How the future is modelled. */}
          <div className="mt-6 flex flex-wrap gap-1 border-t border-subtle pt-4">
            {PROJECTION_METHODS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMethod(m.id)}
                className={cn(
                  'rounded-md px-4 py-1.5 text-[13px] font-medium transition-colors duration-200 ease-out',
                  method === m.id
                    ? 'bg-card-hover text-primary'
                    : 'text-secondary hover:bg-card-hover hover:text-primary',
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <p className="text-xs italic leading-relaxed text-muted">{DISCLAIMER}</p>
    </div>
  )
}

function SelectRow({
  selected,
  onSelect,
  title,
  amount,
  accent,
}: {
  selected: boolean
  onSelect: () => void
  title: string
  amount: string
  accent: string
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full rounded-md border px-3 py-2.5 text-left transition-colors duration-200 ease-out',
        selected
          ? 'border-accent-teal bg-card-hover'
          : 'border-transparent bg-base hover:bg-card-hover',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent }} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary">{title}</span>
      </div>
      <p className="mt-0.5 pl-3.5 text-[13px] tabular-nums text-secondary">{amount}</p>
    </button>
  )
}
