import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { isSubscribed } from '@/lib/subscription'
import { useLensAnalysis } from '@/hooks/useLensAnalysis'
import { usePositions } from '@/hooks/usePositions'
import { usePortfolioHistory } from '@/hooks/usePortfolioHistory'
import { type Position } from '@/api/lens'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Panel, CardLabel } from '@/components/common/Panel'
import { BriefText } from '@/components/common/BriefText'
import { PageLoader } from '@/components/common/PageLoader'
import { UpgradePrompt } from '@/components/common/UpgradePrompt'
import { SectorPie } from '@/components/common/SectorPie'
import { Button } from '@/components/ui/button'
import { CautionGauge } from '@/components/analysis/CautionGauge'
import { CtaList } from '@/components/analysis/CtaList'
import { MonteCarloChart } from '@/components/analysis/MonteCarloChart'
import { buildMonteCarlo, sectorWeightsFromPositions, formatCurrency } from '@/lib/lensData'

const DISCLAIMER =
  'Lens is an analytics tool, not a financial advisor. Everything here, readings, ' +
  'caution scores and projections, is informational only and not investment advice. ' +
  'Do your own research before making any investment decision.'

// No pulse animation (styling.md §Motion) — a static dim surface block.
function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded-lg bg-card opacity-60 ${className ?? ''}`} />
}

export function Analysis() {
  const { user } = useAuth()
  const positionsQuery = usePositions()
  const query = useLensAnalysis()
  const history = usePortfolioHistory('6mo')

  const header = (
    <PageHeader
      title="Analysis"
      breadcrumb="Lens / Analysis"
      right={
        <Button variant="outline" size="sm">
          History
        </Button>
      }
    />
  )

  // Wait for positions before redirecting, so a refresh does not bounce the user.
  if (positionsQuery.isLoading) {
    return (
      <AppShell>
        {header}
        <PageLoader />
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

      {result &&
        (() => {
          const mc = buildMonteCarlo(result, (history.data ?? []).map((p) => p.equity))
          const currentAlloc = sectorWeightsFromPositions(positionsQuery.data ?? [])
          const projectedAlloc = sectorWeightsFromPositions(
            (result.projected_positions as Position[]) ?? [],
          )
          const reportText =
            (result.full_report as string[] | undefined)?.join(' ') ??
            'Acting on the projections above reshapes the portfolio toward the target allocation.'

          return (
            <div className="space-y-8">
              {/* Lens Brief */}
              <Panel>
                <CardLabel>Lens Brief</CardLabel>
                <div className="mt-3">
                  <BriefText result={result} />
                </div>
                <p className="mt-4 text-xs italic leading-relaxed text-muted">{DISCLAIMER}</p>
              </Panel>

              {/* Caution Score commands the page: 5 of 12 columns, CTAs take 7
                  (styling.md §Layout). */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                <Panel className="lg:col-span-5">
                  <h3 className="mb-4 text-xl font-semibold text-primary">Caution Score</h3>
                  <CautionGauge score={result.caution_score} caption="" />
                </Panel>
                <Panel className="lg:col-span-7">
                  <h3 className="mb-4 text-xl font-semibold text-primary">All Projections</h3>
                  <CtaList result={result} />
                </Panel>
              </div>

              {/* Monte Carlo */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel>
                  <h3 className="mb-4 text-xl font-semibold text-primary">Current Portfolio</h3>
                  <MonteCarloChart points={mc.current} />
                </Panel>
                <Panel>
                  <h3 className="mb-4 text-xl font-semibold text-primary">
                    With All Lens Projections{' '}
                    <span className="text-accent-teal">
                      +{formatCurrency(mc.improvementDollars, 0)}
                    </span>
                  </h3>
                  <MonteCarloChart points={mc.projected} />
                </Panel>
              </div>

              {/* Projection explanation */}
              <Panel>
                <CardLabel>What the Lens Projection shows</CardLabel>
                <p className="mt-3 text-base leading-[1.7] text-primary">{reportText}</p>
                <p className="mt-4 text-xs italic text-muted">
                  Projection bands are a deterministic estimate derived from the portfolio
                  drift and volatility, not a guarantee of future returns.
                </p>
              </Panel>

              {/* Allocation comparison */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel>
                  <h3 className="mb-4 text-xl font-semibold text-primary">Current Allocation</h3>
                  <SectorPie slices={currentAlloc} />
                </Panel>
                <Panel>
                  <h3 className="mb-4 text-xl font-semibold text-primary">Projected Allocation</h3>
                  <SectorPie slices={projectedAlloc} />
                </Panel>
              </div>
            </div>
          )
        })()}
    </AppShell>
  )
}
