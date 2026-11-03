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

/** A seller's quote surfaced inside a `sourcing_offer` notification (from `data`). */
export type SourcingOfferPayload = {
  offerId?: string;
  ticketId?: string;
  partName?: string | null;
  /** The vehicle the customer asked the part for (chat-extracted), for display. */
  vehicleBrand?: string | null;
  vehicleModel?: string | null;
  price?: number;
  currency?: string;
  condition?: string;
  availability?: string;
  etaDays?: number | null;
  note?: string | null;
  imageUrl?: string | null;
  imagesCount?: number;
  sellerUsername?: string | null;
};

export type NotificationItem = {
  id: string;
  /** Backend notification type (lowercased), e.g. "sourcing_offer". */
  type?: string;
  tone: NotificationTone;
  title: string;
  body: string;
  /** Pre-formatted relative time (e.g. "2m", "1h", "2d"). */
  time: string;
  /** ISO timestamp from the backend; the feed localizes and groups by it. */
  createdAt?: string;
  unread: boolean;
  /** Where a tap on the row should route (backend `deeplink_path`). */
  deeplinkPath?: string | null;
  /** Structured offer, present on `sourcing_offer` rows — drives the found-part card. */
  offer?: SourcingOfferPayload;
  /** Order id from `data.order_id` on order-related rows (order_status_changed /
   *  order_paid) — the feed taps through to `/track-order` with it. */
  orderId?: string;
  /** Lowercased backend order status from `data.status` (e.g. "delivered") —
   *  the feed renders a LOCALIZED label from it instead of the backend's copy. */
  orderStatus?: string;
  /** Vehicle id from `data.vehicle_id` on `vehicle_status_updated` rows. */
  vehicleId?: string;
};

export interface NotificationsTransport {
  list(signal?: AbortSignal): Promise<NotificationItem[]>;
  markRead(id: string): Promise<void>;
  markAllRead(): Promise<void>;
}

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
  // Always empty — offline/mock has no fabricated notifications, so the screen
  // shows the real "You're all caught up" empty state. Real notifications only
  // ever come from the backend (HTTP transport).
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
  data?: Record<string, unknown> | null;
  deeplink_path?: string | null;
  deeplinkPath?: string | null;
};

type RawNotificationsResponse =
  | RawNotification[]
  | { items?: RawNotification[]; notifications?: RawNotification[] };

/** Map a backend notification `type`/`category` onto a display tone. */
function toTone(raw: RawNotification): NotificationTone {
  const key = (raw.type ?? raw.category ?? '').toLowerCase();
  if (/sourc|offer|found/.test(key)) return 'success';
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

export function mapRawNotification(raw: RawNotification): NotificationItem {
  const type = raw.type?.toLowerCase();
  const item: NotificationItem = {
    id: raw.id,
    type,
    tone: toTone(raw),
    title: raw.title ?? '',
    body: raw.body ?? raw.message ?? '',
    time: relativeTime(raw.created_at ?? raw.createdAt),
    createdAt: raw.created_at ?? raw.createdAt,
    unread: isUnread(raw),
    deeplinkPath: raw.deeplink_path ?? raw.deeplinkPath ?? null,
  };
  // A found-part offer carries its structured payload in `data`; surface it so
  // the feed can render the rich card (image, price, condition).
  if (type === 'sourcing_offer' && raw.data && typeof raw.data === 'object') {
    item.offer = raw.data as SourcingOfferPayload;
  }
  // Order rows carry `{ order_id, status }` in `data`; surface both so the feed
  // can deep-link to the order-status screen and render a localized status word
  // (the backend body embeds the raw English status, e.g. "delivered").
  if ((type === 'order_status_changed' || type === 'order_paid') && raw.data && typeof raw.data === 'object') {
    const d = raw.data as { order_id?: unknown; status?: unknown };
    if (typeof d.order_id === 'string') item.orderId = d.order_id;
    if (typeof d.status === 'string') item.orderStatus = d.status;
  }
  if (type === 'vehicle_status_updated' && raw.data && typeof raw.data === 'object') {
    const d = raw.data as { vehicle_id?: unknown };
    if (typeof d.vehicle_id === 'string') item.vehicleId = d.vehicle_id;
  }
  return item;
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

// ── Push-device registration ───────────────────────────────────────────────
//
// Registers this install's Expo push token with the backend (`POST /v1/devices/
// register`) so server-sent push — order/delivery status updates emitted by the
// admin console, etc. — can reach the device. Idempotent per (user, install_id).
// No-op on mock/offline (`notifications` domain off) so it never throws there.

export type RegisterDeviceInput = {
  /** Stable per-install id (services/device-id.ts). */
  installId: string;
  platform: 'ios' | 'android';
  /** Expo push token; may be null if permission was denied or unavailable. */
  expoPushToken?: string | null;
  permissionsGranted?: boolean;
  osVersion?: string;
  appVersion?: string;
  locale?: string;
  timezone?: string;
};

export async function registerDevice(input: RegisterDeviceInput): Promise<void> {
  if (!shouldUseHttpTransport('notifications')) return;
  await apiClient.post('/v1/devices/register', {
    install_id: input.installId,
    platform: input.platform,
    expo_push_token: input.expoPushToken ?? undefined,
    permissions_granted: input.permissionsGranted,
    os_version: input.osVersion,
    app_version: input.appVersion,
    locale: input.locale,
    timezone: input.timezone,
  });
}
