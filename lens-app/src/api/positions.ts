import { type Position } from '@/api/lens'
import { backendFetch } from '@/lib/backend'

// Typed client for the Fastify positions endpoints. Positions are stored per user
// in Postgres (see ../../backend/src/routes/positions.ts); this replaces the old
// lens_positions cookie. All calls are cookie-authed via backendFetch.
export const positionsApi = {
  /** GET /positions - the user's holdings, oldest first. */
  getPositions(): Promise<Position[]> {
    return backendFetch<{ positions: Position[] }>('/positions').then((d) => d.positions)
  },

  /** PUT /positions - bulk replace (onboarding). Returns the saved set. */
  replacePositions(positions: Position[]): Promise<Position[]> {
    return backendFetch<{ positions: Position[] }>('/positions', {
      method: 'PUT',
      body: JSON.stringify({ positions }),
    }).then((d) => d.positions)
  },

  /** POST /positions - add one (upserts on ticker). */
  addPosition(position: Position): Promise<Position> {
    return backendFetch<{ position: Position }>('/positions', {
      method: 'POST',
      body: JSON.stringify(position),
    }).then((d) => d.position)
  },

  /** PATCH /positions/:ticker - edit share count (equity recomputed server-side). */
  updatePosition(ticker: string, shares: number): Promise<Position> {
    return backendFetch<{ position: Position }>(`/positions/${encodeURIComponent(ticker)}`, {
      method: 'PATCH',
      body: JSON.stringify({ shares }),
    }).then((d) => d.position)
  },

  /** DELETE /positions/:ticker - remove a holding. */
  deletePosition(ticker: string): Promise<void> {
    return backendFetch(`/positions/${encodeURIComponent(ticker)}`, {
      method: 'DELETE',
    }).then(() => undefined)
  },
}
