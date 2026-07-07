import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { usePositions } from '@/hooks/usePositions'
import { positionsApi } from '@/api/positions'
import { readLegacyPositions, clearLegacyPositions } from '@/lib/cookies'

/*
  One-time migration of a legacy `lens_positions` cookie into the server. Positions
  used to live in that cookie; existing beta users may still carry one. On the first
  authenticated load where the server returns NO positions but the cookie DOES have
  data, we bulk-replace the server set from the cookie, then delete the cookie.

  Guarded to run at most once (a ref) and only AFTER the ['positions'] query has
  successfully resolved empty - never during loading, so it can't clobber real
  server data with a stale cookie. On failure the ref is released so a later load
  can retry. Renders nothing; mounted once high in the tree (App).
*/
export function PositionsMigrationGate() {
  const { isAuthenticated } = useAuth()
  const qc = useQueryClient()
  const { data, isSuccess } = usePositions()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current || !isAuthenticated || !isSuccess) return
    // Server already has positions: nothing to migrate, and we must not overwrite.
    if ((data?.length ?? 0) > 0) {
      ran.current = true
      return
    }
    const legacy = readLegacyPositions()
    if (legacy.length === 0) {
      ran.current = true
      return
    }
    ran.current = true
    positionsApi
      .replacePositions(legacy)
      .then(() => {
        clearLegacyPositions()
        qc.invalidateQueries({ queryKey: ['positions'] })
        qc.invalidateQueries({ queryKey: ['lens-analysis'] })
      })
      .catch(() => {
        // Allow a retry on the next load if the write failed.
        ran.current = false
      })
  }, [isAuthenticated, isSuccess, data, qc])

  return null
}
