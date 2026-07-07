import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { settingsApi } from '@/api/settings'

/*
  Light / dark theme. Dark is the default (the design tokens in index.css's
  @theme are the dark values); light mode is a `.light` class on <html> that
  overrides those CSS custom properties (see index.css).

  Source of truth is the per-user server setting (users.settings.theme, via /me on
  AuthContext). localStorage is kept only as a pre-paint cache so light mode doesn't
  flash dark before /me resolves (index.html reads it synchronously in <head>). On
  login we reconcile local state to the server value; a user toggle updates local
  state + localStorage immediately AND persists to the server (fire-and-forget).
  ThemeProvider is mounted inside AuthProvider so it can read the user.
*/
export type Theme = 'light' | 'dark'

interface ThemeValue {
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void
}

const Ctx = createContext<ThemeValue | null>(null)
const STORAGE_KEY = 'lens-theme'

function getInitial(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* ignore */
  }
  return 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  const [theme, setThemeState] = useState<Theme>(getInitial)

  // Apply the class + refresh the pre-paint cache whenever the theme changes.
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  // Reconcile to the server value when the user loads / switches accounts. Guarded
  // to a valid value so a new account with no stored theme keeps the local default.
  const serverTheme = user?.settings?.theme
  useEffect(() => {
    if (serverTheme === 'light' || serverTheme === 'dark') setThemeState(serverTheme)
  }, [serverTheme])

  // Public setter: update locally now, persist to the server if signed in. Not
  // awaited (theme should feel instant); the reconcile effect keeps things coherent.
  const setTheme = (t: Theme) => {
    setThemeState(t)
    if (isAuthenticated) settingsApi.updateSettings({ theme: t }).catch(() => {})
  }

  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  return <Ctx.Provider value={{ theme, setTheme, toggleTheme }}>{children}</Ctx.Provider>
}

export function useTheme() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme must be used within ThemeProvider')
  return v
}
