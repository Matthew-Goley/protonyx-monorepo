import { backendFetch } from '@/lib/backend'
import { type SavedLayoutItem } from '@/lib/widgetLayout'

export type RiskTier = 'low' | 'regular' | 'high'
export type Theme = 'light' | 'dark'

// Analyze tuning blocks. Shapes mirror the lens-api engine DEFAULT_SETTINGS
// (lens-api/engine/constants.py); they are sent whole to POST /analyze (the API
// shallow-merges each block over its defaults, so partial blocks are never sent).
export interface DirectionThresholds {
  strong: number
  steady: number
  neutral_low: number
  neutral_high: number
  depreciating: number
}

export interface VolatilitySettings {
  lookback: string // '3 months' | '6 months' | '1 year'
  low_cutoff: number
  high_cutoff: number
}

export interface LensSignals {
  stock_concentration_pct: number
  sector_concentration_pct: number
  steep_downtrend_pct: number
  high_beta_threshold: number
  stock_vol_threshold_pct: number
  dead_weight_pct: number
  loss_threshold: number
  winner_drift_multiple: number
}

export interface MonteCarloSettings {
  projection_period: string // '3 months' | '6 months' | '1 year' | '2 years'
  simulations: number // 100 | 200 | 500 | 1000
}

// The full per-user settings blob (Postgres users.settings JSONB). Every field has
// a default; the server may store a partial object (or {}), so always read through
// mergeUserSettings. `layout` is the dashboard widget placement (null = no saved
// layout, fall back to the default pack). risk_tier is NOT here - it is its own
// column and its own endpoint.
export interface UserSettings {
  theme: Theme
  date_format: string
  layout: SavedLayoutItem[] | null
  direction_thresholds: DirectionThresholds
  volatility: VolatilitySettings
  lens_signals: LensSignals
  monte_carlo: MonteCarloSettings
}

export const DATE_FORMATS = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'] as const
export const VOLATILITY_LOOKBACKS = ['3 months', '6 months', '1 year'] as const
export const MONTE_CARLO_PERIODS = ['3 months', '6 months', '1 year', '2 years'] as const
export const MONTE_CARLO_SIMULATIONS = [100, 200, 500, 1000] as const

export const DEFAULT_USER_SETTINGS: UserSettings = {
  theme: 'dark',
  date_format: 'MM/DD/YYYY',
  layout: null,
  direction_thresholds: {
    strong: 0.08,
    steady: 0.02,
    neutral_low: -0.02,
    neutral_high: 0.02,
    depreciating: -0.08,
  },
  volatility: {
    lookback: '6 months',
    low_cutoff: 30,
    high_cutoff: 60,
  },
  lens_signals: {
    stock_concentration_pct: 35,
    sector_concentration_pct: 50,
    steep_downtrend_pct: -20,
    high_beta_threshold: 1.3,
    stock_vol_threshold_pct: 35,
    dead_weight_pct: 2,
    loss_threshold: -15,
    winner_drift_multiple: 2.0,
  },
  monte_carlo: {
    projection_period: '1 year',
    simulations: 500,
  },
}

// Fold a (possibly partial / empty) server settings object over the defaults. Each
// nested block is merged key-by-key so a stored partial block can never drop a field.
export function mergeUserSettings(raw?: Partial<UserSettings> | null): UserSettings {
  const d = DEFAULT_USER_SETTINGS
  const r = raw ?? {}
  return {
    theme: r.theme === 'light' || r.theme === 'dark' ? r.theme : d.theme,
    date_format: typeof r.date_format === 'string' ? r.date_format : d.date_format,
    layout: Array.isArray(r.layout) && r.layout.length > 0 ? r.layout : null,
    direction_thresholds: { ...d.direction_thresholds, ...(r.direction_thresholds ?? {}) },
    volatility: { ...d.volatility, ...(r.volatility ?? {}) },
    lens_signals: { ...d.lens_signals, ...(r.lens_signals ?? {}) },
    monte_carlo: { ...d.monte_carlo, ...(r.monte_carlo ?? {}) },
  }
}

// Typed client for the Fastify settings endpoints. Settings live per user in
// Postgres (users.settings JSONB + users.risk_tier); this replaces the old
// lens_settings / lens_layout / lens-theme client storage. Read the current values
// via GET /me (settings + risk_tier), exposed on AuthContext.user.
export const settingsApi = {
  /** PUT /settings/risk-tier - set the tier, or null to clear it. */
  setRiskTier(risk_tier: RiskTier | null): Promise<RiskTier | null> {
    return backendFetch<{ risk_tier: RiskTier | null }>('/settings/risk-tier', {
      method: 'PUT',
      body: JSON.stringify({ risk_tier }),
    }).then((d) => d.risk_tier)
  },

  /** PUT /settings - shallow-merge a partial settings object into the user's blob.
   *  Send each nested block whole (the server merges at the top level only). */
  updateSettings(patch: Partial<UserSettings>): Promise<Partial<UserSettings>> {
    return backendFetch<{ settings: Partial<UserSettings> }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }).then((d) => d.settings)
  },
}
