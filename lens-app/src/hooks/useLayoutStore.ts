import { useCallback, useRef } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { settingsApi } from '@/api/settings'
import { type LayoutItem, type SavedLayoutItem } from '@/lib/widgetLayout'

/**
 * Server-backed persistence for the dashboard widget layout (users.settings.layout,
 * Postgres). Replaces the old lens_layout cookie. WidgetGrid reads/writes placement
 * ({widgetId, x, y, w}) through this; heights are never persisted (always re-measured).
 *
 * WidgetGrid re-reads the saved layout imperatively during its measure/build passes,
 * and it must see its own most-recent write synchronously (the same guarantee the
 * cookie gave). So the source of truth here is a ref seeded once from the auth user's
 * settings; get/save/clear read and write that ref synchronously, and writes are
 * additionally flushed to the server fire-and-forget (no refreshUser per drag - the
 * grid holds its own state; the server value is only re-read on a full reload / next
 * login, at which point /me returns the saved layout). The grid only renders once the
 * user is loaded, so seeding from user.settings on first call is safe.
 */
export function useLayoutStore() {
  const { user } = useAuth()
  const ref = useRef<SavedLayoutItem[] | null | undefined>(undefined)

  if (ref.current === undefined) {
    const saved = user?.settings?.layout
    ref.current = Array.isArray(saved) && saved.length > 0 ? saved : null
  }

  // Current saved placement, or null when there is none (grid falls back to default).
  const getSaved = useCallback((): SavedLayoutItem[] | null => ref.current ?? null, [])

  // Persist placement only ({x, y, w}); strip the measured h before writing.
  const save = useCallback((layout: LayoutItem[]) => {
    const saved: SavedLayoutItem[] = layout.map(({ widgetId, x, y, w }) => ({ widgetId, x, y, w }))
    ref.current = saved
    settingsApi.updateSettings({ layout: saved }).catch(() => {
      /* fire-and-forget; the grid keeps its in-session state regardless */
    })
  }, [])

  // Reset to the default pack: clear locally and persist layout:null on the server.
  const clear = useCallback(() => {
    ref.current = null
    settingsApi.updateSettings({ layout: null }).catch(() => {})
  }, [])

  return { getSaved, save, clear }
}
