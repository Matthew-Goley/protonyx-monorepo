import type { Position } from '@/api/lens'
import type { LayoutItem, SavedLayoutItem } from '@/lib/widgetLayout'

// Persisted client state lives in cookies (30-day expiry, SameSite=Lax) so the
// onboarding output survives reloads without a positions table on the backend.
const POSITIONS_COOKIE = 'lens_positions'
const SETTINGS_COOKIE = 'lens_settings'
const LAYOUT_COOKIE = 'lens_layout'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days, in seconds

export type RiskTier = 'low' | 'regular' | 'high'

export interface StoredSettings {
  risk_tier: RiskTier
}

function readCookie(name: string): string | null {
  const prefix = `${name}=`
  const found = document.cookie
    .split('; ')
    .find((row) => row.startsWith(prefix))
  if (!found) return null
  return decodeURIComponent(found.slice(prefix.length))
}

function writeCookie(name: string, value: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${MAX_AGE}; SameSite=Lax`
}

export function getPositions(): Position[] {
  const raw = readCookie(POSITIONS_COOKIE)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Position[]) : []
  } catch {
    return []
  }
}

export function setPositions(positions: Position[]): void {
  writeCookie(POSITIONS_COOKIE, JSON.stringify(positions))
}

export function getSettings(): StoredSettings {
  const raw = readCookie(SETTINGS_COOKIE)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<StoredSettings>
      if (parsed.risk_tier) return { risk_tier: parsed.risk_tier }
    } catch {
      /* fall through to default */
    }
  }
  return { risk_tier: 'regular' }
}

export function setSettings(settings: StoredSettings): void {
  writeCookie(SETTINGS_COOKIE, JSON.stringify(settings))
}

// Dashboard widget layout: user PLACEMENT only ({ widgetId, x, y, w }). Height is
// never persisted - WidgetGrid always re-measures h on load - so content growth
// can never restore a stale, clipping height. Written only on an actual edit
// (drag drop, add, delete); cleared by "Reset layout".
function isSavedLayoutItem(v: unknown): v is SavedLayoutItem {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.widgetId === 'string' &&
    typeof o.x === 'number' &&
    typeof o.y === 'number' &&
    typeof o.w === 'number'
  )
}

// Returns the saved placement, or null when there is none / it is malformed
// (WidgetGrid then falls back to the default measured pack).
export function getLayout(): SavedLayoutItem[] | null {
  const raw = readCookie(LAYOUT_COOKIE)
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isSavedLayoutItem)) {
      return parsed as SavedLayoutItem[]
    }
  } catch {
    /* fall through to null */
  }
  return null
}

export function setLayout(layout: LayoutItem[]): void {
  const saved: SavedLayoutItem[] = layout.map(({ widgetId, x, y, w }) => ({ widgetId, x, y, w }))
  writeCookie(LAYOUT_COOKIE, JSON.stringify(saved))
}

export function clearLayout(): void {
  // Expire the cookie immediately.
  document.cookie = `${LAYOUT_COOKIE}=; path=/; max-age=0; SameSite=Lax`
}
