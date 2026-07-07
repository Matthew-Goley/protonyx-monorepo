import { useQuery } from '@tanstack/react-query'
import { lensApi, type LensResult } from '@/api/lens'
import { usePositions } from '@/hooks/usePositions'
import { getSettings } from '@/lib/cookies'

/**
 * Runs POST /analyze against the user's server-stored positions (usePositions) and
 * the risk tier (still a cookie). Dashboard, Analysis, and Profile share a single
 * cached result (same query key) so the portfolio is only sent to the Railway
 * engine once per (positions, risk_tier) state. The query key includes the
 * positions array (react-query hashes keys by value), so it refetches whenever the
 * holdings change; enabled only once positions have loaded and are non-empty.
 */
export function useLensAnalysis() {
  const { data: positions } = usePositions()
  const settings = getSettings()
  const list = positions ?? []

  return useQuery<LensResult>({
    queryKey: ['lens-analysis', list, settings.risk_tier],
    queryFn: () =>
      lensApi.analyze({
        positions: list,
        settings: { risk_tier: settings.risk_tier },
      }),
    enabled: list.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
