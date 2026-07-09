import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Lock, Bell, TrendingUp, Clock, Sun, Moon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { useTickerSearch } from '@/hooks/useTickerSearch'
import { loadSearchHistory, recordSearch, clearSearchHistory } from '@/lib/searchHistory'

/** A row rendered in the search dropdown - either a live search hit or a saved
 *  recent-search entry. `recent` swaps the leading icon and adds the section. */
interface SearchRow {
  symbol: string
  name: string
  type: string
  exchange?: string
  recent?: boolean
}

/** Fixed top bar spanning the full viewport width. Holds a screen-centered
 *  search bar and a security lock indicator on the right. The Sidebar is layered
 *  above it (higher z-index) so it overlaps the top-left. */
export function TopBar() {
  return (
    <header className="fixed inset-x-0 top-0 z-10 h-14 border-b border-subtle bg-base">
      {/* Centered on the viewport (not the bar) so the sidebar can't shift it. */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <SearchBar />
      </div>
      <div className="absolute right-6 top-1/2 flex -translate-y-1/2 items-center gap-1">
        <ThemeToggle />
        <Notifications />
        <SecurityLock />
      </div>
    </header>
  )
}

function SearchBar() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  const q = query.trim()
  const { results, loading } = useTickerSearch(query)

  // Recent searches (localStorage, per user). Reloaded whenever the box opens
  // or the account changes so it always reflects the latest saved list.
  const [history, setHistory] = useState<SearchRow[]>([])
  useEffect(() => {
    if (!open) return
    setHistory(loadSearchHistory(user?.id).map((e) => ({ ...e, recent: true })))
  }, [open, user?.id])

  // When there's no query, the dropdown shows recent searches; otherwise results.
  const showHistory = !q && history.length > 0
  const rows = useMemo<SearchRow[]>(() => (q ? results : history), [q, results, history])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Keep the highlighted row in range as the visible list changes.
  useEffect(() => {
    setActive((a) => (rows.length === 0 ? 0 : Math.min(a, rows.length - 1)))
  }, [rows.length])

  function go(row: SearchRow) {
    setHistory(recordSearch(user?.id, { symbol: row.symbol, name: row.name, type: row.type }).map((e) => ({ ...e, recent: true })))
    setOpen(false)
    setQuery('')
    setActive(0)
    navigate(`/commodity/${encodeURIComponent(row.symbol)}`)
  }

  function clearHistory() {
    setHistory(clearSearchHistory(user?.id))
    setActive(0)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open || rows.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (a + 1) % rows.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (a - 1 + rows.length) % rows.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const hit = rows[active]
      if (hit) go(hit)
    }
  }

  return (
    <div ref={containerRef} className="relative z-50 w-[420px] max-w-[60vw]">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secondary"
        />
        <input
          type="text"
          placeholder="Search stocks by name or symbol"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className={cn(
            'h-9 w-full border border-subtle bg-surface pl-9 pr-9 text-sm text-primary placeholder:text-muted transition-colors duration-200 ease-out focus:border-accent-teal focus:outline-none',
            open ? 'rounded-t-2xl border-b-0' : 'rounded-full',
          )}
        />
        {loading && (
          <Loader2
            size={15}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-secondary"
          />
        )}
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full overflow-hidden rounded-b-2xl border border-t-0 border-accent-teal bg-surface/80 py-2 shadow-lg shadow-black/40 backdrop-blur-md">
          {!q && history.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted">
              Start typing a company name or ticker
            </p>
          ) : q && results.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted">
              {loading ? 'Searching...' : `No results for "${query}"`}
            </p>
          ) : (
            <>
              {showHistory && (
                <div className="flex items-center justify-between px-4 pb-1 pt-1">
                  <span className="text-[11px] uppercase tracking-wider text-secondary">Recent</span>
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="text-[11px] text-secondary transition-colors duration-200 ease-out hover:text-primary"
                  >
                    Clear
                  </button>
                </div>
              )}
              <ul className="flex flex-col gap-0.5">
                {rows.map((item, i) => (
                  <li key={item.symbol}>
                    <button
                      type="button"
                      onClick={() => go(item)}
                      onMouseEnter={() => setActive(i)}
                      className={cn(
                        'flex w-full items-center gap-3 border-y border-transparent px-4 py-2 text-left transition-colors duration-200 ease-out',
                        i === active
                          ? 'border-accent-teal bg-card'
                          : 'hover:border-accent-teal hover:bg-card',
                      )}
                    >
                      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-subtle bg-elevated text-accent-teal">
                        {item.recent ? <Clock size={15} /> : <TrendingUp size={15} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-primary">{item.symbol}</span>
                        <span className="block truncate text-xs text-secondary">{item.name}</span>
                      </span>
                      {(item.type || item.exchange) && (
                        <span className="shrink-0 rounded border border-subtle px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-secondary">
                          {item.type || item.exchange}
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const next = theme === 'dark' ? 'light' : 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="flex h-9 w-9 items-center justify-center rounded-md text-secondary transition-colors duration-200 ease-out hover:bg-card hover:text-accent-teal"
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  )
}

function Notifications() {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label="Notifications"
        className="flex h-9 w-9 items-center justify-center rounded-md text-secondary transition-colors duration-200 ease-out hover:bg-card hover:text-accent-teal"
      >
        <Bell size={18} />
      </button>

      <div className="pointer-events-none absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 rounded-xl border border-subtle bg-surface/80 p-6 text-center text-xs text-secondary opacity-0 shadow-lg shadow-black/40 backdrop-blur-md transition-opacity duration-200 ease-out group-hover:opacity-100">
        No new notifications.
      </div>
    </div>
  )
}

function SecurityLock() {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label="Security information"
        className="flex h-9 w-9 items-center justify-center rounded-md text-secondary transition-colors duration-200 ease-out hover:bg-card hover:text-accent-teal"
      >
        <Lock size={18} />
      </button>

      <div className="pointer-events-none absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 rounded-xl border border-subtle bg-surface/80 p-3 text-xs text-secondary opacity-0 shadow-lg shadow-black/40 backdrop-blur-md transition-opacity duration-200 ease-out group-hover:opacity-100">
        Your investment data is secured with bank-level security.
      </div>
    </div>
  )
}
