import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Lock, Bell, TrendingUp, Clock, Sun, Moon, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'
import { useAuth } from '@/contexts/AuthContext'
import { useTickerSearch } from '@/hooks/useTickerSearch'
import { useNotifications, useMarkNotificationsRead } from '@/hooks/useNotifications'
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

/** Relative age for a notification row: "Just now", "4h ago", "3d ago", then an
 *  absolute date past a week. Hardcodes en-US like the rest of the app's date
 *  formatting (Profile, EquityChart); the `date_format` user setting is stored
 *  but not yet consumed anywhere. */
function timeAgo(iso: string): string {
  const then = new Date(iso)
  const seconds = Math.floor((Date.now() - then.getTime()) / 1000)
  if (!Number.isFinite(seconds) || seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Bell + notification feed, read from the server via useNotifications.
 *
 *  This popover is click-open rather than hover-open (the pattern the sibling
 *  SecurityLock still uses): a hover popover is `pointer-events-none`, so its
 *  contents can be neither scrolled nor clicked, and "opening marks the shown
 *  rows read" would fire on every incidental pointer pass. It reuses SearchBar's
 *  open/outside-click model from this same file, and keeps the hover popovers'
 *  exact surface styling so the three read as one family. */
function Notifications() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const markedThisOpen = useRef(false)

  const { data: notifications = [], isLoading } = useNotifications()
  const markRead = useMarkNotificationsRead()

  const unread = useMemo(() => notifications.filter((n) => !n.is_read), [notifications])

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // Opening the popover marks exactly the unread rows it is showing. The ref
  // guards it to one request per open (StrictMode's double-invoke included);
  // depending on `unread.length` means an open that lands before the query
  // resolves still marks the rows once they arrive, and the post-mark refetch
  // drives the length to 0, so the effect settles instead of looping.
  useEffect(() => {
    if (!open) {
      markedThisOpen.current = false
      return
    }
    if (markedThisOpen.current || unread.length === 0) return
    markedThisOpen.current = true
    markRead.mutate(unread.map((n) => n.id))
    // markRead is a stable react-query mutation object; re-running on it would
    // just re-fire the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, unread])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={
          unread.length > 0 ? `Notifications (${unread.length} unread)` : 'Notifications'
        }
        aria-expanded={open}
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-200 ease-out hover:bg-card hover:text-accent-teal',
          open ? 'bg-card text-accent-teal' : 'text-secondary',
        )}
      >
        <Bell size={18} />
        {unread.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent-teal ring-2 ring-base"
          />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-80 overflow-hidden rounded-xl border border-subtle bg-surface/80 shadow-lg shadow-black/40 backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-subtle px-4 py-2.5">
            <span className="text-[11px] uppercase tracking-wider text-secondary">
              Notifications
            </span>
            {unread.length > 0 && (
              <span className="text-[11px] text-accent-teal">{unread.length} unread</span>
            )}
          </div>

          {isLoading ? (
            <p className="p-6 text-center text-xs text-secondary opacity-60">
              Loading notifications...
            </p>
          ) : notifications.length === 0 ? (
            <p className="p-6 text-center text-xs text-secondary">No new notifications.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <li
                  key={n.id}
                  className="flex gap-2.5 border-b border-subtle px-4 py-3 last:border-b-0"
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full',
                      n.is_read ? 'bg-transparent' : 'bg-accent-teal',
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        'block text-xs leading-relaxed',
                        n.is_read ? 'text-secondary' : 'text-primary',
                      )}
                    >
                      {n.message}
                    </span>
                    <span className="mt-1 block text-[11px] text-secondary">
                      {timeAgo(n.created_at)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
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
