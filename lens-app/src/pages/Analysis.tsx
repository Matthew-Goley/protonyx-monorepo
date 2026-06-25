import { Navigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { isSubscribed } from '@/lib/subscription'
import { useLensAnalysis } from '@/hooks/useLensAnalysis'
import { getPositions } from '@/lib/cookies'
import { type Position } from '@/api/lens'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Panel, CardLabel } from '@/components/common/Panel'
import { BriefText } from '@/components/common/BriefText'
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

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-card ${className ?? ''}`} />
}

export function Analysis() {
  const { user } = useAuth()
  const hasPositions = getPositions().length > 0
  const query = useLensAnalysis()

  if (!hasPositions) return <Navigate to="/onboard" replace />

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
        <div className="space-y-6">
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
          const mc = buildMonteCarlo(result)
          const currentAlloc = sectorWeightsFromPositions(getPositions())
          const projectedAlloc = sectorWeightsFromPositions(
            (result.projected_positions as Position[]) ?? [],
          )
          const reportText =
            (result.full_report as string[] | undefined)?.join(' ') ??
            'Acting on the projections above reshapes the portfolio toward the target allocation.'

          return (
            <div className="space-y-6">
              {/* Lens Brief */}
              <Panel className="p-6">
                <CardLabel>Lens Brief</CardLabel>
                <div className="mt-3">
                  <BriefText result={result} />
                </div>
                <p className="mt-4 text-xs italic leading-relaxed text-muted">{DISCLAIMER}</p>
              </Panel>

              {/* Caution + CTAs */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel>
                  <h3 className="mb-4 font-semibold text-primary">Caution Score</h3>
                  <CautionGauge score={result.caution_score} />
                </Panel>
                <Panel>
                  <h3 className="mb-4 font-semibold text-primary">All Projections</h3>
                  <CtaList result={result} />
                </Panel>
              </div>

              {/* Monte Carlo */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel>
                  <h3 className="mb-4 font-semibold text-primary">Current Portfolio</h3>
                  <MonteCarloChart points={mc.current} medianColor="#2dd4bf" />
                </Panel>
                <Panel>
                  <h3 className="mb-4 font-semibold text-primary">
                    With All Lens Projections{' '}
                    <span className="text-accent-teal">
                      +{formatCurrency(mc.improvementDollars, 0)}
                    </span>
                  </h3>
                  <MonteCarloChart points={mc.projected} medianColor="#3b82f6" />
                </Panel>
              </div>

              {/* Projection explanation */}
              <Panel className="p-6">
                <CardLabel>What the Lens Projection shows</CardLabel>
                <p className="mt-3 text-lg leading-[1.7] text-primary">{reportText}</p>
                <p className="mt-4 text-xs italic text-muted">
                  Projection bands are a deterministic estimate derived from the portfolio
                  drift and volatility, not a guarantee of future returns.
                </p>
              </Panel>

              {/* Allocation comparison */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Panel>
                  <h3 className="mb-4 font-semibold text-primary">Current Allocation</h3>
                  <SectorPie slices={currentAlloc} />
                </Panel>
                <Panel>
                  <h3 className="mb-4 font-semibold text-primary">Projected Allocation</h3>
                  <SectorPie slices={projectedAlloc} />
                </Panel>
              </div>
            </div>
          )
        })()}
    </AppShell>
  )
}
