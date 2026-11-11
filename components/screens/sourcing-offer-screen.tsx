import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Check, Package, ShoppingCart, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AppBottomSheet from '@/components/shared/app-bottom-sheet';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppCard } from '@/components/shared/app-card';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { toastService } from '@/services/toast-service';
import { formatSomAmount } from '@/utils/format-price';
import {
  acceptSourcingOffer,
  fetchSourcingOffer,
  rejectSourcingOffer,
  type SourcingOfferDeclineReason,
  type SourcingOfferDetail,
} from '@/services/sourcing-service';

type TFn = (key: string) => string;

function buildConditionLabels(t: TFn): Record<string, string> {
  return {
    NEW: t('sourcing.conditionNew'),
    USED: t('sourcing.conditionUsed'),
    OEM: t('sourcing.conditionOem'),
    AFTERMARKET: t('sourcing.conditionAftermarket'),
  };
}
function buildAvailabilityLabels(t: TFn): Record<string, string> {
  return {
    IN_STOCK: t('sourcing.availabilityInStock'),
    ON_ORDER: t('sourcing.availabilityOnOrder'),
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
  return `${formatSomAmount(price)} сум`;
}

type Tokens = ReturnType<typeof useThemeContext>['tokens'];

/** A small tonal chip for condition / availability. */
function Chip({ label, tokens }: { label: string; tokens: Tokens }) {
  return (
    <AppView
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: tokens.brandSoft,
      }}
    >
      <AppText family="accent" weight="semibold" style={{ fontSize: 12, color: tokens.brandText }}>
        {label}
      </AppText>
    </AppView>
  );
}

/**
 * Primary "buy" button — a branded pill with the icon in a translucent badge and
 * a soft brand shadow. Deliberately not the stock button: it should feel like a
 * commerce CTA. Shows a spinner while the purchase is in flight.
 */
function BuyButton({
  priceText,
  busy,
  disabled,
  onPress,
  tokens,
}: {
  priceText: string | null;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
  tokens: Tokens;
}) {
  const { t } = useTranslation();
  return (
    <AppPressableView
      onPress={onPress}
      disabled={disabled}
      pressedScale={0.97}
      row
      center
      gap={10}
      style={{
        height: 56,
        borderRadius: 18,
        backgroundColor: tokens.brand,
        opacity: disabled && !busy ? 0.6 : 1,
        shadowColor: tokens.brand,
        shadowOpacity: 0.35,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 7,
      }}
    >
      {busy ? (
        <WheelLoader size={20} color={tokens.onBrand} />
      ) : (
        <>
          <AppView
            center
            style={{ width: 30, height: 30, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.22)' }}
          >
            <ShoppingCart size={16} color={tokens.onBrand} />
          </AppView>
          <AppText family="accent" weight="bold" style={{ fontSize: 16, color: tokens.onBrand }}>
            {priceText ? t('sourcing.buyWithPrice', { price: priceText }) : t('sourcing.addToCart')}
          </AppText>
        </>
      )}
    </AppPressableView>
  );
}

/** Secondary "reject" button — a soft tonal pill, clearly lower-emphasis. */
function RejectButton({
  disabled,
  onPress,
  tokens,
}: {
  disabled: boolean;
  onPress: () => void;
  tokens: Tokens;
}) {
  const { t } = useTranslation();
  return (
    <AppPressableView
      onPress={onPress}
      disabled={disabled}
      pressedScale={0.97}
      row
      center
      gap={7}
      style={{
        height: 48,
        borderRadius: 16,
        backgroundColor: tokens.card ?? tokens.background,
        borderWidth: 1,
        borderColor: tokens.divider,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <X size={15} color={tokens.textMuted} />
      <AppText family="accent" weight="semibold" style={{ fontSize: 14, color: tokens.textMuted }}>
        {t('sourcing.doesNotFit')}
      </AppText>
    </AppPressableView>
  );
}

type LoadState = 'loading' | 'ready' | 'error';

/**
 * Offer detail — opened from a "found part" notification. The offer is presented
 * as a product-style card; the customer can BUY (adds it to the cart → normal
 * checkout) or REJECT with a reason. A price-only quote gets an intentional
 * tonal placeholder instead of an empty photo box.
 */
export default function SourcingOfferScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { refresh: refreshCart } = useCartContext();
  const { id } = useLocalSearchParams<{ id: string }>();

  const conditionLabels = useMemo(() => buildConditionLabels(t), [t]);
  const availabilityLabels = useMemo(() => buildAvailabilityLabels(t), [t]);
  const rejectReasons = useMemo(() => buildRejectReasons(t), [t]);

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
      toastService.success(t('sourcing.addedToCart'));
      router.navigate('/cart');
    } catch (err) {
      const conflict = (err as { status?: number })?.status === 409;
      if (conflict) setStatus('EXPIRED');
      toastService.danger(
        conflict ? t('sourcing.offerUnavailable') : t('sourcing.addToCartFailed'),
      );
    } finally {
      setBusy(null);
    }
  }, [offer, refreshCart, t]);

  const handleReject = useCallback(async () => {
    if (!offer || !reason) return;
    setBusy('reject');
    try {
      await rejectSourcingOffer(offer.id, reason);
      setStatus('DECLINED');
      setRejectOpen(false);
      toastService.success(t('sourcing.offerDeclined'));
      router.back();
    } catch {
      toastService.danger(t('sourcing.declineFailed'));
    } finally {
      setBusy(null);
    }
  }, [offer, reason, t]);

  const priceText = formatSom(offer?.price);
  const conditionLabel = offer ? conditionLabels[offer.condition] : undefined;
  const availabilityLabel = offer ? availabilityLabels[offer.availability] : undefined;
  const chips = offer
    ? [
        conditionLabel,
        availabilityLabel
          ? availabilityLabel +
            (offer.availability === 'ON_ORDER' && offer.etaDays
              ? ` · ${t('sourcing.etaDays', { days: offer.etaDays })}`
              : '')
          : undefined,
      ].filter((c): c is string => Boolean(c))
    : [];

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title={t('sourcing.offerTitle')} fallbackHref="/notifications" />

      {state === 'loading' ? (
        <AppView flex={1} center>
          <WheelLoader size={28} color={tokens.textMuted} />
        </AppView>
      ) : state === 'error' || !offer ? (
        <AppView flex={1} center px="xl" gap={8}>
          <Package size={30} strokeWidth={2} color={tokens.textMuted} />
          <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text }}>
            {t('sourcing.offerUnavailableTitle')}
          </AppText>
          <AppText
            family="default"
            style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}
          >
            {t('sourcing.offerUnavailableBody')}
          </AppText>
        </AppView>
      ) : (
        <>
          <AppScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24, paddingTop: 12 }}
            padding={0}
          >
            {/* Product-style offer card. The image section renders ONLY when the
                dealer attached a photo — no placeholder for a price-only quote. */}
            <AppCard rounded={20}>
              {offer.images.length > 0 ? (
                <Image
                  source={{ uri: offer.images[0] }}
                  style={{
                    width: '100%',
                    height: 210,
                    borderRadius: 14,
                    backgroundColor: tokens.divider,
                    marginBottom: 16,
                  }}
                  contentFit="cover"
                  transition={150}
                />
              ) : null}

              {offer.partName ? (
                <AppText family="heading" weight="bold" style={{ fontSize: 19, color: tokens.text }}>
                  {offer.partName}
                </AppText>
              ) : null}

              {chips.length ? (
                <AppView row gap={6} style={{ marginTop: 8, flexWrap: 'wrap' }}>
                  {chips.map((c) => (
                    <Chip key={c} label={c} tokens={tokens} />
                  ))}
                </AppView>
              ) : null}

              <AppView gap={2} style={{ marginTop: 16 }}>
                <AppText family="default" style={{ fontSize: 12, color: tokens.textMuted }}>
                  {t('sourcing.priceFromSeller')}
                </AppText>
                {priceText ? (
                  <AppText
                  family="heading"
                  weight="bold"
                  style={{ fontSize: 28, lineHeight: 34, color: tokens.brand }}
                >
                    {priceText}
                  </AppText>
                ) : null}
              </AppView>

              {offer.note ? (
                <AppView
                  style={{
                    marginTop: 16,
                    padding: 12,
                    borderRadius: 12,
                    backgroundColor: tokens.brandSoft,
                  }}
                >
                  <AppText family="accent" weight="bold" style={{ fontSize: 12, color: tokens.brandText, marginBottom: 3 }}>
                    {t('sourcing.sellerNote')}
                  </AppText>
                  <AppText family="default" style={{ fontSize: 14, color: tokens.text, lineHeight: 20 }}>
                    {offer.note}
                  </AppText>
                </AppView>
              ) : null}
            </AppCard>
          </AppScrollView>

          {/* Sticky action bar — state-aware, custom buttons */}
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
                <BuyButton
                  priceText={priceText}
                  busy={busy === 'accept'}
                  disabled={busy !== null}
                  onPress={handleBuy}
                  tokens={tokens}
                />
                <RejectButton disabled={busy !== null} onPress={() => setRejectOpen(true)} tokens={tokens} />
              </>
            ) : status === 'ACCEPTED' ? (
              <>
                <AppView row center gap={6} style={{ paddingVertical: 2 }}>
                  <Check size={16} color={tokens.success} />
                  <AppText family="accent" weight="bold" style={{ fontSize: 14, color: tokens.success }}>
                    {t('sourcing.addedToCart')}
                  </AppText>
                </AppView>
                <BuyButton priceText={null} busy={false} disabled={false} onPress={() => router.navigate('/cart')} tokens={tokens} />
              </>
            ) : status === 'DECLINED' ? (
              <AppText
                family="default"
                style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center', paddingVertical: 8 }}
              >
                {t('sourcing.youDeclined')}
              </AppText>
            ) : (
              <AppText
                family="default"
                style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center', paddingVertical: 8 }}
              >
                {t('sourcing.offerNoLongerValid')}
              </AppText>
            )}
          </AppView>
        </>
      )}

      {/* Reject-reason sheet */}
      <AppBottomSheet
        visible={rejectOpen}
        onClose={() => setRejectOpen(false)}
        heightFraction={0.52}
        expandable={false}
      >
        <AppView style={{ paddingHorizontal: 20, paddingBottom: 28, gap: 8 }}>
          <AppText family="heading" weight="bold" style={{ fontSize: 17, color: tokens.text, marginBottom: 4 }}>
            {t('sourcing.declineReasonTitle')}
          </AppText>
          {rejectReasons.map((r) => {
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
                  backgroundColor: active ? tokens.brandSoft : 'transparent',
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
            onPress={handleReject}
            disabled={!reason || busy !== null}
            pressedScale={0.97}
            row
            center
            gap={7}
            style={{
              marginTop: 8,
              height: 52,
              borderRadius: 16,
              backgroundColor: tokens.text,
              opacity: !reason || busy !== null ? 0.5 : 1,
            }}
          >
            {busy === 'reject' ? (
              <WheelLoader size={18} color={tokens.background} />
            ) : (
              <AppText family="accent" weight="bold" style={{ fontSize: 16, color: tokens.background }}>
                {t('sourcing.decline')}
              </AppText>
            )}
          </AppPressableView>
        </AppView>
      </AppBottomSheet>
    </AppView>
  );
}
