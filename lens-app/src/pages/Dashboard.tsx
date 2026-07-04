import { useNavigate, Navigate } from 'react-router-dom'
import { ChevronRight, Plus, Trash2, Pencil } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isSubscribed } from '@/lib/subscription'
import { useLensAnalysis } from '@/hooks/useLensAnalysis'
import { usePositionsManager } from '@/hooks/usePositionsManager'
import { getPositions } from '@/lib/cookies'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { PositionActions } from '@/components/dashboard/PositionActions'
import { WidgetGrid } from '@/components/dashboard/WidgetGrid'
import { Panel, CardLabel } from '@/components/common/Panel'
import { BriefText } from '@/components/common/BriefText'
import { UpgradePrompt } from '@/components/common/UpgradePrompt'
import { Button } from '@/components/ui/button'

// No pulse animation (styling.md §Motion) — a static dim surface block.
function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded-lg bg-card opacity-60 ${className ?? ''}`} />
}

// Single source of truth for the Lens Brief height (px). The action box squares
// itself to this exact value (width = height = BRIEF_HEIGHT). Tweak freely.
const BRIEF_HEIGHT = 320

export function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const manager = usePositionsManager()
  const hasPositions = getPositions().length > 0
  const query = useLensAnalysis()

  if (!hasPositions) return <Navigate to="/onboard" replace />

  // Widget-management actions (no behavior yet — placeholders).
  const headerActions = (
    <>
      <Button variant="outline" size="icon" className="h-8 w-8" title="Add widget" aria-label="Add widget">
        <Plus size={16} />
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" title="Remove widget" aria-label="Remove widget">
        <Trash2 size={16} />
      </Button>
      <Button variant="outline" size="icon" className="h-8 w-8" title="Edit layout" aria-label="Edit layout">
        <Pencil size={16} />
      </Button>
    </>
  )

  const header = (
    <PageHeader title="Dashboard" breadcrumb="Lens / Dashboard" right={headerActions} />
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
        <div className="space-y-8">
          <Skeleton className="h-40" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
        <div className="space-y-8">
          {/* Action box (add / manage holdings) + Lens Brief */}
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
            <PositionActions {...manager} size={BRIEF_HEIGHT} />
            {/* Fixed height from BRIEF_HEIGHT (the action box squares itself to
                the same value). Text overflows visibly rather than being clipped. */}
            <Panel
              style={{ height: BRIEF_HEIGHT }}
              className="flex min-w-0 flex-1 flex-col overflow-visible"
            >
              <CardLabel>Lens Brief</CardLabel>
              <div className="mt-3">
                <BriefText result={result} />
              </div>
              <div className="mt-auto flex justify-end pt-5">
                <Button variant="teal" onClick={() => navigate('/analysis')}>
                  Analysis <ChevronRight size={16} />
                </Button>
              </div>
            </Panel>
          </div>

          {/* Data-driven widget grid (registry + layout cookie). Static
              placement for now; drag/edit mode is a later phase. */}
          <WidgetGrid result={result} />
        </div>
      )}
    </AppShell>
  )
}
