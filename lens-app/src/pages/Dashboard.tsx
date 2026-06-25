import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isSubscribed } from '@/lib/subscription'
import { useLensAnalysis } from '@/hooks/useLensAnalysis'
import { getPositions, setPositions } from '@/lib/cookies'
import { type Position } from '@/api/lens'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { Panel, CardLabel } from '@/components/common/Panel'
import { BriefText } from '@/components/common/BriefText'
import { UpgradePrompt } from '@/components/common/UpgradePrompt'
import { AddPositionModal } from '@/components/common/AddPositionModal'
import { Button } from '@/components/ui/button'
import {
  PortfolioVectorWidget,
  PositionsWidget,
  TotalEquityWidget,
  SharpeWidget,
  DiversificationWidget,
  BetaWidget,
  DividendCalendarWidget,
} from '@/components/widgets/DashboardWidgets'

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-card ${className ?? ''}`} />
}

export function Dashboard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [modalOpen, setModalOpen] = useState(false)

  const hasPositions = getPositions().length > 0
  const query = useLensAnalysis()

  if (!hasPositions) return <Navigate to="/onboard" replace />

  function addPosition(p: Position) {
    const next = getPositions().filter((x) => x.ticker !== p.ticker)
    setPositions([...next, p])
    setModalOpen(false)
    queryClient.invalidateQueries({ queryKey: ['lens-analysis'] })
  }

  const header = (
    <PageHeader
      title="Dashboard"
      breadcrumb="Lens / Dashboard"
      right={<span className="text-xs text-muted">Last updated: just now</span>}
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
          <Skeleton className="h-40" />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Skeleton className="h-72" />
            <Skeleton className="h-72" />
            <Skeleton className="h-56" />
            <Skeleton className="h-56" />
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
        <div className="space-y-6">
          {/* Lens Brief */}
          <Panel className="flex gap-5 p-6">
            <div className="flex flex-col gap-2 border-l-2 border-accent-teal pl-4">
              {[
                { icon: Plus, action: () => setModalOpen(true) },
                { icon: Pencil, action: () => navigate('/settings') },
                { icon: Trash2, action: () => navigate('/settings') },
              ].map(({ icon: Icon, action }, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={action}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-teal/20 text-accent-teal transition-colors hover:bg-accent-teal/30"
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
            <div className="flex-1">
              <CardLabel>Lens Brief</CardLabel>
              <div className="mt-3">
                <BriefText result={result} />
              </div>
              <div className="mt-5 flex justify-end">
                <Button variant="teal" onClick={() => navigate('/analysis')}>
                  Analysis <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </Panel>

          {/* Widget grid */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <PortfolioVectorWidget result={result} />
            <PositionsWidget result={result} />
            <TotalEquityWidget result={result} />
            <SharpeWidget result={result} />
            <DiversificationWidget result={result} />
            <BetaWidget result={result} />
            <div className="lg:col-span-2">
              <DividendCalendarWidget result={result} />
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <AddPositionModal onClose={() => setModalOpen(false)} onAdd={addPosition} />
      )}
    </AppShell>
  )
}
