import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Package } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';

import AppBottomSheet from '@/components/shared/app-bottom-sheet';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { toastService } from '@/services/toast-service';
import {
  acceptSourcingOffer,
  fetchSourcingOffer,
  rejectSourcingOffer,
  type SourcingOfferDeclineReason,
  type SourcingOfferDetail,
} from '@/services/sourcing-service';

const CONDITION_RU: Record<string, string> = {
  NEW: 'Новый',
  USED: 'Б/у',
  OEM: 'Оригинал',
  AFTERMARKET: 'Аналог',
};
const AVAILABILITY_RU: Record<string, string> = {
  IN_STOCK: 'В наличии',
  ON_ORDER: 'Под заказ',
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

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Offer detail — opened from a "found part" notification. The customer can BUY
 * (adds the offer to the cart → normal checkout) or REJECT with a reason. Photos
 * render when present; a price-only quote gets an intentional tonal placeholder
 * rather than an empty box.
 */
export default function SourcingOfferScreen() {
  const { tokens } = useThemeContext();
  const { refresh: refreshCart } = useCartContext();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [state, setState] = useState<LoadState>('loading');
  const [offer, setOffer] = useState<SourcingOfferDetail | null>(null);
  const [status, setStatus] = useState<string>('SENT');
  const [busy, setBusy] = useState<null | 'accept' | 'reject'>(null);

  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState<SourcingOfferDeclineReason | null>(null);

  useEffect(() => {
    if (!id) {
      setState('error');
      return;
    }
    const ctrl = new AbortController();
    setState('loading');
    fetchSourcingOffer(id, ctrl.signal)
      .then((o) => {
        setOffer(o);
        setStatus(o.status);
        setState('ready');
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setState('error');
      });
    return () => ctrl.abort();
  }, [id]);

  const handleBuy = useCallback(async () => {
    if (!offer) return;
    setBusy('accept');
    try {
      await acceptSourcingOffer(offer.id);
      await refreshCart();
      setStatus('ACCEPTED');
      toastService.success('Добавлено в корзину');
      router.navigate('/cart');
    } catch (err) {
      const conflict = (err as { status?: number })?.status === 409;
      if (conflict) setStatus('EXPIRED');
      toastService.danger(
        conflict ? 'Предложение больше недоступно' : 'Не удалось добавить в корзину',
      );
    } finally {
      setBusy(null);
    }
  }, [offer, refreshCart]);

  const handleReject = useCallback(async () => {
    if (!offer || !reason) return;
    setBusy('reject');
    try {
      await rejectSourcingOffer(offer.id, reason);
      setStatus('DECLINED');
      setRejectOpen(false);
      toastService.info('Предложение отклонено');
      router.back();
    } catch {
      toastService.danger('Не удалось отклонить предложение');
    } finally {
      setBusy(null);
    }
  }, [offer, reason]);

  const chips = offer
    ? [CONDITION_RU[offer.condition], AVAILABILITY_RU[offer.availability]].filter(
        (c): c is string => Boolean(c),
      )
    : [];
  const priceText = formatSom(offer?.price);

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title="Предложение" fallbackHref="/notifications" />

      {state === 'loading' ? (
        <AppView flex={1} center>
          <WheelLoader size={28} color={tokens.textMuted} />
        </AppView>
      ) : state === 'error' || !offer ? (
        <AppView flex={1} center px="xl" gap={8}>
          <Package size={30} strokeWidth={2} color={tokens.textMuted} />
          <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text }}>
            Предложение недоступно
          </AppText>
          <AppText
            family="default"
            style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}
          >
            Возможно, оно устарело или было закрыто.
          </AppText>
        </AppView>
      ) : (
        <>
          <AppScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 8 }}
            padding={0}
          >
            {/* Hero: photos, or an intentional tonal placeholder for a price-only quote */}
            {offer.images.length > 0 ? (
              <AppScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                padding={0}
                contentContainerStyle={{ gap: 10 }}
              >
                {offer.images.map((uri) => (
                  <Image
                    key={uri}
                    source={{ uri }}
                    style={{
                      width: offer.images.length > 1 ? 260 : 320,
                      height: 260,
                      borderRadius: 16,
                      backgroundColor: tokens.divider,
                    }}
                    contentFit="cover"
                    transition={150}
                  />
                ))}
              </AppScrollView>
            ) : (
              <AppView
                center
                style={{
                  height: 168,
                  borderRadius: 16,
                  backgroundColor: tokens.brandBg,
                  gap: 10,
                }}
              >
                <AppView
                  center
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 999,
                    backgroundColor: tokens.background,
                  }}
                >
                  <Package size={30} strokeWidth={1.8} color={tokens.brand} />
                </AppView>
                <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.brand }}>
                  Продавец указал только цену
                </AppText>
              </AppView>
            )}

            {/* Part + price */}
            <AppView gap={4} style={{ marginTop: 18 }}>
              {offer.partName ? (
                <AppText family="heading" weight="bold" style={{ fontSize: 19, color: tokens.text }}>
                  {offer.partName}
                </AppText>
              ) : null}
              {priceText ? (
                <AppText family="accent" weight="bold" style={{ fontSize: 26, color: tokens.brand }}>
                  {priceText}
                </AppText>
              ) : null}
              {chips.length ? (
                <AppText family="default" style={{ fontSize: 13.5, color: tokens.textMuted, marginTop: 2 }}>
                  {chips.join(' · ')}
                  {offer.availability === 'ON_ORDER' && offer.etaDays ? ` · ~${offer.etaDays} дн.` : ''}
                </AppText>
              ) : null}
            </AppView>

            {/* Seller note */}
            {offer.note ? (
              <AppView
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: tokens.divider,
                }}
              >
                <AppText family="accent" weight="bold" style={{ fontSize: 12.5, color: tokens.textMuted, marginBottom: 4 }}>
                  Комментарий продавца
                </AppText>
                <AppText family="default" style={{ fontSize: 14, color: tokens.text, lineHeight: 20 }}>
                  {offer.note}
                </AppText>
              </AppView>
            ) : null}
          </AppScrollView>

          {/* Sticky action bar — state-aware */}
          <AppView
            style={{
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: 28,
              borderTopWidth: 1,
              borderTopColor: tokens.divider,
              gap: 10,
            }}
          >
            {status === 'SENT' ? (
              <>
                <AppButton
                  title="Добавить в корзину"
                  kind="brand"
                  variant="solid"
                  fullWidth
                  loading={busy === 'accept'}
                  disabled={busy !== null}
                  onPress={handleBuy}
                />
                <AppButton
                  title="Отклонить предложение"
                  kind="error"
                  variant="ghost"
                  fullWidth
                  disabled={busy !== null}
                  onPress={() => setRejectOpen(true)}
                />
              </>
            ) : status === 'ACCEPTED' ? (
              <>
                <AppView row center gap={6} style={{ paddingVertical: 4 }}>
                  <Check size={16} color={tokens.success} />
                  <AppText family="accent" weight="bold" style={{ fontSize: 14, color: tokens.success }}>
                    Добавлено в корзину
                  </AppText>
                </AppView>
                <AppButton
                  title="Перейти в корзину"
                  kind="brand"
                  variant="solid"
                  fullWidth
                  onPress={() => router.navigate('/cart')}
                />
              </>
            ) : status === 'DECLINED' ? (
              <AppText
                family="default"
                style={{ fontSize: 13.5, color: tokens.textMuted, textAlign: 'center', paddingVertical: 8 }}
              >
                Вы отклонили это предложение.
              </AppText>
            ) : (
              <AppText
                family="default"
                style={{ fontSize: 13.5, color: tokens.textMuted, textAlign: 'center', paddingVertical: 8 }}
              >
                Предложение больше не действительно.
              </AppText>
            )}
          </AppView>
        </>
      )}

      {/* Reject-reason sheet */}
      <AppBottomSheet visible={rejectOpen} onClose={() => setRejectOpen(false)}>
        <AppView style={{ paddingHorizontal: 20, paddingBottom: 28, gap: 8 }}>
          <AppText family="heading" weight="bold" style={{ fontSize: 17, color: tokens.text, marginBottom: 4 }}>
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
                style={{
                  paddingVertical: 14,
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

          <AppButton
            title="Отклонить"
            kind="error"
            variant="solid"
            fullWidth
            disabled={!reason || busy !== null}
            loading={busy === 'reject'}
            onPress={handleReject}
            style={{ marginTop: 8 }}
          />
        </AppView>
      </AppBottomSheet>
    </AppView>
  );
}
