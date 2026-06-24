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

export interface TickerHistoryPoint {
  date: string
  close: number
  volume?: number
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
  /** POST /analyze — run the full Lens pipeline on a portfolio. */
  analyze(req: AnalyzeRequest): Promise<LensResult> {
    return fetch(`${LENS_API_URL}/analyze`, {
      method: 'POST',
      headers: apiHeaders(),
      body: JSON.stringify(req),
    }).then((r) => handleResponse<LensResult>(r))
  },

  /** GET /ticker/{symbol}/history — stub, endpoint not yet implemented on server. */
  getTickerHistory(_symbol: string): Promise<TickerHistoryPoint[]> {
    // TODO: implement GET /ticker/{symbol}/history on lens-api and wire this up.
    return Promise.reject(new Error('Not implemented'))
  },

  /** GET /health — check service availability (no auth required). */
  health(): Promise<{ status: string }> {
    return fetch(`${LENS_API_URL}/health`).then((r) =>
      handleResponse<{ status: string }>(r),
    )
  },
}
