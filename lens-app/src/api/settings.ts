import { backendFetch } from '@/lib/backend'

export type RiskTier = 'low' | 'regular' | 'high'

// Typed client for the Fastify settings endpoints. The risk profile is stored per
// user in Postgres (see ../../backend/src/routes/settings.ts); this replaces the old
// lens_settings cookie. Read the current value via GET /me (risk_tier field, exposed
// on AuthContext.user). Cookie-authed via backendFetch.
export const settingsApi = {
  /** PUT /settings/risk-tier - set the tier, or null to clear it. */
  setRiskTier(risk_tier: RiskTier | null): Promise<RiskTier | null> {
    return backendFetch<{ risk_tier: RiskTier | null }>('/settings/risk-tier', {
      method: 'PUT',
      body: JSON.stringify({ risk_tier }),
    }).then((d) => d.risk_tier)
  },
}
