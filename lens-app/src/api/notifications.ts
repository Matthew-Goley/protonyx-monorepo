import { backendFetch } from '@/lib/backend'

/**
 * One row of the Fastify `notifications` table (see ../../backend/src/db.ts).
 * `created_at` is a Postgres TIMESTAMP, which arrives over the wire as an ISO
 * string, not a Date. `type` is a free-text discriminator ('waitlist_pro_grant'
 * is the only value written today) kept open so new kinds need no client change.
 */
export interface Notification {
  id: number
  type: string
  message: string
  is_read: boolean
  created_at: string
}

// Typed client for the Fastify notifications endpoints, same shape as
// @/api/positions: every call is cookie-authed through backendFetch, which
// unwraps the { success, message } envelope and throws Error(message) on failure.
export const notificationsApi = {
  /** GET /notifications - the user's notifications, newest first (capped at 50). */
  getNotifications(): Promise<Notification[]> {
    return backendFetch<{ notifications: Notification[] }>('/notifications').then(
      (d) => d.notifications,
    )
  },

  /**
   * PATCH /notifications/read - bulk mark-read, returning how many rows changed.
   * Pass the exact ids on screen so a notification that lands after the list was
   * fetched is never marked read without having been seen. Omit `ids` to mark
   * every unread row (nothing calls that yet; it backs a future "mark all read").
   */
  markRead(ids?: number[]): Promise<number> {
    return backendFetch<{ updated: number }>('/notifications/read', {
      method: 'PATCH',
      body: JSON.stringify(ids ? { ids } : {}),
    }).then((d) => d.updated)
  },
}
