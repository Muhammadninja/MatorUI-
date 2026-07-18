/**
 * Notifications transport — the feed on the Notifications screen.
 *
 * Same shape as the other transports: an interface, a Mock impl (the bundled
 * feed), and an HTTP impl that calls the real endpoints through `apiClient`.
 * Gated per-domain by `shouldUseHttpTransport('notifications')`, so it can be
 * brought online independently once the backend + auth are verified.
 *
 * Backend surface (auth-gated):
 *   GET  /v1/notifications              → { items, next_cursor, unread_count }
 *   POST /v1/notifications/:id/read     → mark one read
 *   POST /v1/notifications/read-all     → mark all read
 *   POST /v1/notifications/test         → dev seeder ({ type, title, body })
 *
 * VERIFIED LIVE (2026-07-17) with a real OTP token + a seeded row. The item
 * shape is `{ id, type, title, body, read, read_at, created_at, ... }`; the
 * tolerant `mapRawNotification` below matches it (type→tone, read→unread,
 * created_at→relative time). Mark-read + read-all confirmed (unread_count
 * 2 → 1 → 0).
 */

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';

/** Drives the leading dot color on each feed row. */
export type NotificationTone = 'info' | 'value' | 'warning' | 'success' | 'accolade';

export type NotificationItem = {
  id: string;
  tone: NotificationTone;
  title: string;
  body: string;
  /** Pre-formatted relative time for display (e.g. "2m", "1h", "2d"). */
  time: string;
  unread: boolean;
};

export interface NotificationsTransport {
  list(signal?: AbortSignal): Promise<NotificationItem[]>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
}

// ── Bundled feed (mock + offline fallback) ───────────────────────────────

export const NOTIFICATIONS_SEED: NotificationItem[] = [
  { id: 'n1', tone: 'info', title: 'Out for delivery', body: 'Order MTR-482910 arrives today by 6 PM.', time: '2m', unread: true },
  { id: 'n2', tone: 'value', title: 'Price drop', body: 'Ceramic Brake Pads dropped to $64.99. You saved it.', time: '1h', unread: true },
  { id: 'n3', tone: 'warning', title: 'Back in stock', body: 'AGM Battery Group 35 is available again.', time: '5h', unread: false },
  { id: 'n4', tone: 'success', title: 'Order delivered', body: 'MTR-471002 was left at your front door.', time: '2d', unread: false },
  { id: 'n5', tone: 'accolade', title: 'Welcome to Mator Pro', body: 'Free 2-day shipping is now active on your account.', time: '1w', unread: false },
];

const MOCK_LATENCY_MS = 260;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

class MockNotificationsTransport implements NotificationsTransport {
  // Start empty so the screen shows the real "You're all caught up" empty
  // state instead of fake rows. Swap to `NOTIFICATIONS_SEED.map((n) => ({...n}))`
  // if you want the populated feed for a UI demo.
  private items: NotificationItem[] = [];

  async list(signal?: AbortSignal): Promise<NotificationItem[]> {
    await delay(MOCK_LATENCY_MS, signal);
    return this.items.map((n) => ({ ...n }));
  }

  async markRead(id: string): Promise<void> {
    await delay(120);
    this.items = this.items.map((n) => (n.id === id ? { ...n, unread: false } : n));
  }

  async markAllRead(): Promise<void> {
    await delay(120);
    this.items = this.items.map((n) => ({ ...n, unread: false }));
  }
}

// ── HTTP transport (tolerant mapping) ────────────────────────────────────

type RawNotification = {
  id: string;
  title?: string;
  body?: string;
  message?: string;
  type?: string;
  category?: string;
  read?: boolean;
  is_read?: boolean;
  unread?: boolean;
  created_at?: string;
  createdAt?: string;
};

type RawNotificationsResponse =
  | RawNotification[]
  | { items?: RawNotification[]; notifications?: RawNotification[] };

/** Map a backend notification `type`/`category` onto a display tone. */
function toTone(raw: RawNotification): NotificationTone {
  const key = (raw.type ?? raw.category ?? '').toLowerCase();
  if (/deliver|order|ship/.test(key)) return 'info';
  if (/price|deal|discount|save/.test(key)) return 'value';
  if (/stock|warn|alert/.test(key)) return 'warning';
  if (/complete|success|paid|payment/.test(key)) return 'success';
  if (/promo|market|reward|welcome|pro/.test(key)) return 'accolade';
  return 'info';
}

/** Whether the notification is unread, tolerant of read/is_read/unread. */
function isUnread(raw: RawNotification): boolean {
  if (typeof raw.unread === 'boolean') return raw.unread;
  if (typeof raw.is_read === 'boolean') return !raw.is_read;
  if (typeof raw.read === 'boolean') return !raw.read;
  return true;
}

/** Compact relative time ("2m", "3h", "5d", "2w") from an ISO timestamp. */
export function relativeTime(iso?: string): string {
  if (!iso) return '';
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return '';
  const diff = Math.max(0, Date.now() - ms);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const wk = Math.floor(day / 7);
  if (wk < 5) return `${wk}w`;
  const mo = Math.floor(day / 30);
  if (mo < 12) return `${mo}mo`;
  return `${Math.floor(day / 365)}y`;
}

function mapRawNotification(raw: RawNotification): NotificationItem {
  return {
    id: raw.id,
    tone: toTone(raw),
    title: raw.title ?? '',
    body: raw.body ?? raw.message ?? '',
    time: relativeTime(raw.created_at ?? raw.createdAt),
    unread: isUnread(raw),
  };
}

class HttpNotificationsTransport implements NotificationsTransport {
  async list(signal?: AbortSignal): Promise<NotificationItem[]> {
    const res = await apiClient.get<RawNotificationsResponse>('/v1/notifications', { signal });
    const arr = Array.isArray(res) ? res : res.items ?? res.notifications ?? [];
    return arr.map(mapRawNotification);
  }

  async markRead(id: string): Promise<void> {
    await apiClient.post(`/v1/notifications/${encodeURIComponent(id)}/read`);
  }

  async markAllRead(): Promise<void> {
    await apiClient.post('/v1/notifications/read-all');
  }
}

// ── Singleton ────────────────────────────────────────────────────────────

export const notificationsTransport: NotificationsTransport = shouldUseHttpTransport('notifications')
  ? new HttpNotificationsTransport()
  : new MockNotificationsTransport();

export function fetchNotifications(signal?: AbortSignal): Promise<NotificationItem[]> {
  return notificationsTransport.list(signal);
}
