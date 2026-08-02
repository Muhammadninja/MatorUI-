import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  notificationsTransport,
  type NotificationItem,
} from '@/services/notifications-service';

/**
 * Notifications feed hook, backed by React Query. Same state machine as the
 * catalog/search hooks. `markRead` / `markAllRead` update the cache
 * optimistically and roll back on failure, so the UI stays snappy.
 */

export type NotificationsState = 'loading' | 'success' | 'error';

export type UseNotificationsValue = {
  state: NotificationsState;
  notifications: NotificationItem[];
  unreadCount: number;
  error: string | null;
  refresh: () => Promise<unknown>;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

export const NOTIFICATIONS_QUERY_KEY = ['notifications', 'list'] as const;

export function useNotifications(): UseNotificationsValue {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: NOTIFICATIONS_QUERY_KEY,
    queryFn: ({ signal }) => notificationsTransport.list(signal),
  });

  const setCache = (updater: (items: NotificationItem[]) => NotificationItem[]) =>
    queryClient.setQueryData<NotificationItem[]>(NOTIFICATIONS_QUERY_KEY, (prev) =>
      prev ? updater(prev) : prev,
    );

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsTransport.markRead(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationItem[]>(NOTIFICATIONS_QUERY_KEY);
      setCache((items) => items.map((n) => (n.id === id ? { ...n, unread: false } : n)));
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, ctx.previous);
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsTransport.markAllRead(),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATIONS_QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationItem[]>(NOTIFICATIONS_QUERY_KEY);
      setCache((items) => items.map((n) => ({ ...n, unread: false })));
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, ctx.previous);
    },
  });

  return useMemo<UseNotificationsValue>(() => {
    // Drop blank items — a notification with no title AND no body renders as a
    // bare colored dot with no content. Filtering them here also means a feed of
    // only-blank items collapses to the proper "all caught up" empty state, and
    // they never inflate the unread badge.
    const notifications = (query.data ?? []).filter(
      (n) => n.title.trim().length > 0 || n.body.trim().length > 0,
    );
    let state: NotificationsState;
    if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else state = 'success';

    return {
      state,
      notifications,
      unreadCount: notifications.filter((n) => n.unread).length,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => query.refetch(),
      markRead: (id: string) => markReadMutation.mutate(id),
      markAllRead: () => markAllMutation.mutate(),
    };
  }, [query, markReadMutation, markAllMutation]);
}

export default useNotifications;
