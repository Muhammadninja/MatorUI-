import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { BellOff, Check, X } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';

import AppBottomSheet from '@/components/shared/app-bottom-sheet';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useNotifications } from '@/hooks/use-notifications';
import { toastService } from '@/services/toast-service';
import {
  acceptSourcingOffer,
  rejectSourcingOffer,
  type SourcingOfferDeclineReason,
} from '@/services/sourcing-service';
import type { NotificationItem, NotificationTone } from '@/services/notifications-service';

type Tokens = ReturnType<typeof useThemeContext>['tokens'];

function useDotColor(tokens: Tokens) {
  return (tone: NotificationTone): string => {
    if (tone === 'info') return tokens.info;
    if (tone === 'value') return tokens.value;
    if (tone === 'warning') return tokens.warning;
    if (tone === 'success') return tokens.success;
    if (tone === 'accolade') return tokens.accolade;
    return tokens.brand;
  };
}

const CONDITION_RU: Record<string, string> = {
  NEW: 'новый',
  USED: 'б/у',
  OEM: 'оригинал',
  AFTERMARKET: 'аналог',
};
const AVAILABILITY_RU: Record<string, string> = {
  IN_STOCK: 'в наличии',
  ON_ORDER: 'под заказ',
};

const REJECT_REASONS: { key: SourcingOfferDeclineReason; label: string }[] = [
  { key: 'TOO_EXPENSIVE', label: 'Слишком дорого' },
  { key: 'FOUND_CHEAPER', label: 'Нашёл дешевле' },
  { key: 'NO_LONGER_NEEDED', label: 'Уже не нужно' },
  { key: 'OTHER', label: 'Другое' },
];

/** 250000 → "250 000 сум". */
function formatSom(price?: number): string | null {
  if (typeof price !== 'number' || !Number.isFinite(price)) return null;
  return `${price.toLocaleString('ru-RU').replace(/ /g, ' ')} сум`;
}

/**
 * Found-part offer card — a self-contained product-row-style row for a
 * `sourcing_offer`. The seller's photo shows only when present (no placeholder),
 * and the customer acts right here: an "add to cart" pill and an "✕" that opens
 * the decline sheet. No navigation away from the feed.
 */
function SourcingOfferCard({
  n,
  tokens,
  added,
  busy,
  rejected,
  onAdd,
  onReject,
}: {
  n: NotificationItem;
  tokens: Tokens;
  added: boolean;
  busy: boolean;
  rejected: boolean;
  onAdd: () => void;
  onReject: () => void;
}) {
  const offer = n.offer ?? {};
  const priceText = formatSom(offer.price);
  const chips = [CONDITION_RU[offer.condition ?? ''], AVAILABILITY_RU[offer.availability ?? '']].filter(
    (c): c is string => Boolean(c),
  );

  return (
    <AppView
      style={{
        borderWidth: 1,
        borderColor: n.unread ? tokens.brand : tokens.divider,
        backgroundColor: tokens.card ?? tokens.background,
        borderRadius: 16,
        padding: 12,
        marginVertical: 6,
        gap: 12,
      }}
    >
      {/* Content row: thumb (only if a photo exists) + details */}
      <AppView row gap={12}>
        {offer.imageUrl ? (
          <Image
            source={{ uri: offer.imageUrl }}
            style={{ width: 64, height: 64, borderRadius: 12 }}
            contentFit="cover"
            transition={150}
          />
        ) : null}

        <AppView style={{ flex: 1 }}>
          <AppView row justify="space-between" gap={8}>
            <AppText family="default" weight="bold" style={{ fontSize: 14.5, color: tokens.text, flex: 1 }} numberOfLines={2}>
              {offer.partName || n.title || 'Найденная запчасть'}
            </AppText>
            <AppText family="default" style={{ fontSize: 11, color: tokens.textMuted, flexShrink: 0 }}>
              {n.time}
            </AppText>
          </AppView>
          {priceText ? (
            <AppText family="accent" weight="bold" style={{ fontSize: 18, color: tokens.brand, marginTop: 2 }}>
              {priceText}
            </AppText>
          ) : null}
          {chips.length ? (
            <AppText family="default" style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}>
              {chips.join(' · ')}
            </AppText>
          ) : null}
        </AppView>
      </AppView>

      {/* Actions */}
      {rejected ? (
        <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted }}>
          Вы отклонили это предложение
        </AppText>
      ) : (
        <AppView row justify="flex-end" align="center" gap={10}>
          {added ? (
            <AppView
              row
              align="center"
              gap={6}
              rounded={999}
              style={{ paddingHorizontal: 16, paddingVertical: 9, backgroundColor: tokens.success }}
            >
              <Check size={15} color={tokens.background} />
              <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.background }}>
                В корзине
              </AppText>
            </AppView>
          ) : (
            <>
              {/* Decline (✕) */}
              <AppPressableView
                onPress={onReject}
                disabled={busy}
                pressedOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Отклонить предложение"
                center
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: tokens.divider,
                }}
              >
                <X size={18} color={tokens.textMuted} />
              </AppPressableView>

              {/* Add to cart */}
              <AppPressableView
                onPress={onAdd}
                disabled={busy}
                pressedOpacity={0.9}
                accessibilityRole="button"
                accessibilityLabel="Добавить в корзину"
                row
                align="center"
                gap={6}
                rounded={999}
                style={{ paddingHorizontal: 18, paddingVertical: 10, backgroundColor: tokens.text, minWidth: 128, justifyContent: 'center' }}
              >
                {busy ? (
                  <WheelLoader size={16} color={tokens.background} />
                ) : (
                  <>
                    <MaterialIcons name="add-shopping-cart" size={16} color={tokens.background} />
                    <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.background }}>
                      В корзину
                    </AppText>
                  </>
                )}
              </AppPressableView>
            </>
          )}
        </AppView>
      )}
    </AppView>
  );
}

export default function NotificationsScreen() {
  const { tokens } = useThemeContext();
  const { state, notifications, unreadCount, markRead, markAllRead, refresh } = useNotifications();
  const { refresh: refreshCart } = useCartContext();
  const dotColor = useDotColor(tokens);

  // Session-local offer action state (the notification payload can't reflect a
  // later accept/decline, so we track what the user did while on this screen).
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [rejected, setRejected] = useState<Set<string>>(new Set());
  const [busyOffer, setBusyOffer] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [reason, setReason] = useState<SourcingOfferDeclineReason | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);

  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useFocusEffect(
    useCallback(() => {
      void refreshRef.current();
    }, []),
  );

  const handleMarkAll = () => {
    markAllRead();
    toastService.success('All marked read');
  };

  // Regular (non-offer) notifications: mark read + follow a deep link if present.
  const openNotification = (n: NotificationItem) => {
    if (n.unread) markRead(n.id);
    if (n.deeplinkPath) {
      try {
        router.push(n.deeplinkPath as never);
      } catch {
        // Unknown/relative deeplink — leave the user on the feed.
      }
    }
  };

  const addToCart = useCallback(
    async (n: NotificationItem) => {
      const offerId = n.offer?.offerId;
      if (!offerId) return;
      setBusyOffer(offerId);
      try {
        await acceptSourcingOffer(offerId);
        await refreshCart();
        setAdded((s) => new Set(s).add(offerId));
        if (n.unread) markRead(n.id);
        toastService.success('Добавлено в корзину');
      } catch (err) {
        if ((err as { status?: number })?.status === 409) {
          setAdded((s) => new Set(s).add(offerId));
          toastService.info('Уже в корзине');
        } else {
          toastService.danger('Не удалось добавить в корзину');
        }
      } finally {
        setBusyOffer(null);
      }
    },
    [refreshCart, markRead],
  );

  const openReject = (n: NotificationItem) => {
    if (!n.offer?.offerId) return;
    setReason(null);
    setRejectTarget(n.offer.offerId);
    if (n.unread) markRead(n.id);
  };

  const confirmReject = useCallback(async () => {
    if (!rejectTarget || !reason) return;
    setRejectBusy(true);
    try {
      await rejectSourcingOffer(rejectTarget, reason);
      setRejected((s) => new Set(s).add(rejectTarget));
      toastService.info('Предложение отклонено');
      setRejectTarget(null);
    } catch {
      toastService.danger('Не удалось отклонить предложение');
    } finally {
      setRejectBusy(false);
    }
  }, [rejectTarget, reason]);

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader
        title="Notifications"
        fallbackHref="/profile"
        right={
          unreadCount > 0 ? (
            <AppPressableView
              onPress={handleMarkAll}
              pressedOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppText family="accent" weight="bold" style={{ fontSize: 12.5, color: tokens.text }}>
                Mark all read
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
              You&apos;re all caught up
            </AppText>
            <AppText
              family="default"
              style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}
            >
              Order updates, price drops, and back-in-stock alerts will show up here.
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
            // Found-part offers act inline (add to cart / decline) — no navigation.
            if (n.type === 'sourcing_offer' || n.offer) {
              const offerId = n.offer?.offerId ?? '';
              return (
                <SourcingOfferCard
                  key={n.id}
                  n={n}
                  tokens={tokens}
                  added={added.has(offerId)}
                  busy={busyOffer === offerId}
                  rejected={rejected.has(offerId)}
                  onAdd={() => addToCart(n)}
                  onReject={() => openReject(n)}
                />
              );
            }
            const dot = dotColor(n.tone);
            return (
              <AppPressableView
                key={n.id}
                onPress={() => openNotification(n)}
                androidRipple={false}
                pressedOpacity={n.unread ? 0.6 : 1}
                accessibilityRole="button"
                accessibilityLabel={`${n.title}. ${n.unread ? 'Unread. Tap to mark read.' : 'Read.'}`}
                row
                gap={12}
                style={{
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: tokens.divider,
                }}
              >
                <AppView
                  style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: dot, marginTop: 5, flexShrink: 0 }}
                />
                <AppView style={{ flex: 1 }}>
                  <AppView row justify="space-between" gap={8}>
                    <AppText family="accent" weight="bold" style={{ fontSize: 14.5, color: tokens.text }}>
                      {n.title}
                    </AppText>
                    <AppText family="default" style={{ fontSize: 11.5, color: tokens.textMuted, flexShrink: 0 }}>
                      {n.time}
                    </AppText>
                  </AppView>
                  <AppText
                    family="default"
                    style={{ fontSize: 13, color: tokens.textMuted, marginTop: 3, lineHeight: 18 }}
                  >
                    {n.body}
                  </AppText>
                </AppView>
                {n.unread ? (
                  <AppView
                    style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: tokens.brandBg, marginTop: 6, flexShrink: 0 }}
                  />
                ) : (
                  <AppView style={{ width: 8, flexShrink: 0 }} />
                )}
              </AppPressableView>
            );
          })}
        </AppScrollView>
      )}

      {/* Shared decline-reason sheet */}
      <AppBottomSheet
        visible={rejectTarget !== null}
        onClose={() => setRejectTarget(null)}
        heightFraction={0.52}
        expandable={false}
      >
        <AppView style={{ paddingHorizontal: 20, paddingBottom: 28, gap: 8 }}>
          <AppText family="heading" weight="bold" style={{ fontSize: 18, color: tokens.text, marginBottom: 6 }}>
            Причина отказа
          </AppText>
          {REJECT_REASONS.map((r) => {
            const active = reason === r.key;
            return (
              <AppPressableView
                key={r.key}
                onPress={() => setReason(r.key)}
                pressedOpacity={0.7}
                row
                justify="space-between"
                align="center"
                style={{
                  paddingVertical: 15,
                  paddingHorizontal: 16,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: active ? tokens.brand : tokens.divider,
                  backgroundColor: active ? tokens.brandBg : 'transparent',
                }}
              >
                <AppText family="default" weight={active ? 'bold' : 'regular'} style={{ fontSize: 15, color: tokens.text }}>
                  {r.label}
                </AppText>
                {active ? <Check size={18} color={tokens.brand} /> : null}
              </AppPressableView>
            );
          })}

          <AppPressableView
            onPress={confirmReject}
            disabled={!reason || rejectBusy}
            pressedScale={0.97}
            center
            style={{
              marginTop: 10,
              height: 52,
              borderRadius: 16,
              backgroundColor: tokens.text,
              opacity: !reason || rejectBusy ? 0.5 : 1,
            }}
          >
            {rejectBusy ? (
              <WheelLoader size={18} color={tokens.background} />
            ) : (
              <AppText family="accent" weight="bold" style={{ fontSize: 15.5, color: tokens.background }}>
                Отклонить
              </AppText>
            )}
          </AppPressableView>
        </AppView>
      </AppBottomSheet>
    </AppView>
  );
}
