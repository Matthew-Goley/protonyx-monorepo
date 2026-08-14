import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { type LensSettings, type Position } from '@/api/lens'
import { positionsApi } from '@/api/positions'
import { settingsApi } from '@/api/settings'
import { useAuth } from '@/contexts/AuthContext'
import { usePositions } from '@/hooks/usePositions'
import { useUserSettings } from '@/hooks/useUserSettings'

/*
  Deferred analysis: the user edits holdings / risk tier / tuning freely, and the
  expensive POST /analyze only runs when they explicitly ask for it.

  WHY A COMMITTED SNAPSHOT AND NOT JUST "SKIP THE INVALIDATION":
  useLensAnalysis is keyed ['lens-analysis', positions, settings] and react-query
  hashes keys BY VALUE, so any edit produced a brand-new key and refetched on its
  own - no invalidateQueries call needed. Dropping the invalidations alone would
  therefore have changed nothing. The only way to hold the call back is to key the
  query off a snapshot that advances only on commit(), which is what this context
  owns. Every mutation still persists to Postgres immediately; what is deferred is
  purely the analyze round trip.

  Edits stay live in usePositions / AuthContext, so the holdings list, Settings,
  and the positions widgets all reflect changes instantly. Only the analysis
  surfaces (brief, caution score, CTAs, projections) stay pinned to the last
  committed state until the user runs it.
*/

export interface AnalysisInput {
  positions: Position[]
  settings: LensSettings
}

interface AnalysisCommitValue {
  /** The snapshot useLensAnalysis runs against. null until positions first load. */
  committed: AnalysisInput | null
  /** How many discrete edits separate the live state from `committed`. 0 = in sync. */
  changeCount: number
  /** Adopt the live state as the new snapshot. This is what triggers /analyze. */
  commit: () => void
  /** Undo every pending edit by restoring `committed` to the server. */
  revert: () => Promise<void>
  reverting: boolean
  revertError: string | null
}

const AnalysisCommitContext = createContext<AnalysisCommitValue | null>(null)

// The analyze settings blocks, compared one by one so the count reflects how many
// distinct things the user touched rather than a single "settings changed" bit.
const SETTINGS_KEYS = [
  'risk_tier',
  'direction_thresholds',
  'volatility',
  'lens_signals',
  'monte_carlo',
] as const

/**
 * Counts discrete edits between two snapshots: each added, removed, or altered
 * holding is one, and each differing settings block is one.
 *
 * Positions are matched by ticker and compared on `shares` and `price` only.
 * Those are the two fields a user action can change (PATCH edits shares and
 * recomputes equity; the POST upsert refreshes price). `equity` is derived from
 * them, and `added_at` is server-assigned, so comparing either would report
 * phantom changes.
 */
function countChanges(committed: AnalysisInput, live: AnalysisInput): number {
  let n = 0

  const before = new Map(committed.positions.map((p) => [p.ticker, p]))
  const after = new Map(live.positions.map((p) => [p.ticker, p]))

  for (const [ticker, livePos] of after) {
    const prev = before.get(ticker)
    if (!prev) n++ // added
    else if (prev.shares !== livePos.shares || prev.price !== livePos.price) n++ // edited
  }
  for (const ticker of before.keys()) {
    if (!after.has(ticker)) n++ // removed
  }

  for (const key of SETTINGS_KEYS) {
    if (JSON.stringify(committed.settings[key]) !== JSON.stringify(live.settings[key])) n++
  }

  return n
}

export function AnalysisCommitProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const { user, refreshUser } = useAuth()
  const { data: positions } = usePositions()
  const { settings } = useUserSettings()

  const [committed, setCommitted] = useState<AnalysisInput | null>(null)
  const [commitRequested, setCommitRequested] = useState(false)
  const [reverting, setReverting] = useState(false)
  const [revertError, setRevertError] = useState<string | null>(null)

  // The current, un-committed state of everything POST /analyze consumes. null
  // while the positions query is still loading, which is what keeps the initial
  // auto-commit below from snapshotting an empty portfolio.
  const live = useMemo<AnalysisInput | null>(() => {
    if (!positions) return null
    return {
      positions,
      settings: {
        risk_tier: user?.risk_tier ?? 'regular',
        direction_thresholds: settings.direction_thresholds,
        volatility: settings.volatility,
        lens_signals: settings.lens_signals,
        monte_carlo: settings.monte_carlo,
      },
    }
  }, [positions, user?.risk_tier, settings])

  // Reset on account switch so one account's snapshot can never seed another's.
  // AuthContext already clears the query cache on login/logout; this is the same
  // guarantee for the snapshot, which lives outside react-query.
  const userId = user?.id ?? null
  const lastUserId = useRef(userId)
  useEffect(() => {
    if (lastUserId.current !== userId) {
      lastUserId.current = userId
      setCommitted(null)
      setRevertError(null)
    }
  }, [userId])

  // First load: adopt whatever is on the server. Without this the app would open
  // with every existing holding counted as a pending change and no analysis.
  useEffect(() => {
    if (committed === null && live !== null) setCommitted(live)
  }, [committed, live])

  const changeCount = useMemo(() => {
    if (!committed || !live) return 0
    return countChanges(committed, live)
  }, [committed, live])

  /**
   * Commit is a REQUEST, resolved in an effect, rather than an immediate
   * `setCommitted(live)`. `live` is captured in the render closure, so a caller
   * that mutates server state and then commits in the same async handler (Onboard
   * "Launch Lens", Settings "Clear Data") would otherwise snapshot the state as it
   * was BEFORE its own writes. Deferring to an effect means the snapshot is taken
   * after React has re-rendered with the new positions/user, which is correct for
   * those callers and unchanged for the header bar (where live is already current).
   */
  const commit = useCallback(() => setCommitRequested(true), [])

  useEffect(() => {
    if (!commitRequested || !live) return
    setCommitted(live)
    setCommitRequested(false)
    setRevertError(null)
  }, [commitRequested, live])

  // Undo: write the committed snapshot back over the server state. Only the parts
  // that actually differ are written, so a holdings-only edit does not pointlessly
  // rewrite the settings blob (and vice versa).
  const revert = useCallback(async () => {
    if (!committed || !live) return
    setReverting(true)
    setRevertError(null)
    try {
      const positionsDiffer =
        JSON.stringify(committed.positions.map((p) => [p.ticker, p.shares, p.price])) !==
        JSON.stringify(live.positions.map((p) => [p.ticker, p.shares, p.price]))
      if (positionsDiffer) {
        // Bulk PUT is one server-side transaction, so holdings are restored
        // atomically rather than through a sequence of per-ticker calls.
        await positionsApi.replacePositions(committed.positions)
      }

      if (committed.settings.risk_tier !== live.settings.risk_tier) {
        await settingsApi.setRiskTier(committed.settings.risk_tier ?? null)
      }

      const tuningPatch: Record<string, unknown> = {}
      for (const key of ['direction_thresholds', 'volatility', 'lens_signals', 'monte_carlo'] as const) {
        if (JSON.stringify(committed.settings[key]) !== JSON.stringify(live.settings[key])) {
          tuningPatch[key] = committed.settings[key]
        }
      }
      if (Object.keys(tuningPatch).length > 0) {
        await settingsApi.updateSettings(tuningPatch)
      }

      await refreshUser()
      await qc.invalidateQueries({ queryKey: ['positions'] })
    } catch (err) {
      setRevertError(err instanceof Error ? err.message : 'Could not revert changes.')
    } finally {
      setReverting(false)
    }
  }, [committed, live, refreshUser, qc])

  const value = useMemo<AnalysisCommitValue>(
    () => ({ committed, changeCount, commit, revert, reverting, revertError }),
    [committed, changeCount, commit, revert, reverting, revertError],
  )

  return <AnalysisCommitContext.Provider value={value}>{children}</AnalysisCommitContext.Provider>
}

export function useAnalysisCommit(): AnalysisCommitValue {
  const ctx = useContext(AnalysisCommitContext)
  if (!ctx) throw new Error('useAnalysisCommit must be used inside AnalysisCommitProvider')
  return ctx
}
