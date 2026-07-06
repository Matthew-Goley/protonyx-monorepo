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
  risk_tier?: 'low' | 'regular' | 'high'
  refresh_interval?: number
  direction_thresholds?: Record<string, unknown>
  volatility?: Record<string, unknown>
  lens_signals?: Record<string, unknown>
  monte_carlo?: Record<string, unknown>
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

  /** GET /health - check service availability (no auth required). */
  health(): Promise<{ status: string }> {
    return fetch(`${LENS_API_URL}/health`).then((r) =>
      handleResponse<{ status: string }>(r),
    )
  },
}
