import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

/*
  Light / dark theme. Dark is the default (the design tokens in index.css's
  @theme are the dark values); light mode is a `.light` class on <html> that
  overrides those CSS custom properties (see index.css). The choice persists to
  localStorage, and index.html applies the class pre-paint to avoid a flash.
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
  const [theme, setTheme] = useState<Theme>(getInitial)

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      /* ignore */
    }
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return <Ctx.Provider value={{ theme, setTheme, toggleTheme }}>{children}</Ctx.Provider>
}

export function useTheme() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useTheme must be used within ThemeProvider')
  return v
}
