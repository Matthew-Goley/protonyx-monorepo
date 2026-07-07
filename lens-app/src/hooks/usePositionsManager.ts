import { useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { positionsApi } from '@/api/positions'
import { usePositions } from '@/hooks/usePositions'
import { type Position } from '@/api/lens'

export interface PositionsManager {
  positions: Position[]
  addPosition: (p: Position) => Promise<void>
  removePosition: (ticker: string) => Promise<void>
  updateShares: (ticker: string, shares: number) => Promise<void>
}

/**
 * Add / edit / delete the portfolio, persisted to Postgres via the Fastify
 * /positions endpoints. Reads the current holdings from the shared ['positions']
 * query (usePositions), and after every mutation invalidates BOTH ['positions']
 * (so this list refetches) and ['lens-analysis'] (whose query key is the positions
 * array, so it must re-run /analyze). Keeps the same external interface the
 * PositionsManagerContext consumers expect.
 */
export function usePositionsManager(): PositionsManager {
  const qc = useQueryClient()
  const { data: positions = [] } = usePositions()

  const invalidate = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['positions'] })
    qc.invalidateQueries({ queryKey: ['lens-analysis'] })
  }, [qc])

  const addPosition = useCallback(
    async (p: Position) => {
      await positionsApi.addPosition(p)
      invalidate()
    },
    [invalidate],
  )

  const removePosition = useCallback(
    async (ticker: string) => {
      await positionsApi.deletePosition(ticker)
      invalidate()
    },
    [invalidate],
  )

  const updateShares = useCallback(
    async (ticker: string, shares: number) => {
      await positionsApi.updatePosition(ticker, shares)
      invalidate()
    },
    [invalidate],
  )

  return { positions, addPosition, removePosition, updateShares }
}
