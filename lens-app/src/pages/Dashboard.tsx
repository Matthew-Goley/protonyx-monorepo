import { useEffect, useRef } from 'react'
import { Navigate } from 'react-router-dom'
import { Plus, Pencil } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { isSubscribed } from '@/lib/subscription'
import { useLensAnalysis } from '@/hooks/useLensAnalysis'
import { usePositionsManager } from '@/hooks/usePositionsManager'
import { getPositions } from '@/lib/cookies'
import { AppShell } from '@/components/layout/AppShell'
import { PageHeader } from '@/components/layout/PageHeader'
import { WidgetGrid } from '@/components/dashboard/WidgetGrid'
import { AddWidgetMenu } from '@/components/dashboard/AddWidgetMenu'
import { Panel } from '@/components/common/Panel'
import { UpgradePrompt } from '@/components/common/UpgradePrompt'
import { Button } from '@/components/ui/button'
import { DashboardEditProvider, useDashboardEdit } from '@/contexts/DashboardEditContext'
import { PositionsManagerProvider } from '@/contexts/PositionsManagerContext'

// No pulse animation (styling.md §Motion) — a static dim surface block.
function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded-lg bg-card opacity-60 ${className ?? ''}`} />
}

/*
  Widget-management header controls (Plus / Pencil). Pencil toggles edit mode
  (accent when on); Plus opens the Add Widget menu (enabling edit mode first if
  needed). Deleting a widget is done inline via the X on each card in edit mode,
  so there is no separate delete/reset button here. All the actual layout work
  lives in WidgetGrid and is reached through the DashboardEdit context's gridActions.
*/
function WidgetHeaderControls() {
  const { editMode, toggleEditMode, addMenuOpen, openAddMenu, closeAddMenu, gridActions } =
    useDashboardEdit()
  const containerRef = useRef<HTMLDivElement>(null)

  // Dismiss the add menu on an outside click.
  useEffect(() => {
    if (!addMenuOpen) return
    function onDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeAddMenu()
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [addMenuOpen, closeAddMenu])

  const available = gridActions?.availableWidgets ?? []

  return (
    <div ref={containerRef} className="flex items-center gap-2">
      {/* Add widget */}
      <div className="relative">
        <Button
          variant={addMenuOpen ? 'teal' : 'outline'}
          size="icon"
          className="h-8 w-8"
          title="Add widget"
          aria-label="Add widget"
          onClick={() => {
            if (addMenuOpen) closeAddMenu()
            else openAddMenu()
          }}
        >
          <Plus size={16} />
        </Button>
        {addMenuOpen && (
          <AddWidgetMenu
            available={available}
            onAdd={(id) => {
              gridActions?.addWidget(id)
              // Close once the last available widget has been added.
              if (available.length <= 1) closeAddMenu()
            }}
          />
        )}
      </div>

      {/* Toggle edit mode */}
      <Button
        variant={editMode ? 'teal' : 'outline'}
        size="icon"
        className="h-8 w-8"
        title={editMode ? 'Done editing' : 'Edit layout'}
        aria-label="Edit layout"
        aria-pressed={editMode}
        onClick={toggleEditMode}
      >
        <Pencil size={16} />
      </Button>
    </div>
  )
}

function DashboardBody() {
  const { user } = useAuth()
  const manager = usePositionsManager()
  const query = useLensAnalysis()

  const header = (
    <PageHeader title="Dashboard" breadcrumb="Lens / Dashboard" right={<WidgetHeaderControls />} />
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
    // Position Actions and the Lens Brief are now grid widgets; the manager the
    // Position Actions widget consumes is created here (so mutations re-render the
    // page and useLensAnalysis refetches) and passed down via context.
    <PositionsManagerProvider value={manager}>
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

        {/* Data-driven widget grid with opt-in edit mode (drag / add / delete). */}
        {result && <WidgetGrid result={result} />}
      </AppShell>
    </PositionsManagerProvider>
  )
}

export function Dashboard() {
  const hasPositions = getPositions().length > 0
  if (!hasPositions) return <Navigate to="/onboard" replace />

  return (
    <DashboardEditProvider>
      <DashboardBody />
    </DashboardEditProvider>
  )
}
