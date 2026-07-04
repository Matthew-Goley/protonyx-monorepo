import { createContext, useContext, type ReactNode } from 'react'
import { type PositionsManager } from '@/hooks/usePositionsManager'

/*
  Exposes the single PositionsManager (add / edit / delete holdings) to the
  Position Actions dashboard widget. The manager is created in DashboardBody (via
  usePositionsManager) - NOT in the widget - so a mutation re-renders the page and
  useLensAnalysis re-reads the positions cookie and refetches (its query key is
  keyed off the positions array). The widget only consumes it through this context.
*/

const PositionsManagerContext = createContext<PositionsManager | null>(null)

export function PositionsManagerProvider({
  value,
  children,
}: {
  value: PositionsManager
  children: ReactNode
}) {
  return <PositionsManagerContext.Provider value={value}>{children}</PositionsManagerContext.Provider>
}

export function usePositionsManagerContext(): PositionsManager {
  const ctx = useContext(PositionsManagerContext)
  if (!ctx) throw new Error('usePositionsManagerContext must be used within a PositionsManagerProvider')
  return ctx
}
