import type { LayoutItem, SavedLayoutItem } from '@/lib/widgetLayout'

// The only persisted client-side state left in a cookie is the dashboard widget
// layout. Positions and the risk profile now live per-user in Postgres (Fastify
// /positions and /settings/risk-tier), so nothing account-specific is shared across
// users on the same browser anymore.
const LAYOUT_COOKIE = 'lens_layout'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days, in seconds

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

// Wipes the persisted client-side layout by expiring its cookie. Positions and the
// risk profile live on the server now, so clearing them is a separate call (see
// Settings "Clear Data": positionsApi.replacePositions([]) + settingsApi.setRiskTier(null)).
export function clearAllData(): void {
  clearLayout()
}
