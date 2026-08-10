import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import {
  AlertCircle,
  BellOff,
  Check,
  Clock,
  CreditCard,
  Package,
  PackageCheck,
  RotateCcw,
  Truck,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useNotifications } from '@/hooks/use-notifications';
import { toastService } from '@/services/toast-service';
import { ORDER_STATUS_MACHINE_I18N } from '@/services/orders-service';
import { acceptSourcingOffer, fetchSourcingOffer } from '@/services/sourcing-service';
import type { NotificationItem } from '@/services/notifications-service';

type Tokens = ReturnType<typeof useThemeContext>['tokens'];

type TFn = (key: string) => string;

function buildConditionLabels(t: TFn): Record<string, string> {
  return {
    NEW: t('sourcing.conditionNewShort'),
    USED: t('sourcing.conditionUsedShort'),
    OEM: t('sourcing.conditionOemShort'),
    AFTERMARKET: t('sourcing.conditionAftermarketShort'),
  };
}
function buildAvailabilityLabels(t: TFn): Record<string, string> {
  return {
    IN_STOCK: t('sourcing.availabilityInStockShort'),
    ON_ORDER: t('sourcing.availabilityOnOrderShort'),
  };
}

/** 250000 → "250 000 сум". */
function formatSom(price?: number): string | null {
  if (typeof price !== 'number' || !Number.isFinite(price)) return null;
  return `${price.toLocaleString('ru-RU').replace(/ /g, ' ')} сум`;
}

/** Display polish for the part name, which is the raw user query from chat
 *  (e.g. "salon filtri"): uppercase the first letter only, leaving the rest —
 *  multi-word RU/UZ names shouldn't be title-cased. Data is left untouched. */
function capitalizeFirst(s?: string | null): string {
  const name = s?.trim();
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/** Title-case each word — brand/model are proper nouns ("chevrolet cobalt" →
 *  "Chevrolet Cobalt"), unlike the free-text part name. */
function capitalizeWords(s?: string | null): string {
  const v = s?.trim();
  if (!v) return '';
  return v.replace(/\S+/g, (w) => w.charAt(0).toUpperCase() + w.slice(1));
}

type LucideIcon = typeof Check;

/** A colored icon per order status (from `data.status`) so an order-update row
 *  reads at a glance: green ✓ delivered/paid, red ✕ cancelled, blue in-transit,
 *  amber pending/refunded. Returns null for non-order or unknown statuses. */
function orderStatusVisual(
  status: string | undefined,
  tokens: Tokens,
): { Icon: LucideIcon; color: string } | null {
  switch (status) {
    case 'delivered':
      return { Icon: PackageCheck, color: tokens.success };
    case 'paid':
      return { Icon: CreditCard, color: tokens.success };
    case 'shipped':
      return { Icon: Truck, color: tokens.info };
    case 'processing':
      return { Icon: Package, color: tokens.info };
    case 'pending_payment':
      return { Icon: Clock, color: tokens.warning };
    case 'refunded':
      return { Icon: RotateCcw, color: tokens.warning };
    case 'cancelled':
      return { Icon: XCircle, color: tokens.error };
    case 'expired':
      return { Icon: AlertCircle, color: tokens.textMuted };
    default:
      return null;
  }
}

/**
 * Found-part offer row — a COMPACT product-style row for a `sourcing_offer`.
 * Thumb (only when a photo exists) + name/price on the left, and a single
 * right-corner action: "Added" once it's in the cart, otherwise an "Add to
 * cart" button (shown for every non-added state — fresh, declined, expired —
 * so the customer can always (re)add). No navigation away from the feed.
 */
function SourcingOfferCard({
  n,
  tokens,
  busy,
  added,
  vehicle,
  onAdd,
}: {
  n: NotificationItem;
  tokens: Tokens;
  busy: boolean;
  added: boolean;
  /** "Chevrolet Cobalt" — the car the part was requested for (already formatted). */
  vehicle: string;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const conditionLabels = useMemo(() => buildConditionLabels(t), [t]);
  const availabilityLabels = useMemo(() => buildAvailabilityLabels(t), [t]);
  const offer = n.offer ?? {};
  const priceText = formatSom(offer.price);
  const chips = [conditionLabels[offer.condition ?? ''], availabilityLabels[offer.availability ?? '']].filter(
    (c): c is string => Boolean(c),
  );

  return (
    <AppView
      row
      align="center"
      gap={10}
      style={{
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: tokens.divider,
      }}
    >
      {offer.imageUrl ? (
        <Image
          source={{ uri: offer.imageUrl }}
          style={{ width: 44, height: 44, borderRadius: 10 }}
          contentFit="cover"
          transition={150}
        />
      ) : null}

      {/* Name + price/condition — left, flexes to fill */}
      <AppView style={{ flex: 1 }} gap={2}>
        <AppText family="default" weight="bold" numberOfLines={1} style={{ fontSize: 13.5, color: tokens.text }}>
          {capitalizeFirst(offer.partName) || n.title || t('sourcing.foundPart')}
        </AppText>
        {vehicle ? (
          <AppText family="default" numberOfLines={1} style={{ fontSize: 11.5, color: tokens.textMuted }}>
            {t('sourcing.forVehicle', { vehicle })}
          </AppText>
        ) : null}
        <AppView row align="center" gap={6}>
          {priceText ? (
            <AppText family="accent" weight="bold" style={{ fontSize: 14, color: tokens.brand, flexShrink: 0 }}>
              {priceText}
            </AppText>
          ) : null}
          {chips.length ? (
            <AppText family="default" numberOfLines={1} style={{ fontSize: 11.5, color: tokens.textMuted, flexShrink: 1 }}>
              {(priceText ? '· ' : '') + chips.join(' · ')}
            </AppText>
          ) : null}
        </AppView>
      </AppView>

      {/* Right-corner action: Added (in cart) OR Add to cart */}
      {added ? (
        <AppView row align="center" gap={5} style={{ flexShrink: 0 }}>
          <Check size={15} color={tokens.success} />
          <AppText family="accent" weight="bold" style={{ fontSize: 12.5, color: tokens.success }}>
            {t('sourcing.inCart')}
          </AppText>
        </AppView>
      ) : (
        <AppPressableView
          onPress={onAdd}
          disabled={busy}
          pressedOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={t('sourcing.addToCartA11y')}
          row
          align="center"
          gap={5}
          rounded={999}
          style={{ flexShrink: 0, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: tokens.text }}
        >
          {busy ? (
            <WheelLoader size={14} color={tokens.background} />
          ) : (
            <>
              <MaterialIcons name="add-shopping-cart" size={14} color={tokens.background} />
              <AppText family="accent" weight="bold" style={{ fontSize: 12, color: tokens.background }}>
                {t('sourcing.toCart')}
              </AppText>
            </>
          )}
        </AppPressableView>
      )}
    </AppView>
  );
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { state, notifications, unreadCount, markRead, markAllRead, refresh } = useNotifications();
  const { refresh: refreshCart } = useCartContext();

  // offerId → LIVE status ('SENT'|'ACCEPTED'|'DECLINED'|'EXPIRED'|'GONE').
  // Fetched from the server on load so a card reflects reality (already bought /
  // declined / expired / deleted), and updated optimistically after an action —
  // not just this session's taps.
  const [liveStatus, setLiveStatus] = useState<Record<string, string>>({});
  // offerId → "Chevrolet Cobalt", resolved from the offer detail on load. Lets
  // EXISTING offers show the requested car even though the notification payload
  // (a snapshot) predates the vehicle fields.
  const [liveVehicle, setLiveVehicle] = useState<Record<string, string>>({});
  const [busyOffer, setBusyOffer] = useState<string | null>(null);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useFocusEffect(
    useCallback(() => {
      void refreshRef.current();
    }, []),
  );

  // Resolve the live status of every offer notification. Reads current statuses
  // through a ref so the effect only re-runs when the set of offer ids changes,
  // and fetches only ids not yet resolved.
  const offerIds = notifications
    .map((n) => ((n.type === 'sourcing_offer' || n.offer) ? n.offer?.offerId : undefined))
    .filter((id): id is string => Boolean(id));
  const offerIdsKey = offerIds.join(',');
  const liveStatusRef = useRef(liveStatus);
  liveStatusRef.current = liveStatus;
  useEffect(() => {
    const pending = offerIds.filter((id) => liveStatusRef.current[id] === undefined);
    if (pending.length === 0) return;
    let cancelled = false;
    void (async () => {
      const results = await Promise.allSettled(pending.map((id) => fetchSourcingOffer(id)));
      if (cancelled) return;
      const next: Record<string, string> = {};
      const vehicles: Record<string, string> = {};
      results.forEach((r, i) => {
        const id = pending[i];
        next[id] =
          r.status === 'fulfilled'
            ? r.value.status
            : (r.reason as { status?: number })?.status === 404
              ? 'GONE'
              : 'SENT'; // network error → assume actionable; retries next open
        if (r.status === 'fulfilled') {
          const v = capitalizeWords(
            [r.value.vehicleBrand, r.value.vehicleModel].filter(Boolean).join(' '),
          );
          if (v) vehicles[id] = v;
        }
      });
      setLiveStatus((prev) => ({ ...prev, ...next }));
      if (Object.keys(vehicles).length) setLiveVehicle((prev) => ({ ...prev, ...vehicles }));
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerIdsKey]);

  const handleMarkAll = () => {
    markAllRead();
    toastService.success(t('notifications.allMarkedRead'));
  };

  // Regular (non-offer) notifications: mark read + navigate.
  const openNotification = (n: NotificationItem) => {
    if (n.unread) markRead(n.id);
    // Order-STATUS-change rows go to the order-status (track-order) screen. The
    // backend's deeplink for these points at the cart's order-confirmation,
    // which is the wrong destination — the order id in `data` is the real
    // target. Other order rows (e.g. order_paid) keep their own deeplink.
    if (n.type === 'order_status_changed' && n.orderId) {
      router.push(`/track-order?orderId=${encodeURIComponent(n.orderId)}` as never);
      return;
    }
    if (n.deeplinkPath) {
      try {
        router.push(n.deeplinkPath as never);
      } catch {
        // Unknown/relative deeplink — leave the user on the feed.
      }
    }
  };

  // Order-status rows: render a LOCALIZED title/body from `data` instead of the
  // backend copy, which embeds the raw English status word (e.g. "delivered").
  const displayText = useCallback(
    (n: NotificationItem): { title: string; body: string } => {
      if (n.type !== 'order_status_changed') return { title: n.title, body: n.body };
      const statusLabel = n.orderStatus
        ? t(ORDER_STATUS_MACHINE_I18N[n.orderStatus] ?? ' ', { defaultValue: n.orderStatus })
        : '';
      return {
        title: t('notifications.orderStatusTitle'),
        body: statusLabel ? t('notifications.orderStatusBody', { status: statusLabel }) : n.body,
      };
    },
    [t],
  );

  const addToCart = useCallback(
    async (n: NotificationItem) => {
      const offerId = n.offer?.offerId;
      if (!offerId) return;
      setBusyOffer(offerId);
      try {
        await acceptSourcingOffer(offerId);
        await refreshCart();
        setLiveStatus((s) => ({ ...s, [offerId]: 'ACCEPTED' }));
        if (n.unread) markRead(n.id);
        toastService.success(t('sourcing.addedToCart'));
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 409) {
          setLiveStatus((s) => ({ ...s, [offerId]: 'ACCEPTED' }));
          toastService.info(t('sourcing.alreadyInCart'));
        } else if (status === 404) {
          // Offer was deleted (e.g. its ticket removed) → stale notification.
          setLiveStatus((s) => ({ ...s, [offerId]: 'GONE' }));
          toastService.info(t('sourcing.offerUnavailable'));
        } else {
          toastService.danger(t('sourcing.addToCartFailed'));
        }
      } finally {
        setBusyOffer(null);
      }
    },
    [refreshCart, markRead, t],
  );

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader
        title={t('notifications.title')}
        fallbackHref="/profile"
        right={
          unreadCount > 0 ? (
            <AppPressableView
              onPress={handleMarkAll}
              pressedOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={t('notifications.markAllReadA11y')}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppText family="accent" weight="bold" style={{ fontSize: 12.5, color: tokens.text }}>
                {t('notifications.markAllRead')}
              </AppText>
            </AppPressableView>
          ) : undefined
        }
      />

      {state === 'loading' ? (
        <AppView flex={1} center>
          <WheelLoader size={28} color={tokens.textMuted} />
        </AppView>
      ) : notifications.length === 0 ? (
        <AppView flex={1} center px="xl" gap={12}>
          <BellOff size={30} strokeWidth={2} color={tokens.textMuted} />
          <AppView align="center" gap={4}>
            <AppText family="heading" weight="bold" style={{ fontSize: 17, color: tokens.text }}>
              {t('notifications.emptyTitle')}
            </AppText>
            <AppText
              family="default"
              style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}
            >
              {t('notifications.emptyBody')}
            </AppText>
          </AppView>
        </AppView>
      ) : (
        <AppScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 0, paddingBottom: 32, paddingHorizontal: 20 }}
          padding={0}
        >
          {notifications.map((n) => {
            // Found-part offers act inline (add to cart) — no navigation.
            if (n.type === 'sourcing_offer' || n.offer) {
              const offerId = n.offer?.offerId ?? '';
              // Prefer the notification snapshot (instant, for new offers); fall
              // back to the value resolved from the offer detail (existing offers).
              const vehicle =
                capitalizeWords(
                  [n.offer?.vehicleBrand, n.offer?.vehicleModel].filter(Boolean).join(' '),
                ) || (liveVehicle[offerId] ?? '');
              return (
                <SourcingOfferCard
                  key={n.id}
                  n={n}
                  tokens={tokens}
                  busy={busyOffer === offerId}
                  added={liveStatus[offerId] === 'ACCEPTED'}
                  vehicle={vehicle}
                  onAdd={() => addToCart(n)}
                />
              );
            }
            const { title: rowTitle, body: rowBody } = displayText(n);
            const statusVisual =
              n.type === 'order_status_changed' ? orderStatusVisual(n.orderStatus, tokens) : null;
            return (
              <AppPressableView
                key={n.id}
                onPress={() => openNotification(n)}
                androidRipple={false}
                pressedOpacity={n.unread ? 0.6 : 1}
                accessibilityRole="button"
                accessibilityLabel={`${rowTitle}. ${n.unread ? t('notifications.unreadHint') : t('notifications.readHint')}`}
                row
                gap={12}
                // Without this the inner Pressable shrinks to its content width, so
                // the flex:1 content column collapses to ~0 and the row renders as a
                // full-width divider with (near-)invisible text. fillContainer makes
                // the Pressable fill the row so the content lays out at full width.
                fillContainer
                style={{
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: tokens.divider,
                }}
              >
                <AppView style={{ flex: 1 }}>
                  <AppView row align="center" justify="space-between" gap={8}>
                    <AppView row align="center" gap={9} style={{ flex: 1 }}>
                      {/* Order rows get a colored status icon badge; other rows
                          show the small leading unread dot. */}
                      {statusVisual ? (
                        <AppView
                          center
                          style={{
                            width: 30,
                            height: 30,
                            borderRadius: 999,
                            backgroundColor: `${statusVisual.color}22`,
                            flexShrink: 0,
                          }}
                        >
                          <statusVisual.Icon size={16} color={statusVisual.color} />
                        </AppView>
                      ) : n.unread ? (
                        <AppView
                          style={{ width: 7, height: 7, borderRadius: 999, backgroundColor: tokens.brand, flexShrink: 0 }}
                        />
                      ) : null}
                      <AppText
                        family="accent"
                        weight="bold"
                        numberOfLines={2}
                        style={{ fontSize: 14.5, color: tokens.text, flexShrink: 1 }}
                      >
                        {rowTitle}
                      </AppText>
                    </AppView>
                    <AppText family="default" style={{ fontSize: 11.5, color: tokens.textMuted, flexShrink: 0 }}>
                      {n.time}
                    </AppText>
                  </AppView>
                  {rowBody ? (
                    <AppText
                      family="default"
                      style={{ fontSize: 13, color: tokens.textMuted, marginTop: 3, lineHeight: 18 }}
                    >
                      {rowBody}
                    </AppText>
                  ) : null}
                </AppView>
              </AppPressableView>
            );
          })}
        </AppScrollView>
      )}
    </AppView>
  );
}
