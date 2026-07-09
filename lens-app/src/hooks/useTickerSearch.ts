import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { lensApi, type SearchResult } from '@/api/lens'
import { TOP_TICKERS } from '@/lib/topTickers'

/** A search hit as rendered by the TopBar. `local` marks a fast-path match from
 *  the bundled TOP_TICKERS index (shown instantly, before the network responds). */
export interface TickerHit extends SearchResult {
  local: boolean
}

const DEBOUNCE_MS = 220
const MAX_RESULTS = 5

/** Symbols served by the local fast-path index. Remote (yfinance) results for
 *  these are dropped entirely so a top-list name only ever appears once, as its
 *  local "Stock" listing, never as a duplicate yfinance "equity" listing. */
const TOP_SYMBOLS = new Set(TOP_TICKERS.map((t) => t.symbol.toUpperCase()))

/** Map yfinance instrument types to plainer labels for a general audience.
 *  yfinance calls common shares "EQUITY"; most users know that as a "Stock". */
function normalizeType(type: string): string {
  return type.toUpperCase() === 'EQUITY' ? 'Stock' : type
}

/** Instant matches against the bundled top-tickers list. Symbol prefix matches
 *  rank above name substring matches; symbol-prefix above name-prefix. */
function localHits(q: string): TickerHit[] {
  const scored: { hit: TickerHit; score: number }[] = []
  for (const t of TOP_TICKERS) {
    const sym = t.symbol.toLowerCase()
    const name = t.name.toLowerCase()
    let score = -1
    if (sym === q) score = 0
    else if (sym.startsWith(q)) score = 1
    else if (name.startsWith(q)) score = 2
    else if (sym.includes(q)) score = 3
    else if (name.includes(q)) score = 4
    if (score >= 0) {
      scored.push({
        hit: { symbol: t.symbol, name: t.name, type: 'Stock', exchange: '', local: true },
        score,
      })
    }
  }
  return scored.sort((a, b) => a.score - b.score).map((s) => s.hit)
}

/**
 * Combined ticker search. Returns instant local matches from TOP_TICKERS merged
 * with debounced live results from lens-api (GET /search, backed by yfinance).
 * Local matches lead so a known name resolves with zero latency; remote results
 * fill in the rest and are de-duplicated against the local ones by symbol.
 */
export function useTickerSearch(query: string): { results: TickerHit[]; loading: boolean } {
  const q = query.trim().toLowerCase()

  // Debounce the query that feeds the network call (local matches are instant).
  const [debounced, setDebounced] = useState(q)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q), DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [q])

  const remote = useQuery({
    queryKey: ['ticker-search', debounced],
    queryFn: () => lensApi.search(debounced, MAX_RESULTS),
    enabled: debounced.length > 0,
    staleTime: 5 * 60 * 1000,
    retry: 0,
  })

  const results = useMemo<TickerHit[]>(() => {
    if (!q) return []
    const locals = localHits(q)
    const seen = new Set(locals.map((h) => h.symbol.toUpperCase()))
    const merged = [...locals]
    for (const r of remote.data ?? []) {
      const key = r.symbol.toUpperCase()
      // Skip anything already shown and anything in the local top list: those
      // names are served only from TOP_TICKERS, never as a yfinance duplicate.
      if (seen.has(key) || TOP_SYMBOLS.has(key)) continue
      seen.add(key)
      merged.push({ ...r, type: normalizeType(r.type), local: false })
    }
    return merged.slice(0, MAX_RESULTS)
  }, [q, remote.data])

  // "Loading" only while the debounced remote query for the *current* text is in
  // flight, so the spinner doesn't linger after local matches already rendered.
  const loading = debounced.length > 0 && debounced === q && remote.isFetching

  return { results, loading }
}
