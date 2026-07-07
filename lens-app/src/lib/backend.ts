// Shared Fastify backend config. The `VITE_API_URL ?? 'http://localhost:3000'`
// pattern used to be copy-pasted per file; with the positions endpoints there are
// now several call sites, so it lives here. `credentials: 'include'` is always set
// so the httpOnly session cookie rides along.
export const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// Thin fetch wrapper that always sends the session cookie + JSON headers and
// unwraps the backend's { success, message } envelope. Throws Error(message) on a
// non-OK response or an explicit success:false, matching AuthContext's handling.
export async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean
    message?: string
  } & Record<string, unknown>
  if (!res.ok || data.success === false) {
    throw new Error(data.message ?? `Request failed (${res.status})`)
  }
  return data as T
}
