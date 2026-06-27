import { useQuery } from '@tanstack/react-query'
import { lensApi, type HistoryPeriod, type TickerHistoryPoint } from '@/api/lens'
import { getPositions } from '@/lib/cookies'

export interface EquityPoint {
  date: string
  equity: number
}

/**
 * Builds the real portfolio equity curve from the lens-api `/ticker/{symbol}/history`
 * endpoint (daily closes). For each trading day present across all positions,
 * equity = Σ (shares × close). This is real, jagged market data — unlike the
 * Total Equity / Monte Carlo lead-in surfaces, which otherwise synthesize a
 * straight line from the single annualized-slope scalar in the /analyze response.
 *
 * Resilient: tickers whose history fails are dropped (Promise.allSettled); only
 * dates present in every surviving series are summed, so the curve never jumps.
 * Returns [] while loading or on total failure, letting callers fall back.
 */
export function usePortfolioHistory(period: HistoryPeriod = '6mo') {
  const positions = getPositions()

  return useQuery<EquityPoint[]>({
    queryKey: ['portfolio-history', positions.map((p) => `${p.ticker}:${p.shares}`), period],
    enabled: positions.length > 0,
    staleTime: 30 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const settled = await Promise.allSettled(
        positions.map((p) =>
          lensApi
            .getTickerHistory(p.ticker, period)
            .then((hist) => ({ shares: p.shares, hist })),
        ),
      )

      const series = settled
        .filter(
          (r): r is PromiseFulfilledResult<{ shares: number; hist: TickerHistoryPoint[] }> =>
            r.status === 'fulfilled',
        )
        .map((r) => r.value)
      if (series.length === 0) return []

      const maps = series.map((s) => {
        const m = new Map<string, number>()
        for (const row of s.hist) m.set(row.date, row.close)
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
