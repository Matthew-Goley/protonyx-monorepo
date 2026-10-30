// The video's only data source. Regenerate with `npm run data`.
import raw from '../data/sample.json'

export type Severity = 'none' | 'low' | 'moderate' | 'high' | 'critical'

export interface Sample {
  meta: { label: string; risk_tier: string; market_data: string; as_of: string; engine: string }
  portfolio: {
    total_equity: number
    positions: { ticker: string; name: string; sector: string; shares: number; value: number; weight_pct: number }[]
  }
  analyzers: { key: string; severity: Severity; level: number; flag: boolean; value: number | null }[]
  caution_score: number
  action_type: string
  brief: { raw: string; display: string[] }
  actions: {
    rank: number
    action: string
    ticker: string
    dollars: number
    severity: Severity
    reason: string
    priority: number
  }[]
  net_cta_delta: number
}

export const sample = raw as Sample

export const money = (n: number) =>
  '$' + Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 })

const asOfDate = new Date(sample.meta.as_of + 'T00:00:00')

// Values available to {tokens} in config copy.
export const TOKENS: Record<string, string> = {
  holdingCount: String(sample.portfolio.positions.length),
  totalEquity: money(sample.portfolio.total_equity),
  analyzerCount: String(sample.analyzers.length),
  actionCount: String(sample.actions.length),
  cautionScore: String(sample.caution_score),
  asOf: asOfDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
}

export const fill = (template: string) =>
  template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (!(key in TOKENS)) throw new Error(`Unknown copy token {${key}}`)
    return TOKENS[key]
  })
