// Shared Fastify backend config. The `VITE_API_URL ?? 'http://localhost:3000'`
// pattern used to be copy-pasted per file; with the positions endpoints there are
// now several call sites, so it lives here. `credentials: 'include'` is always set
// so the httpOnly session cookie rides along.
//
// All app config is env-driven (see .env.example); the lens-api equivalents are
// VITE_LENS_API_URL / VITE_LENS_API_KEY in @/api/lens. This one keeps a localhost
// fallback because local dev points at the Fastify dev server by default.
export const BACKEND_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'

// Thin fetch wrapper that always sends the session cookie and unwraps the
// backend's { success, message } envelope. Throws Error(message) on a non-OK
// response or an explicit success:false, matching AuthContext's handling.
//
// Content-Type is declared ONLY when there is actually a body. Fastify parses the
// body before the route's preHandler, and a request that announces
// application/json while sending nothing is rejected outright with
// 400 FST_ERR_CTP_EMPTY_JSON_BODY ("Body cannot be empty when content-type is set
// to 'application/json'") before auth or the handler ever runs. Setting the header
// unconditionally therefore broke every bodyless call - in practice
// DELETE /positions/:ticker, the app's only one, which is why the manage-holdings
// delete button silently did nothing. Keep this conditional when adding calls.
export async function backendFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...((init?.headers as Record<string, string> | undefined) ?? {}),
  }
  if (init?.body !== undefined && init.body !== null && !('Content-Type' in headers)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${BACKEND_URL}${path}`, {
    credentials: 'include',
    ...init,
    headers,
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
