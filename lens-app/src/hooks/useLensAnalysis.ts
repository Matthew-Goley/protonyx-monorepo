import { useQuery } from '@tanstack/react-query'
import { lensApi, type LensResult } from '@/api/lens'
import { useAnalysisCommit } from '@/contexts/AnalysisCommitContext'

/**
 * Runs POST /analyze against the COMMITTED snapshot from AnalysisCommitContext,
 * not against live state. Dashboard, Analysis, and Profile share a single cached
 * result (same query key).
 *
 * The snapshot is the whole point: react-query hashes query keys by value, so
 * when this hook read live positions/settings directly, every holding edit or
 * tier change minted a new key and fired the (slow, yfinance-backed) analyze call
 * immediately. Keying off `committed` means the call happens only when the user
 * commits via the header change bar, which is what makes edits feel instant.
 *
 * `committed` is null only until the positions query first resolves; the provider
 * then auto-adopts server state, so a normal page load still analyzes on its own.
 * Each tuning block is sent WHOLE - the API merges settings shallowly at the top
 * level.
 */
export function useLensAnalysis() {
  const { committed } = useAnalysisCommit()

  const list = committed?.positions ?? []
  const analyzeSettings = committed?.settings ?? {}

  return useQuery<LensResult>({
    queryKey: ['lens-analysis', list, analyzeSettings],
    queryFn: () =>
      lensApi.analyze({
        positions: list,
        settings: analyzeSettings,
      }),
    enabled: committed !== null && list.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}
