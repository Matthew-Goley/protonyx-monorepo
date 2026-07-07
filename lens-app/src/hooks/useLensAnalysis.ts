import { useQuery } from '@tanstack/react-query'
import { lensApi, type LensResult, type LensSettings } from '@/api/lens'
import { usePositions } from '@/hooks/usePositions'
import { useAuth } from '@/contexts/AuthContext'
import { useUserSettings } from '@/hooks/useUserSettings'

/**
 * Runs POST /analyze against the user's server-stored positions (usePositions), the
 * server-stored risk tier (AuthContext.user.risk_tier), and the server-stored analyze
 * tuning blocks (users.settings: direction_thresholds / volatility / lens_signals /
 * monte_carlo, via useUserSettings). Dashboard, Analysis, and Profile share a single
 * cached result (same query key) so the portfolio is only sent to the Railway engine
 * once per (positions, settings) state. The query key includes the positions array
 * AND the analyze settings (react-query hashes keys by value), so it refetches
 * whenever holdings, tier, or any tuning block change; enabled only once positions
 * have loaded and are non-empty. Falls back to 'regular' if the tier is unset (a user
 * with positions but no tier should not happen, but the engine needs a value). Each
 * tuning block is sent WHOLE - the API merges settings shallowly at the top level.
 */
export function useLensAnalysis() {
  const { data: positions } = usePositions()
  const { user } = useAuth()
  const { settings } = useUserSettings()
  const riskTier = user?.risk_tier ?? 'regular'
  const list = positions ?? []

  const analyzeSettings: LensSettings = {
    risk_tier: riskTier,
    direction_thresholds: settings.direction_thresholds,
    volatility: settings.volatility,
    lens_signals: settings.lens_signals,
    monte_carlo: settings.monte_carlo,
  }

  return useQuery<LensResult>({
    queryKey: ['lens-analysis', list, analyzeSettings],
    queryFn: () =>
      lensApi.analyze({
        positions: list,
        settings: analyzeSettings,
      }),
    enabled: list.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
