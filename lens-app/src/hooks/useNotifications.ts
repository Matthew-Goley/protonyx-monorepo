import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { notificationsApi, type Notification } from '@/api/notifications'
import { useAuth } from '@/contexts/AuthContext'

/**
 * The user's notification feed, read from the Fastify /notifications endpoint
 * (Postgres-backed, per user). Same shape as usePositions: keyed
 * ['notifications'], enabled only when authenticated, 5-minute staleTime.
 *
 * Deliberately NOT polled. Notifications are written by rare server-side events
 * (today only the waitlist Pro grant at signup), so an interval would spend
 * requests against the global 20/60s rate limit for nothing. The feed refreshes
 * on mount, on window focus once stale, and after a mark-read invalidation.
 */
export function useNotifications() {
  const { isAuthenticated } = useAuth()

  return useQuery<Notification[]>({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getNotifications,
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}

/**
 * Marks a specific set of notifications read, then invalidates ['notifications']
 * so the unread indicator clears. The rows stay in the list, they just render as
 * read, so invalidating cannot make anything disappear out from under the user.
 */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (ids: number[]) => notificationsApi.markRead(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
