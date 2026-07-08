import { useQuery } from '@tanstack/react-query'
import { lensApi, type HistoryPeriod } from '@/api/lens'
import { usePositions } from '@/hooks/usePositions'

export interface EquityPoint {
  date: string
  equity: number
}

/**
 * Builds the real portfolio equity curve from the lens-api `/tickers/history`
 * endpoint (daily closes for all holdings in ONE batched request). For each
 * trading day present across all positions, equity = Σ (shares × close). This is
 * real, jagged market data — unlike the Portfolio Value / Monte Carlo lead-in
 * surfaces, which otherwise synthesize a straight line from the single
 * annualized-slope scalar in the /analyze response.
 *
 * Resilient: any ticker absent from the response (unknown/failed) is dropped;
 * only dates present in every surviving series are summed, so the curve never
 * jumps. Returns [] while loading or on total failure, letting callers fall back.
 */
export function usePortfolioHistory(period: HistoryPeriod = '6mo') {
  const { data: positions = [] } = usePositions()

  return useQuery<EquityPoint[]>({
    queryKey: ['portfolio-history', positions.map((p) => `${p.ticker}:${p.shares}`), period],
    enabled: positions.length > 0,
    staleTime: 30 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const byTicker = await lensApi.getTickersHistory(
        positions.map((p) => p.ticker),
        period,
      )

      // Keep only positions the API returned data for; pair each with its shares.
      const series = positions
        .map((p) => ({ shares: p.shares, rows: byTicker[p.ticker.toUpperCase()] }))
        .filter((s): s is { shares: number; rows: { date: string; close: number }[] } =>
          Array.isArray(s.rows) && s.rows.length > 0,
        )
      if (series.length === 0) return []

      const maps = series.map((s) => {
        const m = new Map<string, number>()
        for (const row of s.rows) m.set(row.date, row.close)
        return { shares: s.shares, m }
      })

      const points: EquityPoint[] = []
      for (const [date, close] of maps[0].m) {
        let equity = maps[0].shares * close
        let complete = true
        for (let i = 1; i < maps.length; i++) {
          const c = maps[i].m.get(date)
          if (c === undefined) {
            complete = false
            break
          }
          equity += maps[i].shares * c
        }
        if (complete) points.push({ date, equity })
      }
      points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
      return points
    },
  })
}
