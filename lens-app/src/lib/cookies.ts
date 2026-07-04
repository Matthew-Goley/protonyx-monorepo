import type { Position } from '@/api/lens'
import type { LayoutItem } from '@/lib/widgetLayout'
import { getDefaultLayout } from '@/lib/widgetLayout'

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

// Dashboard widget layout (grid coordinates per widget). No UI mutates this yet;
// the accessors exist so the later drag/edit phase gets persistence for free.
function isLayoutItem(v: unknown): v is LayoutItem {
  if (!v || typeof v !== 'object') return false
  const o = v as Record<string, unknown>
  return (
    typeof o.widgetId === 'string' &&
    typeof o.x === 'number' &&
    typeof o.y === 'number' &&
    typeof o.w === 'number' &&
    typeof o.h === 'number'
  )
}

export function getLayout(): LayoutItem[] {
  const raw = readCookie(LAYOUT_COOKIE)
  if (raw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.every(isLayoutItem)) {
        return parsed as LayoutItem[]
      }
    } catch {
      /* fall through to default */
    }
  }
  return getDefaultLayout()
}

export function setLayout(layout: LayoutItem[]): void {
  writeCookie(LAYOUT_COOKIE, JSON.stringify(layout))
}
