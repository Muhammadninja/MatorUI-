import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { AlertCircle, ArrowLeft, Check, MapPin, PhoneCall, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddressFormSheet, {
  type AddressFormValues,
} from '@/components/screens-components/account/address-form-sheet';
import { AppButton } from '@/components/shared/app-button';
import { AppPrice } from '@/components/shared/app-price';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { DEFAULT_PAYMENT_TYPE, PAYMENT_OPTIONS, type PaymentOption } from '@/constants/payment-options';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useToast } from '@/hooks/use-toast';
import { useAddresses, useCreateAddress, useCreateOrder, useShippingQuote } from '@/hooks/use-orders';
import { parsePrice } from '@/services/cart-math';
import { localizeShipping } from '@/services/checkout-presentation';
import garageService from '@/services/garage-service';
import type { Address, PaymentType } from '@/services/orders-service';
import { paymentsTransport } from '@/services/payments-service';
import { triggerHaptic } from '@/utils/haptics';

type Tokens = ReturnType<typeof useThemeContext>['tokens'];

/**
 * Drives online Payme payment for a just-created (`pending_payment`) order:
 * requests a hosted checkout URL, opens it in an auth-session browser, and
 * reports whether the user completed the redirect back. The backend webhook is
 * the source of truth for actual payment — the confirmation screen shows the
 * real order status; this only steers the post-checkout toast.
 *   'skip'       → gateway not live yet → behave exactly as today (no online step)
 *   'paid'       → user completed the hosted flow (redirected back to returnUrl)
 *   'incomplete' → user cancelled / dismissed / it errored
 */
async function collectPaymePayment(orderId: string): Promise<'skip' | 'paid' | 'incomplete'> {
  const returnUrl = Linking.createURL('payment-return');
  try {
    const start = await paymentsTransport.startPayment({ orderId, provider: 'payme', returnUrl });
    if (start.status === 'unsupported') return 'skip';
    const res = await WebBrowser.openAuthSessionAsync(start.checkoutUrl, returnUrl);
    return res.type === 'success' ? 'paid' : 'incomplete';
  } catch {
    return 'incomplete';
  }
}

/**
 * Checkout — the Uzbek-market flow. Delivery address is OPTIONAL (the courier
 * calls to confirm the drop-off, so the buyer can skip it), and payment is a
 * fixed choice of Payme / Terminal / Cash rather than a stored card. Addresses
 * can be added inline via a bottom-sheet. "Place order" builds a
 * `CreateOrderInput` (addressId may be null) and hands the created order id to
 * the confirmation screen.
 */
export default function CheckoutScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { items, totals, appliedPromo, formatCurrency, clearCart } = useCartContext();
  const { profile } = useUserContext();

  const toast = useToast();
  const addresses = useAddresses();
  const createAddress = useCreateAddress();
  const create = useCreateOrder();

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressSkipped, setAddressSkipped] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>(DEFAULT_PAYMENT_TYPE);
  const [shipIdx, setShipIdx] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);

  const addrItems = addresses.items;
  const defaultAddr = useMemo(
    () => addrItems.find((a) => a.isDefault) ?? addrItems[0],
    [addrItems],
  );
  const chosenAddr = selectedAddressId
    ? addrItems.find((a) => a.id === selectedAddressId)
    : undefined;
  // Effective delivery address: null when skipped or none available.
  const addr: Address | null = addressSkipped ? null : chosenAddr ?? defaultAddr ?? null;

  // Shipping quote only makes sense with a concrete address; without one the
  // selector stays hidden and we fall back to `totals.shipping` (the same
  // flat courier fee the quote would return anyway — see cart-math.ts).
  const shippingRequest = useMemo(() => (addr ? { addressId: addr.id } : null), [addr]);
  const shipping = useShippingQuote(shippingRequest);
  const shipOption = addr ? shipping.options[shipIdx] ?? shipping.options[0] : undefined;
  const shipCopy = shipOption ? localizeShipping(shipOption, t) : undefined;

  // `shipOption` (when present) is the real per-method quote from the
  // backend and REPLACES totals.shipping — it must not be added on top of
  // it, or delivery gets charged twice in the preview.
  const deliveryFee = shipOption?.price ?? totals.shipping;
  const grandTotal = totals.subtotal - totals.discount + deliveryFee + totals.serviceFee;

  const cycleAddress = () => {
    if (addrItems.length === 0) return;
    const curIdx = Math.max(0, addrItems.findIndex((a) => a.id === addr?.id));
    const next = addrItems[(curIdx + 1) % addrItems.length]!;
    setSelectedAddressId(next.id);
    setAddressSkipped(false);
    setShipIdx(0);
  };

  const handleAddAddress = async (values: AddressFormValues) => {
    try {
      const created = await createAddress.mutateAsync(values);
      setSelectedAddressId(created.id);
      setAddressSkipped(false);
      setShipIdx(0);
    } catch {
      // The address query stays as-is on failure; the buyer can retry or skip.
    }
  };

  const placeOrder = async () => {
    if (items.length === 0) return;
    triggerHaptic('success');
    const result = await create.placeOrder({
      items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
      addressId: addr?.id ?? null,
      paymentType,
      shippingOptionKey: shipOption?.key ?? 'standard',
      promoCode: appliedPromo?.code ?? null,
      totalLabel: formatCurrency(grandTotal),
      // Backend order is built from the server cart; these tag it with the
      // buyer's vehicle + contact number (both optional server-side).
      vehicleId: garageService.getPrimary()?.id,
      contactPhone: profile?.phone ?? undefined,
    });
    if (!result) return; // hook surfaced the error; stay on the screen.

    // Payme is paid online: hand the just-created (pending_payment) order to the
    // hosted checkout before finishing. Terminal/Cash are pay-on-delivery, so
    // they skip this entirely. The order exists regardless of payment outcome
    // (backend models it as pending_payment); an incomplete online payment just
    // means the buyer can still pay — surface a note and land them on the
    // confirmation screen, which shows the real status.
    if (paymentType === 'payme') {
      const outcome = await collectPaymePayment(result.orderId);
      if (outcome === 'incomplete') {
        toast.info(t('checkout.paymentIncomplete'));
      }
    }

    clearCart();
    router.replace({
      pathname: '/order-confirmation',
      params: { orderId: result.orderId },
    });
  };

  if (addresses.state === 'loading') {
    return (
      <AppView flex={1} colorName="background" center>
        <WheelLoader size={30} color={tokens.text} />
      </AppView>
    );
  }

  return (
    <AppView flex={1} colorName="background" testID="checkout-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 24 }}
      >
        {/* Header */}
        <AppView row align="center" gap={12} px="lg" style={{ paddingBottom: 14 }}>
          <AppPressableView onPress={() => router.back()} center rounded={12} borderWidth={1} borderName="border" accessibilityRole="button" accessibilityLabel={t('checkout.back')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ width: 40, height: 40 }}>
            <ArrowLeft size={22} strokeWidth={2.2} color={tokens.text} />
          </AppPressableView>
          <AppText family="heading" weight="bold" style={{ fontSize: 20, color: tokens.text }}>{t('checkout.title')}</AppText>
        </AppView>

        <AppView px="lg" gap={16}>
          {/* Delivery address (optional — courier calls to confirm) */}
          <DeliverySection
            tokens={tokens}
            addr={addr}
            skipped={addressSkipped}
            canChange={addrItems.length > 1}
            onChange={cycleAddress}
            onAdd={() => setSheetVisible(true)}
            onSkip={() => {
              setAddressSkipped(true);
              setSelectedAddressId(null);
            }}
          />

          {/* Payment method — Payme / Terminal / Cash */}
          <AppView gap={10}>
            <SectionLabel tokens={tokens}>{t('checkout.payment')}</SectionLabel>
            {PAYMENT_OPTIONS.map((opt) => (
              <PaymentRow
                key={opt.id}
                option={opt}
                selected={paymentType === opt.id}
                onPress={() => setPaymentType(opt.id)}
                tokens={tokens}
              />
            ))}
          </AppView>

          {/* Shipping option — only when a concrete address is selected */}
          {addr && shipOption ? (
            <SectionCard
              label={t('checkout.shipping')}
              main={`${shipCopy?.label} · ${shipOption.price === 0 ? t('checkout.free') : formatCurrency(shipOption.price)}`}
              sub={shipCopy?.eta ?? ''}
              onChange={
                shipping.options.length > 1
                  ? () => setShipIdx((i) => (i + 1) % shipping.options.length)
                  : undefined
              }
              tokens={tokens}
            />
          ) : null}

          {/* Order summary */}
          <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text, marginTop: 4 }}>{t('checkout.orderSummary')}</AppText>
          <AppView gap={10}>
            {items.map((item) => (
              <AppView key={item.id} row justify="space-between">
                <AppText family="default" style={{ fontSize: 13.5, color: tokens.textMuted, flex: 1 }}>
                  {item.title} × {item.quantity}
                </AppText>
                <AppText family="accent" weight="semibold" style={{ fontSize: 13.5, color: tokens.text }}>
                  {formatCurrency(parsePrice(item.price) * item.quantity)}
                </AppText>
              </AppView>
            ))}
            <AppView style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 4 }} />
            <SummaryRow label={t('checkout.subtotal')} value={formatCurrency(totals.subtotal)} tokens={tokens} />
            {totals.discount > 0 ? (
              <SummaryRow label={t('checkout.discount')} value={`−${formatCurrency(totals.discount)}`} tokens={tokens} />
            ) : null}
            <SummaryRow
              label={t('checkout.shipping')}
              value={deliveryFee > 0 ? formatCurrency(deliveryFee) : t('checkout.free')}
              tokens={tokens}
            />
            <SummaryRow label={t('checkout.serviceFee')} value={formatCurrency(totals.serviceFee)} tokens={tokens} />
            <AppView row justify="space-between">
              <AppText family="accent" weight="bold" style={{ fontSize: 16, color: tokens.text }}>{t('checkout.total')}</AppText>
              <AppPrice value={formatCurrency(grandTotal)} size={18} color={tokens.text} />
            </AppView>
          </AppView>

          {create.error ? (
            <AppView row align="center" gap={8}>
              <AlertCircle size={16} strokeWidth={2} color={tokens.error} />
              <AppText family="default" style={{ fontSize: 12.5, color: tokens.error, flex: 1 }}>{create.error}</AppText>
            </AppView>
          ) : null}
        </AppView>
      </ScrollView>

      {/* Sticky place order */}
      <AppView colorName="background" px="lg" style={{ paddingTop: 14, paddingBottom: Math.max(insets.bottom, 20), borderTopWidth: 1, borderTopColor: tokens.divider }}>
        <AppButton
          testID="checkout-place-order-btn"
          title={create.phase === 'placing' ? t('checkout.placingOrder') : t('checkout.placeOrder', { total: formatCurrency(grandTotal) })}
          kind="brand"
          size="lg"
          fullWidth
          disabled={items.length === 0 || create.phase === 'placing'}
          onPress={placeOrder}
        />
      </AppView>

      <AddressFormSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSubmit={handleAddAddress}
      />
    </AppView>
  );
}

// ── Delivery address section ───────────────────────────────────────────
// Three shapes: a chosen address (with change/skip), the skipped state
// (courier calls), or the empty prompt (add / skip).

function DeliverySection({
  tokens,
  addr,
  skipped,
  canChange,
  onChange,
  onAdd,
  onSkip,
}: {
  tokens: Tokens;
  addr: Address | null;
  skipped: boolean;
  canChange: boolean;
  onChange: () => void;
  onAdd: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  return (
    <AppView rounded={16} p={16} colorName="card" borderWidth={1} borderName="border" gap={10}>
      <AppView row align="center" justify="space-between">
        <SectionLabel tokens={tokens}>{t('checkout.deliveryAddress')}</SectionLabel>
        {addr && canChange ? (
          <AppPressableView onPress={onChange} accessibilityRole="button" accessibilityLabel={t('checkout.changeAddress')}>
            <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.text }}>{t('checkout.change')}</AppText>
          </AppPressableView>
        ) : null}
      </AppView>

      {addr ? (
        <>
          <AppView row align="center" gap={10}>
            <MapPin size={18} strokeWidth={2} color={tokens.text} />
            <AppView flex={1}>
              <AppText family="default" weight="semibold" style={{ fontSize: 15, color: tokens.text }}>{addr.label}</AppText>
              <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted, marginTop: 2 }}>
                {`${addr.line1}, ${addr.city}`}
              </AppText>
            </AppView>
          </AppView>
          <AppView row gap={18} style={{ marginTop: 2 }}>
            <LinkAction label={t('checkout.addNew')} onPress={onAdd} color={tokens.text} />
            <LinkAction label={t('checkout.skipForNow')} onPress={onSkip} color={tokens.textMuted} />
          </AppView>
        </>
      ) : skipped ? (
        <>
          <AppView row align="center" gap={10}>
            <PhoneCall size={18} strokeWidth={2} color={tokens.text} />
            <AppText family="default" style={{ fontSize: 13.5, color: tokens.textMuted, flex: 1 }}>
              {t('checkout.noAddressCourier')}
            </AppText>
          </AppView>
          <LinkAction label={t('checkout.addAnAddress')} onPress={onAdd} color={tokens.text} />
        </>
      ) : (
        <>
          <AppText family="default" style={{ fontSize: 13.5, color: tokens.textMuted }}>
            {t('checkout.addAddressOrSkip')}
          </AppText>
          <AppView row gap={10}>
            <AppButton title={t('checkout.addAddress')} kind="secondary" size="sm" onPress={onAdd} />
            {/* variant="ghost" → transparent bg + `tokens.text` label. Without it
                the default solid text-kind button is white-on-white (invisible)
                in dark mode. */}
            <AppButton title={t('checkout.skip')} kind="text" variant="ghost" size="sm" onPress={onSkip} />
          </AppView>
        </>
      )}
    </AppView>
  );
}

function LinkAction({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <AppPressableView onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
      <AppText family="accent" weight="bold" style={{ fontSize: 13, color }}>{label}</AppText>
    </AppPressableView>
  );
}

// ── Payment row (selectable) ───────────────────────────────────────────

function PaymentRow({
  option,
  selected,
  onPress,
  tokens,
}: {
  option: PaymentOption;
  selected: boolean;
  onPress: () => void;
  tokens: Tokens;
}) {
  const Icon = option.icon;
  const { t } = useTranslation();
  return (
    <AppPressableView
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={t(option.labelKey)}
      rounded={16}
      p={14}
      colorName="card"
      borderWidth={1}
      borderName={selected ? undefined : 'border'}
      style={selected ? { borderWidth: 1.5, borderColor: tokens.text } : undefined}
    >
      <AppView row align="center" gap={12}>
        <Icon size={20} strokeWidth={2} color={tokens.text} />
        <AppView flex={1}>
          <AppText family="default" weight="semibold" style={{ fontSize: 15, color: tokens.text }}>{t(option.labelKey)}</AppText>
          <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: 1 }}>{t(option.descriptionKey)}</AppText>
        </AppView>
        <AppView
          center
          rounded={999}
          style={{
            width: 22,
            height: 22,
            borderWidth: selected ? 0 : 1.5,
            borderColor: tokens.border,
            backgroundColor: selected ? tokens.text : 'transparent',
          }}
        >
          {selected ? <Check size={14} strokeWidth={3} color={tokens.background} /> : null}
        </AppView>
      </AppView>
    </AppPressableView>
  );
}

function SectionLabel({ tokens, children }: { tokens: Tokens; children: string }) {
  return (
    <AppText family="accent" weight="bold" style={{ fontSize: 12, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 }}>
      {children}
    </AppText>
  );
}

function SectionCard({ label, main, sub, onChange, tokens }: { label: string; main: string; sub: string; onChange?: () => void; tokens: Tokens }) {
  const { t } = useTranslation();
  return (
    <AppView rounded={16} p={16} colorName="card" borderWidth={1} borderName="border">
      <AppView row align="center" justify="space-between" style={{ marginBottom: 8 }}>
        <SectionLabel tokens={tokens}>{label}</SectionLabel>
        {onChange ? (
          <AppPressableView onPress={onChange} accessibilityRole="button" accessibilityLabel={t('checkout.changeLabel', { label })}>
            <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.text }}>{t('checkout.change')}</AppText>
          </AppPressableView>
        ) : null}
      </AppView>
      <AppText family="default" weight="semibold" style={{ fontSize: 15, color: tokens.text }}>{main}</AppText>
      <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted, marginTop: 2 }}>{sub}</AppText>
    </AppView>
  );
}

function SummaryRow({ label, value, tokens }: { label: string; value: string; tokens: Tokens }) {
  return (
    <AppView row justify="space-between">
      <AppText family="default" style={{ fontSize: 13.5, color: tokens.textMuted }}>{label}</AppText>
      <AppText family="accent" weight="semibold" style={{ fontSize: 13.5, color: tokens.text }}>{value}</AppText>
    </AppView>
  );
}
