// Lightweight client-side record of past Lens analyses, kept in localStorage
// (the app keeps no cookies; localStorage is its client-persistence layer, see
// lens-app/CLAUDE.md §4/§5). Each snapshot stores just the caution score and the
// brief so the Analysis "History" panel can show how a portfolio's reading has
// moved over time. Keyed per user id so accounts on a shared browser stay
// separate, and de-duped/capped like the Vector desktop lens_history.

export interface LensHistoryEntry {
  timestamp: number // ms since epoch
  caution_score: number
  brief: string
}

const MAX_ENTRIES = 50
const KEY_PREFIX = 'lens-history-v1'

function keyFor(userId: number | string): string {
  return `${KEY_PREFIX}-${userId}`
}

export function loadHistory(userId: number | string | undefined | null): LensHistoryEntry[] {
  if (userId == null) return []
  try {
    const raw = localStorage.getItem(keyFor(userId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is LensHistoryEntry =>
        !!e &&
        typeof e.timestamp === 'number' &&
        typeof e.caution_score === 'number' &&
        typeof e.brief === 'string',
    )
  } catch {
    return []
  }
}

// Prepend a snapshot (newest first), skipping it when it matches the most recent
// entry by brief + caution score, and capping at MAX_ENTRIES. No-op without a
// user or a brief. Returns the resulting list so callers can update local state.
export function recordHistory(
  userId: number | string | undefined | null,
  entry: { caution_score: number; brief: string },
): LensHistoryEntry[] {
  const history = loadHistory(userId)
  if (userId == null || !entry.brief) return history

  const latest = history[0]
  if (latest && latest.brief === entry.brief && latest.caution_score === entry.caution_score) {
    return history
  }

  const next: LensHistoryEntry[] = [
    { timestamp: Date.now(), caution_score: entry.caution_score, brief: entry.brief },
    ...history,
  ].slice(0, MAX_ENTRIES)

  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(next))
  } catch {
    // storage full / unavailable — history is best-effort, never block analysis.
  }
  return next
}

export function clearHistory(userId: number | string | undefined | null): LensHistoryEntry[] {
  if (userId != null) {
    try {
      localStorage.removeItem(keyFor(userId))
    } catch {
      // ignore
    }
  }
  return []
}
