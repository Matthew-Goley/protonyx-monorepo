import { useQuery } from '@tanstack/react-query'
import { positionsApi } from '@/api/positions'
import { useAuth } from '@/contexts/AuthContext'
import { type Position } from '@/api/lens'

/**
 * The single source of truth for the user's portfolio, read from the Fastify
 * /positions endpoint (Postgres-backed, per user). Replaces the old lens_positions
 * cookie. Keyed ['positions']; every position mutation invalidates this key (and
 * ['lens-analysis'], which is keyed off the positions array). Enabled only when
 * authenticated. This query is deliberately NOT persisted to localStorage (see
 * App.tsx shouldDehydrateQuery) so raw holdings are not written to disk at rest.
 */
export function usePositions() {
  const { isAuthenticated } = useAuth()

  return useQuery<Position[]>({
    queryKey: ['positions'],
    queryFn: positionsApi.getPositions,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
