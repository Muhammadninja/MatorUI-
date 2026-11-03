import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { Bell, Check, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable } from 'react-native';

import {
  localizedNotificationTime,
  notificationDayGroup,
  type NotificationDayGroup,
} from '@/components/screens-components/notifications/notification-time';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useCartContext } from '@/contexts/cart.context';
import { useLanguageContext } from '@/contexts/language.context';
import { useThemeContext } from '@/contexts/theme.context';
import useGarage from '@/hooks/use-garage';
import { useNotifications } from '@/hooks/use-notifications';
import { formatCurrency } from '@/services/cart-math';
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

/** 250000 → "250 000 сум", in the active language. */
function formatSom(price?: number): string | null {
  if (typeof price !== 'number' || !Number.isFinite(price)) return null;
  return formatCurrency(price);
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

/** The car's name from the backend's "<name> maʼlumotlari yangilandi." sentence,
 *  the only place it survives once the vehicle has left the garage. */
function vehicleNameFromBody(body: string): string | null {
  const name = body.match(/^(.+?)\s+ma[ʼ'’`]lumotlari yangilandi\.?\s*$/)?.[1]?.trim();
  return name || null;
}

/** Dividers start at the 16-unit gutter the row's text sits on. */
const ROW_DIVIDER_INSET = 16;

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
  const chips = [
    conditionLabels[offer.condition ?? ''],
    availabilityLabels[offer.availability ?? ''],
  ].filter((c): c is string => Boolean(c));

  return (
    <AppView row align="center" gap="md" style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
      {offer.imageUrl ? (
        <Image
          source={{ uri: offer.imageUrl }}
          style={{ width: 48, height: 48, borderRadius: 8 }}
          contentFit="cover"
          transition={150}
        />
      ) : null}

      {/* Name + price/condition — left, flexes to fill */}
      <AppView style={{ flex: 1, minWidth: 0 }} gap={2}>
        <AppText
          family="default"
          weight="medium"
          style={{ fontSize: 15, lineHeight: 20, color: tokens.text }}
        >
          {capitalizeFirst(offer.partName) || n.title || t('sourcing.foundPart')}
        </AppText>
        {vehicle ? (
          <AppText
            family="default"
            style={{ fontSize: 12, lineHeight: 16, color: tokens.textMuted }}
          >
            {t('sourcing.forVehicle', { vehicle })}
          </AppText>
        ) : null}
        <AppView row wrap align="center" gap={6}>
          {priceText ? (
            <AppText
              family="accent"
              weight="bold"
              style={{ fontSize: 14, lineHeight: 20, color: tokens.text, flexShrink: 0 }}
            >
              {priceText}
            </AppText>
          ) : null}
          {chips.length ? (
            <AppText
              family="default"
              style={{ fontSize: 12, lineHeight: 16, color: tokens.textMuted, flexShrink: 1 }}
            >
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
          <AppText family="accent" weight="bold" style={{ fontSize: 12, color: tokens.success }}>
            {t('sourcing.inCart')}
          </AppText>
        </AppView>
      ) : (
        <AppView row align="center" gap={4} style={{ flexShrink: 0 }}>
          {/* Decline (✕) — opens the reason picker; hidden once declined/gone */}
          {canDecline ? (
            <AppPressableView
              onPress={onReject}
              disabled={busy}
              pressedOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={t('sourcing.declineOfferA11y')}
              center
              style={{ width: 48, height: 48 }}
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
            rounded={12}
            style={{ minHeight: 48, paddingHorizontal: 12, backgroundColor: tokens.brand }}
          >
            {busy ? (
              <WheelLoader size={14} color={tokens.onBrand} />
            ) : (
              <>
                <MaterialIcons name="add-shopping-cart" size={14} color={tokens.onBrand} />
                <AppText
                  family="accent"
                  weight="semibold"
                  style={{ fontSize: 14, lineHeight: 20, color: tokens.onBrand }}
                >
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

  const { language } = useLanguageContext();
  // Lets "vehicle updated" rows name the car: the notification only carries its id.
  const { vehicles } = useGarage();

  // Calendar groups from real timestamps, in the backend's order within each.
  const sections = useMemo(() => {
    const labels: Record<NotificationDayGroup, string> = {
      today: t('notifications.sectionToday'),
      yesterday: t('notifications.sectionYesterday'),
      earlier: t('notifications.sectionEarlier'),
    };
    return (['today', 'yesterday', 'earlier'] as const)
      .map((key) => ({
        key,
        label: labels[key],
        items: notifications.filter((n) => notificationDayGroup(n.createdAt) === key),
      }))
      .filter((s) => s.items.length > 0);
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
    .map((n) => (n.type === 'sourcing_offer' || n.offer ? n.offer?.offerId : undefined))
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

  const handleMarkAll = async () => {
    const confirmed = await markAllRead();
    if (confirmed === true) toastService.success(t('notifications.allMarkedRead'));
    else if (confirmed === false) toastService.danger(t('notifications.markReadError'));
  };

  // The garage row a vehicle notification is about; null once the car is gone.
  const vehicleFor = useCallback(
    (n: NotificationItem) => vehicles.find((v) => v.id === n.vehicleId) ?? null,
    [vehicles],
  );

  /** A row is tappable only when there is somewhere real for it to go. */
  const hasDestination = (n: NotificationItem) => {
    if (n.type === 'vehicle_status_updated') return vehicleFor(n) !== null;
    if (n.type === 'order_status_changed' && n.orderId) return true;
    return Boolean(n.deeplinkPath);
  };

  // Regular (non-offer) notifications: mark read + navigate.
  const openNotification = (n: NotificationItem) => {
    if (n.unread) markRead(n.id);
    // The backend's vehicle deeplink names a route this app doesn't have; the
    // vehicle screen takes the id as a param.
    if (n.type === 'vehicle_status_updated') {
      const vehicle = vehicleFor(n);
      if (vehicle) router.push({ pathname: '/vehicle-detail', params: { id: vehicle.id } });
      return;
    }
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

  /**
   * Row copy. Where structured data allows it, the row is built here in the
   * active language instead of printing the backend's sentence: the order number
   * and its localized status, or the car's name. Nothing is said about WHAT
   * changed on a vehicle, because the event doesn't record it. Other types still
   * print server text, in whatever language the backend wrote it.
   */
  const displayText = useCallback(
    (n: NotificationItem): { title: string; body: string } => {
      if (n.type === 'vehicle_status_updated') {
        const vehicle = vehicleFor(n);
        // A car no longer in the garage is still named in the backend's sentence.
        const name = vehicle ? `${vehicle.make} ${vehicle.model}` : vehicleNameFromBody(n.body);
        return name
          ? { title: t('notifications.vehicleUpdatedTitle', { vehicle: name }), body: '' }
          : { title: t('notifications.vehicleUpdatedGeneric'), body: '' };
      }
      if (n.type !== 'order_status_changed') {
        return { title: n.title, body: n.body };
      }
      const statusLabel = n.orderStatus
        ? t(ORDER_STATUS_MACHINE_I18N[n.orderStatus] ?? ' ', { defaultValue: n.orderStatus })
        : '';
      return {
        title: n.orderId ? formatOrderNo(n.orderId) : t('notifications.orderStatusTitle'),
        body: statusLabel || n.body,
      };
    },
    [t, vehicleFor],
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
        toastService.success(t('sourcing.offerDeclined'));
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

  const renderRow = (n: NotificationItem) => {
    // Found-part offers act inline (add to cart) — no navigation.
    if (n.type === 'sourcing_offer' || n.offer) {
      const offerId = n.offer?.offerId ?? '';
      // Prefer the notification snapshot (instant, for new offers); fall back to
      // the value resolved from the offer detail (existing offers).
      const vehicle =
        capitalizeWords([n.offer?.vehicleBrand, n.offer?.vehicleModel].filter(Boolean).join(' ')) ||
        (liveVehicle[offerId] ?? '');
      const status = liveStatus[offerId];
      return (
        <SourcingOfferCard
          n={n}
          tokens={tokens}
          busy={busyOffer === offerId}
          added={status === 'ACCEPTED'}
          // Decline only applies to a live (SENT / not-yet-resolved) offer — once
          // declined/expired/gone, the card just re-offers "add to cart".
          canDecline={status === undefined || status === 'SENT'}
          vehicle={vehicle}
          onAdd={() => addToCart(n)}
          onReject={() => openReject(n)}
        />
      );
    }

    const { title, body } = displayText(n);
    const time = localizedNotificationTime(n.createdAt, t, language) || n.time;
    const rowStyle = { paddingVertical: 12, paddingHorizontal: 16 } as const;
    const content = (
      <>
        <AppView flex={1} gap={2} style={{ minWidth: 0 }}>
          {/* Real unread status: a small teal dot. */}
          <AppView row align="flex-start" gap="sm">
            <AppText
              family="default"
              weight="medium"
              style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, color: tokens.text }}
            >
              {title}
            </AppText>
            {n.unread ? (
              <AppView
                rounded={999}
                style={{ width: 8, height: 8, marginTop: 6, backgroundColor: tokens.brand }}
              />
            ) : null}
          </AppView>
          {body ? (
            <AppText textVariant="bodySm" style={{ color: tokens.textMuted }}>
              {body}
            </AppText>
          ) : null}
          {time ? (
            <AppText textVariant="bodyXs" style={{ color: tokens.textMuted }}>
              {time}
            </AppText>
          ) : null}
        </AppView>
      </>
    );
    const a11yText = [title, body, time].filter(Boolean).join('. ');

    if (!hasDestination(n)) {
      return (
        <AppView
          accessible
          accessibilityLabel={
            n.unread ? `${a11yText}. ${t('notifications.unreadLabel')}` : a11yText
          }
          row
          gap={12}
          style={rowStyle}
        >
          {content}
        </AppView>
      );
    }
    return (
      <AppPressableView
        onPress={() => openNotification(n)}
        androidRipple={false}
        pressedOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={`${a11yText}. ${n.unread ? t('notifications.unreadHint') : t('notifications.readHint')}`}
        // Without this the inner Pressable shrinks to its content width, so the
        // flex:1 content column collapses to ~0. fillContainer makes the Pressable
        // fill the row so the content lays out at full width.
        fillContainer
        row
        gap={12}
        style={rowStyle}
      >
        {content}
      </AppPressableView>
    );
  };

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title={t('notifications.title')} fallbackHref="/profile" />

      {unreadCount > 0 ? (
        <AppView row justify="flex-end" px="lg">
          <AppPressableView
            testID="notifications-mark-all"
            onPress={handleMarkAll}
            androidRipple={false}
            pressedOpacity={0.6}
            accessibilityRole="button"
            accessibilityLabel={t('notifications.markAllReadA11y')}
            center
            style={{ minHeight: 48, minWidth: 48 }}
          >
            <AppText
              weight="semibold"
              style={{ fontSize: 14, lineHeight: 20, color: tokens.brandText }}
            >
              {t('notifications.markAllRead')}
            </AppText>
          </AppPressableView>
        </AppView>
      ) : null}

      {state === 'loading' ? (
        <AppView flex={1} center>
          <WheelLoader size={28} color={tokens.brand} />
        </AppView>
      ) : state === 'error' ? (
        <AppView flex={1} center px="xl" gap={12} testID="notifications-error">
          <AppText textVariant="bodySm" align="center" colorName="textMuted">
            {t('notifications.loadError')}
          </AppText>
          <AppButton title={t('common.retry')} kind="secondary" size="sm" onPress={() => { void refresh(); }} />
        </AppView>
      ) : notifications.length === 0 ? (
        // Sits above the optical centre: a little high reads as composed.
        <AppView flex={1} center px="xl" gap={12} style={{ paddingBottom: 72 }}>
          <AppView
            center
            rounded={999}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{ width: 72, height: 72, backgroundColor: tokens.brandSoft }}
          >
            <Bell size={32} strokeWidth={2} color={tokens.brand} />
          </AppView>
          <AppText textVariant="h4" weight="bold" align="center" style={{ color: tokens.text }}>
            {t('notifications.emptyTitle')}
          </AppText>
          <AppText
            textVariant="bodySm"
            style={{ color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}
          >
            {t('notifications.emptyBody')}
          </AppText>
        </AppView>
      ) : (
        <AppScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 32, gap: 16 }}
          padding={0}
        >
          {sections.map(({ key, label, items }) => (
            <AppView key={key} gap={8}>
              <AppText
                textVariant="bodySm"
                weight="semibold"
                accessibilityRole="header"
                style={{ color: tokens.textMuted, paddingHorizontal: 16 }}
              >
                {label}
              </AppText>
              <AppView colorName="card">
                {items.map((n, index) => (
                  <AppView key={n.id}>
                    {index > 0 ? (
                      <AppView
                        style={{
                          height: 1,
                          marginLeft: ROW_DIVIDER_INSET,
                          marginRight: ROW_DIVIDER_INSET,
                          backgroundColor: tokens.divider,
                        }}
                      />
                    ) : null}
                    {renderRow(n)}
                  </AppView>
                ))}
              </AppView>
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
            <AppText
              family="heading"
              weight="bold"
              style={{ fontSize: 16, color: tokens.text, marginBottom: 2 }}
            >
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
                <AppText
                  family="default"
                  weight="semibold"
                  style={{ fontSize: 14, color: tokens.text }}
                >
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
