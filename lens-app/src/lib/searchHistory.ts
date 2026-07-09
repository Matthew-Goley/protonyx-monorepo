// Client-side record of recently searched/opened instruments, kept in
// localStorage (the app keeps no cookies; localStorage is its client-persistence
// layer, see lens-app/CLAUDE.md §4/§5). Powers the "Recent" list the TopBar
// search shows the moment the box is focused, before anything is typed. Keyed
// per user id so accounts on a shared browser stay separate, and de-duped by
// symbol (newest first) + capped like lensHistory.

export interface SearchHistoryEntry {
  symbol: string
  name: string
  type: string
  timestamp: number // ms since epoch
}

const MAX_ENTRIES = 5
const KEY_PREFIX = 'lens-search-history-v1'

function keyFor(userId: number | string): string {
  return `${KEY_PREFIX}-${userId}`
}

export function loadSearchHistory(
  userId: number | string | undefined | null,
): SearchHistoryEntry[] {
  if (userId == null) return []
  try {
    const raw = localStorage.getItem(keyFor(userId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is SearchHistoryEntry =>
        !!e &&
        typeof e.symbol === 'string' &&
        typeof e.name === 'string' &&
        typeof e.type === 'string' &&
        typeof e.timestamp === 'number',
    )
  } catch {
    return []
  }
}

// Prepend an entry (newest first), removing any prior entry for the same symbol
// so it moves to the top instead of duplicating, and capping at MAX_ENTRIES.
// No-op without a user or symbol. Returns the resulting list.
export function recordSearch(
  userId: number | string | undefined | null,
  entry: { symbol: string; name: string; type: string },
): SearchHistoryEntry[] {
  const history = loadSearchHistory(userId)
  if (userId == null || !entry.symbol) return history

  const symbol = entry.symbol.toUpperCase()
  const next: SearchHistoryEntry[] = [
    { symbol, name: entry.name, type: entry.type, timestamp: Date.now() },
    ...history.filter((e) => e.symbol.toUpperCase() !== symbol),
  ].slice(0, MAX_ENTRIES)

  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(next))
  } catch {
    // storage full / unavailable — history is best-effort, never block search.
  }
  return next
}

export function clearSearchHistory(
  userId: number | string | undefined | null,
): SearchHistoryEntry[] {
  if (userId != null) {
    try {
      localStorage.removeItem(keyFor(userId))
    } catch {
      // ignore
    }
  }
  return []
}
