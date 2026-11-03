import { useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useUserContext } from '@/contexts/user.context';

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
  markAllRead: () => Promise<boolean | null>;
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
  const markingAllRef = useRef(false);
  const { profile, isAuthenticated, isHydrating } = useUserContext();
  const ownerId = !isHydrating && isAuthenticated ? profile?.id ?? null : null;
  const ownerRef = useRef(ownerId);
  ownerRef.current = ownerId;
  const canRead = () => ownerId !== null && ownerRef.current === ownerId;
  const queryKey = [...NOTIFICATIONS_QUERY_KEY, ownerId] as const;

  const query = useQuery({
    queryKey,
    enabled: ownerId !== null,
    queryFn: ({ signal }) => notificationsTransport.list(signal),
  });

  const setCache = (updater: (items: NotificationItem[]) => NotificationItem[]) =>
    queryClient.setQueryData<NotificationItem[]>(queryKey, (prev) =>
      prev ? updater(prev) : prev,
    );

  const markReadMutation = useMutation({
    mutationFn: (id: string) => {
      if (!canRead()) throw new Error('Notification session changed');
      return notificationsTransport.markRead(id);
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationItem[]>(queryKey);
      setCache((items) => items.map((n) => (n.id === id ? { ...n, unread: false } : n)));
      return { previous, queryKey };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.queryKey, ctx.previous);
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () => {
      if (!canRead()) throw new Error('Notification session changed');
      return notificationsTransport.markAllRead();
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<NotificationItem[]>(queryKey);
      setCache((items) => items.map((n) => ({ ...n, unread: false })));
      return { previous, queryKey };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ctx.queryKey, ctx.previous);
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
    const notifications = (ownerId ? query.data ?? [] : []).filter(
      (n) => hasVisibleText(n.title) || hasVisibleText(n.body),
    );
    let state: NotificationsState;
    if (!ownerId) state = 'success';
    else if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else state = 'success';

    return {
      state,
      notifications,
      unreadCount: notifications.filter((n) => n.unread).length,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => canRead() ? query.refetch() : Promise.resolve(undefined),
      markRead: (id: string) => { if (canRead()) markReadMutation.mutate(id); },
      markAllRead: async () => {
        if (!canRead() || markingAllRef.current) return null;
        markingAllRef.current = true;
        try {
          await markAllMutation.mutateAsync();
          return canRead() ? true : null;
        } catch {
          return canRead() ? false : null;
        } finally {
          markingAllRef.current = false;
        }
      },
    };
  }, [query, markReadMutation, markAllMutation, ownerId, canRead]);
}

export default useNotifications;
