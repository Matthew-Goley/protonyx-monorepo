import { useCallback, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
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
 * new value. Pass `{ affectsAnalysis: true }` for the analyze tuning blocks
 * (direction_thresholds / volatility / lens_signals / monte_carlo) so the shared
 * ['lens-analysis'] query refetches with the new tuning.
 *
 * Note: the dashboard layout is also part of this blob but is persisted through the
 * lower-latency useLayoutStore (no refreshUser per drag) - do not route layout
 * writes through here.
 */
export function useUserSettings() {
  const { user, refreshUser } = useAuth()
  const qc = useQueryClient()

  const settings = useMemo(() => mergeUserSettings(user?.settings), [user?.settings])

  const update = useCallback(
    async (patch: Partial<UserSettings>, opts?: { affectsAnalysis?: boolean }) => {
      await settingsApi.updateSettings(patch)
      await refreshUser()
      if (opts?.affectsAnalysis) {
        qc.invalidateQueries({ queryKey: ['lens-analysis'] })
      }
    },
    [refreshUser, qc],
  )

  return { settings, update }
}
