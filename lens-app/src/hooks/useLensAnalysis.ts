import { useQuery } from '@tanstack/react-query'
import { lensApi, type LensResult } from '@/api/lens'
import { getPositions, getSettings } from '@/lib/cookies'

/**
 * Runs POST /analyze against the positions + risk tier stored in cookies.
 * Dashboard and Analysis share a single cached result (same query key) so the
 * portfolio is only sent to the Railway engine once per session/state.
 */
export function useLensAnalysis() {
  const positions = getPositions()
  const settings = getSettings()

  return useQuery<LensResult>({
    queryKey: ['lens-analysis', positions, settings.risk_tier],
    queryFn: () =>
      lensApi.analyze({
        positions,
        settings: { risk_tier: settings.risk_tier },
      }),
    enabled: positions.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
