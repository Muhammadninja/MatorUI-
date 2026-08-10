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

// Codepoints that render nothing yet survive `String.prototype.trim()` (which
// strips standard whitespace only): ZWSP/ZWNJ/ZWJ (0x200B–0x200D), LRM/RLM
// (0x200E–0x200F), word-joiner (0x2060), BOM/zero-width no-break space (0xFEFF).
const ZERO_WIDTH_CODES = new Set([0x200b, 0x200c, 0x200d, 0x200e, 0x200f, 0x2060, 0xfeff]);

/** True when a string has at least one visible glyph — ignores standard
 *  whitespace AND zero-width/format characters. Guards against backend
 *  notifications whose title/body are only invisible characters, which paint an
 *  empty bordered row in the feed. */
function hasVisibleText(s: string | undefined | null): boolean {
  if (!s) return false;
  for (const ch of s) {
    if (ZERO_WIDTH_CODES.has(ch.codePointAt(0) ?? 0)) continue;
    if (ch.trim().length > 0) return true;
  }
  return false;
}

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
    // Drop blank items — a notification with no visible title AND no visible body
    // renders as an empty bordered row (or a bare dot) with no content. Filtering
    // them here also collapses a feed of only-blank items to the proper "all
    // caught up" empty state, and they never inflate the unread badge.
    //
    // `hasVisibleText` strips zero-width / directional format characters before
    // trimming: a title made only of zero-width spaces survives a plain `.trim()`
    // (which removes standard whitespace only) yet paints an empty line — exactly
    // the blank rows seen in the feed between real offer cards.
    const notifications = (query.data ?? []).filter(
      (n) => hasVisibleText(n.title) || hasVisibleText(n.body),
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
