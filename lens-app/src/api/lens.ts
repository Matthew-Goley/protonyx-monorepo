import type {
  RiskTier,
  DirectionThresholds,
  VolatilitySettings,
  LensSignals,
  MonteCarloSettings,
} from '@/api/settings'

// DEV ONLY: API key hardcoded for direct browser -> lens-api calls.
// Before launch, move all /analyze calls to the Fastify backend (server-to-server)
// so this key is never exposed in client code.
const LENS_API_URL = 'https://lens-api-production-b0ab.up.railway.app'
const LENS_API_KEY = '855ef5bd16e46fd3f425246c13ee621b6d788e6824187e6c9cc187bc4cf6a79b'

export interface Position {
  ticker: string
  shares: number
  equity: number
  price: number
  sector?: string
  name?: string
  added_at?: string
}

export interface LensSettings {
  risk_tier?: RiskTier
  refresh_interval?: number
  direction_thresholds?: DirectionThresholds
  volatility?: VolatilitySettings
  lens_signals?: LensSignals
  monte_carlo?: MonteCarloSettings
}

export type ActionType = 'sell' | 'rebalance' | 'buy_new' | 'buy_more' | 'hold'
export type Severity = 'none' | 'low' | 'moderate' | 'high' | 'critical'

export interface CTA {
  action: ActionType
  ticker: string
  dollars: number
  reason: string
  severity: Severity
  sector: string
}

export interface LensResult {
  brief: string
  color: string
  caution_score: number
  threat_level: number
  action_type: ActionType
  recommended_tickers: string[]
  deposit_amount: number
  underweight_sector: string
  ctas: CTA[]
  full_report: unknown[]
  pool_results: Record<string, unknown>
  projected_positions: unknown[]
  net_cta_delta: number
}

export interface AnalyzeRequest {
  positions: Position[]
  settings?: LensSettings
}

export type HistoryPeriod = '1mo' | '3mo' | '6mo' | '1y' | '2y' | '5y'

export interface TickerHistoryPoint {
  date: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface TickerClosePoint {
  date: string
  close: number
}

export interface TickerInfo {
  name: string | null
  sector: string | null
  market_cap: number | null
  pe_ratio: number | null
  dividend_yield: number | null
  current_price: number | null
}

/** A single symbol/company-name match from GET /search. */
export interface SearchResult {
  symbol: string
  name: string
  type: string
  exchange: string
}

/** Full instrument snapshot from GET /ticker/{symbol}/quote, backing the
 *  Markets (instrument-detail) page. Every numeric field is nullable because
 *  yfinance omits fields for some instruments (ETFs have no P/E, etc.). */
export interface TickerQuote {
  symbol: string
  name: string
  type: string
  exchange: string
  currency: string
  price: number | null
  prev_close: number | null
  open: number | null
  day_high: number | null
  day_low: number | null
  year_high: number | null
  year_low: number | null
  volume: number | null
  avg_volume: number | null
  market_cap: number | null
  pe_ratio: number | null
  eps: number | null
  dividend_yield: number | null
  beta: number | null
  sector: string | null
  industry: string | null
  description: string | null
}

function apiHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'X-API-Key': LENS_API_KEY,
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText })) as { detail?: string }
    throw new Error(body.detail ?? `API error ${res.status}`)
  }
  return res.json() as Promise<T>
}

export const lensApi = {
  /** POST /analyze - run the full Lens pipeline on a portfolio. */
  analyze(req: AnalyzeRequest): Promise<LensResult> {
    return fetch(`${LENS_API_URL}/analyze`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(req),
    }).then((r) => handleResponse<LensResult>(r))
  },

  /** GET /ticker/{symbol}/info - company snapshot. Used to validate a ticker and
   *  pull price/sector/name when adding a position. Throws on unknown ticker (404). */
  getTickerInfo(symbol: string): Promise<TickerInfo> {
    return fetch(`${LENS_API_URL}/ticker/${encodeURIComponent(symbol)}/info`, {
      headers: apiHeaders(),
    }).then((r) => handleResponse<TickerInfo>(r))
  },

  /** GET /ticker/{symbol}/history - real daily OHLCV from the lens-api (yfinance).
   *  Used to build the real portfolio equity curve. period defaults to 1y. */
  getTickerHistory(symbol: string, period: HistoryPeriod = '1y'): Promise<TickerHistoryPoint[]> {
    return fetch(
      `${LENS_API_URL}/ticker/${encodeURIComponent(symbol)}/history?period=${period}`,
      { headers: apiHeaders() },
    ).then((r) => handleResponse<TickerHistoryPoint[]>(r))
  },

  /** GET /tickers/history - daily closes for many tickers in one batched request.
   *  Backs the portfolio equity curve: one round trip instead of N per-symbol
   *  /history calls. Returns { SYMBOL: [{date, close}], ... }; unknown symbols
   *  are simply absent from the map. */
  getTickersHistory(
    symbols: string[],
    period: HistoryPeriod = '6mo',
  ): Promise<Record<string, TickerClosePoint[]>> {
    const qs = encodeURIComponent(symbols.join(','))
    return fetch(
      `${LENS_API_URL}/tickers/history?symbols=${qs}&period=${period}`,
      { headers: apiHeaders() },
    ).then((r) => handleResponse<Record<string, TickerClosePoint[]>>(r))
  },

  /** GET /search - symbol / company-name search backed by Yahoo Finance.
   *  Returns best matches first; an unknown query yields an empty list. Used by
   *  the TopBar search bar (alongside the local TOP_TICKERS fast-path index). */
  search(q: string, limit = 8): Promise<SearchResult[]> {
    return fetch(
      `${LENS_API_URL}/search?q=${encodeURIComponent(q)}&limit=${limit}`,
      { headers: apiHeaders() },
    ).then((r) => handleResponse<SearchResult[]>(r))
  },

  /** GET /ticker/{symbol}/quote - full instrument snapshot for the Markets page
   *  (identity, live price, intraday + 52-week range, volume, valuation,
   *  description). Throws on unknown ticker (404). */
  getTickerQuote(symbol: string): Promise<TickerQuote> {
    return fetch(`${LENS_API_URL}/ticker/${encodeURIComponent(symbol)}/quote`, {
      headers: apiHeaders(),
    }).then((r) => handleResponse<TickerQuote>(r))
  },

  /** GET /health - check service availability (no auth required). */
  health(): Promise<{ status: string }> {
    return fetch(`${LENS_API_URL}/health`).then((r) =>
      handleResponse<{ status: string }>(r),
    )
  },
}
