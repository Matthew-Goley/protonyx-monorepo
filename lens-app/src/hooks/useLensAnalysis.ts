import { useQuery } from '@tanstack/react-query'
import { lensApi, type LensResult } from '@/api/lens'
import { usePositions } from '@/hooks/usePositions'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Runs POST /analyze against the user's server-stored positions (usePositions) and
 * the server-stored risk tier (AuthContext.user.risk_tier, from Postgres via /me).
 * Dashboard, Analysis, and Profile share a single cached result (same query key) so
 * the portfolio is only sent to the Railway engine once per (positions, risk_tier)
 * state. The query key includes the positions array (react-query hashes keys by
 * value), so it refetches whenever the holdings or tier change; enabled only once
 * positions have loaded and are non-empty. Falls back to 'regular' if the tier is
 * unset (a user with positions but no tier should not happen, but the engine needs
 * a value).
 */
export function useLensAnalysis() {
  const { data: positions } = usePositions()
  const { user } = useAuth()
  const riskTier = user?.risk_tier ?? 'regular'
  const list = positions ?? []

  return useQuery<LensResult>({
    queryKey: ['lens-analysis', list, riskTier],
    queryFn: () =>
      lensApi.analyze({
        positions: list,
        settings: { risk_tier: riskTier },
      }),
    enabled: list.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
