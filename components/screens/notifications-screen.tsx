import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import {
  AlertCircle,
  Check,
  CheckCheck,
  Clock,
  CreditCard,
  Package,
  PackageCheck,
  RotateCcw,
  Truck,
  X,
  XCircle,
} from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable } from 'react-native';

import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useNotifications } from '@/hooks/use-notifications';
import { debugLog } from '@/services/debug-log';
import { toastService } from '@/services/toast-service';
import { ORDER_STATUS_MACHINE_I18N, formatOrderNo } from '@/services/orders-service';
import {
  acceptSourcingOffer,
  fetchSourcingOffer,
  rejectSourcingOffer,
  type SourcingOfferDeclineReason,
} from '@/services/sourcing-service';
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

function buildRejectReasons(t: TFn): { key: SourcingOfferDeclineReason; label: string }[] {
  return [
    { key: 'TOO_EXPENSIVE', label: t('sourcing.reasonTooExpensive') },
    { key: 'FOUND_CHEAPER', label: t('sourcing.reasonFoundCheaper') },
    { key: 'NO_LONGER_NEEDED', label: t('sourcing.reasonNoLongerNeeded') },
    { key: 'OTHER', label: t('sourcing.reasonOther') },
  ];
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
  canDecline,
  vehicle,
  onAdd,
  onReject,
}: {
  n: NotificationItem;
  tokens: Tokens;
  busy: boolean;
  added: boolean;
  /** Whether the decline (✕) affordance applies — hidden once the offer is
   *  declined/gone so a declined offer only offers "add to cart" again. */
  canDecline: boolean;
  /** "Chevrolet Cobalt" — the car the part was requested for (already formatted). */
  vehicle: string;
  onAdd: () => void;
  onReject: () => void;
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
        <AppText family="default" weight="bold" style={{ fontSize: 13.5, color: tokens.text }}>
          {capitalizeFirst(offer.partName) || n.title || t('sourcing.foundPart')}
        </AppText>
        {vehicle ? (
          <AppText family="default" style={{ fontSize: 11.5, color: tokens.textMuted }}>
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
            <AppText family="default" style={{ fontSize: 11.5, color: tokens.textMuted, flexShrink: 1 }}>
              {(priceText ? '· ' : '') + chips.join(' · ')}
            </AppText>
          ) : null}
        </AppView>
      </AppView>

      {/* Right-corner action: "Added" once in cart; otherwise a compact
          decline (✕) + Add-to-cart pair. */}
      {added ? (
        <AppView row align="center" gap={5} style={{ flexShrink: 0 }}>
          <Check size={15} color={tokens.success} />
          <AppText family="accent" weight="bold" style={{ fontSize: 12.5, color: tokens.success }}>
            {t('sourcing.inCart')}
          </AppText>
        </AppView>
      ) : (
        <AppView row align="center" gap={8} style={{ flexShrink: 0 }}>
          {/* Decline (✕) — opens the reason picker; hidden once declined/gone */}
          {canDecline ? (
            <AppPressableView
              onPress={onReject}
              disabled={busy}
              pressedOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('sourcing.declineOfferA11y')}
              center
              style={{ width: 34, height: 34, borderRadius: 999, borderWidth: 1, borderColor: tokens.divider }}
            >
              <X size={16} color={tokens.textMuted} />
            </AppPressableView>
          ) : null}

          {/* Add to cart */}
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
            style={{ paddingHorizontal: 14, paddingVertical: 8, backgroundColor: tokens.text }}
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
        </AppView>
      )}
    </AppView>
  );
}

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { state, notifications, unreadCount, markRead, markAllRead, refresh } = useNotifications();

  // Two groups, in the order anyone actually reads a feed: what is waiting,
  // then what has been seen. The backend sends no timestamp — only a
  // pre-formatted "2h" string — so grouping by day is not available; unread
  // vs read is the split the data can honestly support.
  const sections = useMemo(() => {
    const unread = notifications.filter((n) => n.unread);
    const read = notifications.filter((n) => !n.unread);
    // Labels appear only when both groups exist. A heading over the entire
    // list tells the reader nothing they cannot already see.
    const labelled = unread.length > 0 && read.length > 0;
    return [
      { key: 'unread', label: labelled ? t('notifications.sectionNew') : '', items: unread },
      { key: 'read', label: labelled ? t('notifications.sectionEarlier') : '', items: read },
    ].filter((s) => s.items.length > 0);
  }, [notifications, t]);
  const { refresh: refreshCart } = useCartContext();
  const rejectReasons = useMemo(() => buildRejectReasons(t), [t]);

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
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);

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
      } catch (err) {
        // A bad/renamed backend deeplink can't route — keep the user on the feed,
        // but LOG the offending path (dev console / EXPO_PUBLIC_DEBUG_API release
        // logs) so broken deeplinks are detectable instead of a silent dead tap.
        debugLog('nav', 'notification deeplink failed to route', {
          path: n.deeplinkPath,
          type: n.type,
          message: (err as Error)?.message,
        });
      }
    }
  };

  // Order-status rows: render a LOCALIZED title/body from `data` instead of the
  // backend copy, which embeds the raw English status word (e.g. "delivered").
  /**
   * Row copy. Order rows are rebuilt rather than printed as the backend sends
   * them: the status is lifted OUT of the sentence into a coloured eyebrow, and
   * the order number takes the headline. "Order status updated / Your order is
   * now Shipped" said the same thing twice and buried the only two facts that
   * matter — which order, and what happened to it.
   */
  const displayText = useCallback(
    (n: NotificationItem): { eyebrow: string; title: string; body: string } => {
      if (n.type !== 'order_status_changed') {
        return { eyebrow: '', title: n.title, body: n.body };
      }
      const statusLabel = n.orderStatus
        ? t(ORDER_STATUS_MACHINE_I18N[n.orderStatus] ?? ' ', { defaultValue: n.orderStatus })
        : '';
      return {
        eyebrow: statusLabel,
        title: n.orderId ? formatOrderNo(n.orderId) : t('notifications.orderStatusTitle'),
        body: statusLabel ? '' : n.body,
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

  const openReject = (n: NotificationItem) => {
    if (!n.offer?.offerId) return;
    setRejectTarget(n.offer.offerId);
    if (n.unread) markRead(n.id);
  };

  // One tap on a reason declines with it — no separate confirm step.
  const rejectWith = useCallback(
    async (reasonKey: SourcingOfferDeclineReason) => {
      const target = rejectTarget;
      if (!target || rejectBusy) return;
      setRejectBusy(true);
      try {
        await rejectSourcingOffer(target, reasonKey);
        setLiveStatus((s) => ({ ...s, [target]: 'DECLINED' }));
        toastService.info(t('sourcing.offerDeclined'));
      } catch (err) {
        if ((err as { status?: number })?.status === 404) {
          setLiveStatus((s) => ({ ...s, [target]: 'GONE' }));
          toastService.info(t('sourcing.offerUnavailable'));
        } else {
          toastService.danger(t('sourcing.declineFailed'));
        }
      } finally {
        setRejectBusy(false);
        setRejectTarget(null);
      }
    },
    [rejectTarget, rejectBusy, t],
  );

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader
        title={t('notifications.title')}
        fallbackHref="/profile"
        right={
          unreadCount > 0 ? (
            // Two checkmarks instead of the label. "Mark all read" runs to 32
            // characters in Uzbek ("Hammasini oʻqilgan deb belgilash") and ate
            // the header; the glyph is the same idea at a quarter the width,
            // with the sentence kept on the a11y layer.
            <AppPressableView
              testID="notifications-mark-all"
              onPress={handleMarkAll}
              pressedOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel={t('notifications.markAllReadA11y')}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              center
              rounded={999}
              colorName="backgroundSecondary"
              style={{ width: 32, height: 32 }}
            >
              <CheckCheck size={17} strokeWidth={2.4} color={tokens.text} />
            </AppPressableView>
          ) : undefined
        }
      />

      {state === 'loading' ? (
        <AppView flex={1} center>
          <WheelLoader size={28} color={tokens.textMuted} />
        </AppView>
      ) : notifications.length === 0 ? (
        // Sits above the optical centre, not the geometric one: dead-centre
        // reads as a placeholder screen, a little high reads as composed.
        <AppView flex={1} center px="xl" style={{ paddingBottom: 72 }}>
          {/* No glyph. A crossed-out bell is a picture of the thing that did
           *  not happen; the sentence already says it, and says it better. */}
          <AppView align="center" gap={6}>
            <AppText family="heading" weight="bold" style={{ fontSize: 19, color: tokens.text }}>
              {t('notifications.emptyTitle')}
            </AppText>
            <AppText
              family="default"
              style={{
                fontSize: 13.5,
                lineHeight: 19,
                color: tokens.textMuted,
                textAlign: 'center',
                maxWidth: 250,
              }}
            >
              {t('notifications.emptyBody')}
            </AppText>
          </AppView>
        </AppView>
      ) : (
        <AppScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 32, paddingHorizontal: 20 }}
          padding={0}
        >
          {sections.map(({ key, label, items }) => (
            <AppView key={key} style={{ marginBottom: 18 }}>
              {/* The label only earns its place when there is something to tell
               *  apart: with everything unread (or everything read) it would be
               *  a heading over the whole list, which says nothing. */}
              {label ? (
                <AppText
                  family="accent"
                  weight="bold"
                  transform="uppercase"
                  style={{
                    fontSize: 10.5,
                    letterSpacing: 1.1,
                    color: tokens.textMuted,
                    marginBottom: 10,
                  }}
                >
                  {label}
                </AppText>
              ) : null}
              {items.map((n) => {
            // Found-part offers act inline (add to cart) — no navigation.
            if (n.type === 'sourcing_offer' || n.offer) {
              const offerId = n.offer?.offerId ?? '';
              // Prefer the notification snapshot (instant, for new offers); fall
              // back to the value resolved from the offer detail (existing offers).
              const vehicle =
                capitalizeWords(
                  [n.offer?.vehicleBrand, n.offer?.vehicleModel].filter(Boolean).join(' '),
                ) || (liveVehicle[offerId] ?? '');
              const status = liveStatus[offerId];
              return (
                <SourcingOfferCard
                  key={n.id}
                  n={n}
                  tokens={tokens}
                  busy={busyOffer === offerId}
                  added={status === 'ACCEPTED'}
                  // Decline only applies to a live (SENT / not-yet-resolved) offer —
                  // once declined/expired/gone, the card just re-offers "add to cart".
                  canDecline={status === undefined || status === 'SENT'}
                  vehicle={vehicle}
                  onAdd={() => addToCart(n)}
                  onReject={() => openReject(n)}
                />
              );
            }
            const { eyebrow, title: rowTitle, body: rowBody } = displayText(n);
                // Colour carries the status now — there is no glyph. A tinted
                // disc with a truck in it was decoration; the word "Shipped"
                // in the same colour is the information, and it survives being
                // read aloud.
                const accent =
                  n.type === 'order_status_changed'
                    ? (orderStatusVisual(n.orderStatus, tokens)?.color ?? tokens.textMuted)
                    : tokens.brand;
                return (
                  <AppPressableView
                    key={n.id}
                    onPress={() => openNotification(n)}
                    androidRipple={false}
                    pressedOpacity={0.6}
                    accessibilityRole="button"
                    accessibilityLabel={`${eyebrow ? `${eyebrow}. ` : ''}${rowTitle}. ${n.unread ? t('notifications.unreadHint') : t('notifications.readHint')}`}
                    row
                    gap={12}
                    // Without this the inner Pressable shrinks to its content width, so
                    // the flex:1 content column collapses to ~0 and the row renders as a
                    // full-width divider with (near-)invisible text. fillContainer makes
                    // the Pressable fill the row so the content lays out at full width.
                    fillContainer
                    // Unread rows are carried by a filled card; read ones drop to a
                    // quiet row on a hairline. One state reads as "waiting for you",
                    // the other as archive, without either needing a badge to say so.
                    rounded={n.unread ? 16 : 0}
                    colorName={n.unread ? 'backgroundSecondary' : undefined}
                    style={{
                      paddingVertical: 13,
                      paddingHorizontal: n.unread ? 14 : 0,
                      marginBottom: n.unread ? 8 : 0,
                      borderBottomWidth: n.unread ? 0 : 1,
                      borderBottomColor: tokens.divider,
                    }}
                  >
                    {/* A 3px rail instead of an icon: it marks the row and
                     *  colours it by status without putting a picture of a
                     *  lorry next to every delivery. */}
                    {n.unread ? (
                      <AppView
                        rounded={999}
                        style={{ width: 3, alignSelf: 'stretch', backgroundColor: accent }}
                      />
                    ) : null}

                    <AppView style={{ flex: 1 }}>
                      <AppView row align="flex-start" justify="space-between" gap={10}>
                        <AppView style={{ flex: 1, gap: 3 }}>
                          {eyebrow ? (
                            <AppText
                              family="accent"
                              weight="bold"
                              transform="uppercase"
                              style={{ fontSize: 10.5, letterSpacing: 1, color: accent }}
                            >
                              {eyebrow}
                            </AppText>
                          ) : null}
                          <AppText
                            family="accent"
                            weight="bold"
                            style={{ fontSize: 14.5, color: tokens.text }}
                          >
                            {rowTitle}
                          </AppText>
                        </AppView>
                        <AppText
                          family="default"
                          style={{
                            fontSize: 11.5,
                            color: tokens.textMuted,
                            flexShrink: 0,
                            marginTop: 1,
                          }}
                        >
                          {n.time}
                        </AppText>
                      </AppView>
                      {rowBody ? (
                        <AppText
                          family="default"
                          style={{
                            fontSize: 13,
                            color: tokens.textMuted,
                            marginTop: 3,
                            lineHeight: 18,
                          }}
                        >
                          {rowBody}
                        </AppText>
                      ) : null}
                    </AppView>
                  </AppPressableView>
                );
              })}
            </AppView>
          ))}
        </AppScrollView>
      )}

      {/* Decline-reason picker — a small centered modal (no arrows). */}
      <Modal
        transparent
        animationType="fade"
        visible={rejectTarget !== null}
        onRequestClose={() => setRejectTarget(null)}
      >
        <AppView flex={1} center px="xl" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          {/* Backdrop — tap outside the card to dismiss. */}
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            onPress={() => setRejectTarget(null)}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
          <AppView
            rounded={20}
            style={{
              width: '100%',
              maxWidth: 320,
              backgroundColor: tokens.card ?? tokens.background,
              borderWidth: 1,
              borderColor: tokens.divider,
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 6,
            }}
          >
            <AppText family="heading" weight="bold" style={{ fontSize: 15.5, color: tokens.text, marginBottom: 2 }}>
              {t('sourcing.declineReasonTitle')}
            </AppText>
            {rejectReasons.map((r, i) => (
              <AppPressableView
                key={r.key}
                onPress={() => rejectWith(r.key)}
                disabled={rejectBusy}
                pressedOpacity={0.55}
                style={{
                  paddingVertical: 12,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: tokens.divider,
                  opacity: rejectBusy ? 0.5 : 1,
                }}
              >
                <AppText family="default" weight="semibold" style={{ fontSize: 14.5, color: tokens.text }}>
                  {r.label}
                </AppText>
              </AppPressableView>
            ))}
          </AppView>
        </AppView>
      </Modal>
    </AppView>
  );
}
