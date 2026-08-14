import { useCallback, useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  settingsApi,
  mergeUserSettings,
  type UserSettings,
} from '@/api/settings'

/**
 * Read + write the per-user settings blob (Postgres users.settings, exposed on
 * AuthContext.user.settings via /me). `settings` is always the fully-merged view
 * (defaults folded over whatever the server has stored). `update(partial)` PUTs the
 * partial to /settings, then refreshes the auth user so every consumer re-reads the
 * new value.
 *
 * There is no `affectsAnalysis` option any more. The four analyze tuning blocks
 * (direction_thresholds / volatility / lens_signals / monte_carlo) are part of the
 * snapshot AnalysisCommitContext diffs, so changing one now shows up as a pending
 * change in the PageHeader bar and re-runs /analyze on commit. Invalidating
 * ['lens-analysis'] here would instead refetch the OLD committed snapshot - paying
 * the full analyze cost to recompute a result the user did not ask for and that
 * would not reflect the new tuning anyway.
 *
 * Note: the dashboard layout is also part of this blob but is persisted through the
 * lower-latency useLayoutStore (no refreshUser per drag) - do not route layout
 * writes through here.
 */
export function useUserSettings() {
  const { user, refreshUser } = useAuth()

  const settings = useMemo(() => mergeUserSettings(user?.settings), [user?.settings])

  const update = useCallback(
    async (patch: Partial<UserSettings>) => {
      await settingsApi.updateSettings(patch)
      await refreshUser()
    },
    [refreshUser],
  )

  return { settings, update }
}
