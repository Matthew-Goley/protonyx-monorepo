import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { QUERY_CACHE_KEY } from '@/lib/persist'
import { Login } from '@/pages/Login'
import { Onboard } from '@/pages/Onboard'
import { Dashboard } from '@/pages/Dashboard'
import { Analysis } from '@/pages/Analysis'
import { Profile } from '@/pages/Profile'
import { Settings } from '@/pages/Settings'
import { Success } from '@/pages/Success'
import { Commodity } from '@/pages/Commodity'

// gcTime must outlive the persister maxAge so restored entries aren't garbage
// collected before they can be rehydrated on the next load.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24h
    },
  },
})

// Persist the query cache to localStorage so a page refresh / return visit
// paints instantly from cache instead of re-running /analyze + /tickers/history.
// Bump `buster` to invalidate all persisted caches after a breaking cache-shape
// change.
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: QUERY_CACHE_KEY,
})

export default function App() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24h
        buster: 'v1',
        dehydrateOptions: {
          // Only persist successful queries — never cache an error/loading state.
          // Exclude ['positions'] so raw holdings are never written to localStorage
          // at rest; they are refetched from the server on load. The derived
          // ['lens-analysis'] result stays persisted (instant paint, by design) and
          // still matches after refetch because react-query hashes query keys by
          // value, so an identical positions array reproduces the same key.
          shouldDehydrateQuery: (query) =>
            query.state.status === 'success' && query.queryKey[0] !== 'positions',
        },
      }}
    >
      <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/onboard"
              element={
                <ProtectedRoute>
                  <Onboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analysis"
              element={
                <ProtectedRoute>
                  <Analysis />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/success"
              element={
                <ProtectedRoute>
                  <Success />
                </ProtectedRoute>
              }
            />
            <Route
              path="/commodity/:symbol"
              element={
                <ProtectedRoute>
                  <Commodity />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
      </ThemeProvider>
    </PersistQueryClientProvider>
  )
}
