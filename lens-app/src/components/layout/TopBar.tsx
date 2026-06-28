import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Lock, Bell, TrendingUp, Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/ThemeContext'

/* Searchable index. Just the placeholder instrument for now; real results will
   come from a quote/search endpoint later. Each item links to its detail page. */
const SEARCH_INDEX = [
  { symbol: 'EXMPL', name: 'Example Corporation', type: 'Stock', to: '/commodity/example', keywords: 'example' },
]

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
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

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

  const q = query.trim().toLowerCase()
  const results = q
    ? SEARCH_INDEX.filter(
        (item) =>
          item.symbol.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.keywords.includes(q),
      )
    : []

  function go(to: string) {
    setOpen(false)
    setQuery('')
    navigate(to)
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
          placeholder="Search for anything"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          className={cn(
            'h-9 w-full border border-subtle bg-surface pl-9 pr-4 text-sm text-primary placeholder:text-muted transition-colors duration-200 ease-out focus:border-accent-teal focus:outline-none',
            open ? 'rounded-t-2xl border-b-0' : 'rounded-full',
          )}
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full rounded-b-2xl border border-t-0 border-accent-teal bg-surface/80 p-2 shadow-lg shadow-black/40 backdrop-blur-md">
          {!q ? (
            <p className="px-3 py-6 text-center text-xs text-muted">Start typing to search</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted">No results for "{query}"</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {results.map((item) => (
                <li key={item.symbol}>
                  <button
                    type="button"
                    onClick={() => go(item.to)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors duration-200 ease-out hover:bg-card"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md border border-subtle bg-elevated text-accent-teal">
                      <TrendingUp size={15} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-primary">{item.symbol}</span>
                      <span className="block truncate text-xs text-secondary">{item.name}</span>
                    </span>
                    <span className="rounded border border-subtle px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-secondary">
                      {item.type}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
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
