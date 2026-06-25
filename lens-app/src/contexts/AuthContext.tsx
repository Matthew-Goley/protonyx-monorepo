import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

interface User {
  id: number
  username: string
  email: string
  plan: string
  subscription_status: 'inactive' | 'active' | 'cancelled'
  member_since?: string
  beta_access?: boolean
  email_verified?: boolean
}

interface AuthContextValue {
  isAuthenticated: boolean
  loading: boolean
  user: User | null
  login: (username: string, password: string) => Promise<void>
  signup: (username: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    fetch(`${BACKEND_URL}/me`, { credentials: 'include' })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json()
          setUser(data.user)
          setIsAuthenticated(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function login(username: string, password: string) {
    const res = await fetch(`${BACKEND_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password }),
    })

    const data = await res.json().catch(() => ({})) as { message?: string; success?: boolean }

    if (!res.ok) {
      throw new Error(data.message ?? 'Login failed')
    }

    const meRes = await fetch(`${BACKEND_URL}/me`, { credentials: 'include' })
    if (meRes.ok) {
      const meData = await meRes.json()
      setUser(meData.user)
    }
    setIsAuthenticated(true)
  }

  async function signup(username: string, email: string, password: string) {
    const res = await fetch(`${BACKEND_URL}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, email, password }),
    })

    const data = (await res.json().catch(() => ({}))) as { message?: string }

    if (!res.ok) {
      throw new Error(data.message ?? 'Sign up failed')
    }

    // Signup does not set a session cookie (only /login does), so log in to
    // establish the session and populate the user.
    await login(username, password)
  }

  async function logout() {
    await fetch(`${BACKEND_URL}/logout`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {})
    setUser(null)
    setIsAuthenticated(false)
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, loading, user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
