import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { getPositions, setPositions } from '@/lib/cookies'
import { type Position } from '@/api/lens'

export interface PositionsManager {
  positions: Position[]
  addPosition: (p: Position) => void
  removePosition: (ticker: string) => void
  updateShares: (ticker: string, shares: number) => void
}

/**
 * Add / edit / delete the portfolio held in the `lens_positions` cookie, with the
 * same persistence + cache-invalidation pattern Settings uses. Hold the state in
 * the hook (not just the cookie) and call this in the page so a mutation re-renders
 * the page — that re-render lets `useLensAnalysis` re-read the cookie and refetch
 * (its query key is keyed off the positions array). Mutators read `getPositions()`
 * fresh to avoid a stale closure.
 */
export function usePositionsManager(): PositionsManager {
  const qc = useQueryClient()
  const [positions, setState] = useState<Position[]>(getPositions())

  const persist = useCallback(
    (next: Position[]) => {
      setState(next)
      setPositions(next)
      qc.invalidateQueries({ queryKey: ['lens-analysis'] })
    },
    [qc],
  )

  const addPosition = useCallback(
    (p: Position) => persist([...getPositions().filter((x) => x.ticker !== p.ticker), p]),
    [persist],
  )

  const removePosition = useCallback(
    (ticker: string) => persist(getPositions().filter((p) => p.ticker !== ticker)),
    [persist],
  )

  const updateShares = useCallback(
    (ticker: string, shares: number) =>
      persist(
        getPositions().map((p) =>
          p.ticker === ticker ? { ...p, shares, equity: p.price * shares } : p,
        ),
      ),
    [persist],
  )

  return { positions, addPosition, removePosition, updateShares }
}
