import { router } from 'expo-router';
import { AlertCircle, ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddressFormSheet, {
  type AddressFormValues,
} from '@/components/screens-components/account/address-form-sheet';
import {
  DeliveryPriceCard,
  DeliverySection,
  PaymentRetryCard,
  PaymentRow,
  SectionLabel,
  SummaryRow,
} from '@/components/screens-components/checkout/checkout-sections';
import { AppButton } from '@/components/shared/app-button';
import { AppPrice } from '@/components/shared/app-price';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { DEFAULT_PAYMENT_TYPE, PAYMENT_OPTIONS } from '@/constants/payment-options';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { cartKeyOf, useCheckoutPayment } from '@/hooks/use-order-payment';
import {
  useAddresses,
  useCreateAddress,
  useCreateOrder,
  useShippingQuote,
  useUpdateAddress,
} from '@/hooks/use-orders';
import { parsePrice } from '@/services/cart-math';
import {
  deliveryRefusalKey,
  resolveCheckoutDelivery,
  type DeliveryMethod,
} from '@/services/checkout-presentation';
import garageService from '@/services/garage-service';
import type { Address, PaymentType } from '@/services/orders-service';
import { triggerHaptic } from '@/utils/haptics';

/** Shown in place of a figure that is not known yet. Never zero. */
const NO_PRICE_YET = '—';

/**
 * Checkout — the Uzbek-market flow. A courier needs a delivery address, because
 * the backend prices the delivery from it; a buyer who skips the address collects
 * the order themselves. Payment is a fixed choice of Payme / Terminal / Cash
 * rather than a stored card. Addresses can be added inline via a bottom-sheet.
 * "Place order" builds a `CreateOrderInput` (addressId may be null) and hands the
 * created order id to the confirmation screen.
 *
 * The delivery price is the only thing the buyer learns about the delivery: no
 * map, distance, route or arrival time is shown here, and the app never talks to a
 * routing provider. Every figure comes from the backend's quote.
 *
 * Payme is paid after the order exists. A payment that does not go through leaves that order
 * unpaid and this screen open on it, with the cart intact: the button then pays that same
 * order again, and nothing here can place a second one by accident. The confirmation screen
 * is reached only once the backend says the order is paid. See `useCheckoutPayment`.
 */
export default function CheckoutScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { items, totals, appliedPromo, pendingIds, formatCurrency, clearCart } = useCartContext();
  const { profile } = useUserContext();

  const addresses = useAddresses();
  const createAddress = useCreateAddress();
  const updateAddress = useUpdateAddress();
  const create = useCreateOrder();

  const goToConfirmation = useCallback((orderId: string) => {
    router.replace({ pathname: '/order-confirmation', params: { orderId } });
  }, []);
  const payment = useCheckoutPayment(goToConfirmation);

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressSkipped, setAddressSkipped] = useState(false);
  const [paymentType, setPaymentType] = useState<PaymentType>(DEFAULT_PAYMENT_TYPE);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('courier');
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

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

  // The server prices its own copy of the cart and address, so this asks again when
  // either changes, and waits for cart changes still on their way to the server. Nothing
  // is asked for pickup, which costs nothing, or while paying an order already priced.
  const cartKey = useMemo(() => items.map((i) => i.id).sort().join(','), [items]);
  const shippingRequest = useMemo(
    () =>
      addr && deliveryMethod === 'courier' && pendingIds.size === 0 && !payment.pending
        ? { addressId: addr.id, location: `${addr.lat ?? ''},${addr.lng ?? ''}`, cartKey }
        : null,
    [addr, deliveryMethod, pendingIds.size, cartKey, payment.pending],
  );
  const shipping = useShippingQuote(shippingRequest);
  const delivery = resolveCheckoutDelivery({
    hasAddress: !!addr,
    addressSkipped,
    method: deliveryMethod,
    quoteState: shipping.state,
    options: shipping.options,
  });
  const grandTotal =
    delivery.fee === null ? null : totals.subtotal - totals.discount + delivery.fee;

  // The server refused the price on placing the order, so what is on screen is out of
  // date: fetch what it would charge now, and the buyer confirms that or nothing.
  const orderRefusalKey = deliveryRefusalKey(create.errorCode);
  useEffect(() => {
    if (orderRefusalKey) shipping.refresh();
    // Only on a new refusal: `shipping` is a new object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderRefusalKey]);

  const chooseAddress = (id: string) => {
    setSelectedAddressId(id);
    setAddressSkipped(false);
    setDeliveryMethod('courier');
    create.reset();
  };

  const cycleAddress = () => {
    if (addrItems.length === 0) return;
    const curIdx = Math.max(0, addrItems.findIndex((a) => a.id === addr?.id));
    chooseAddress(addrItems[(curIdx + 1) % addrItems.length]!.id);
  };

  const openAddressForm = (address: Address | null) => {
    setEditingAddress(address);
    setSheetVisible(true);
  };

  // Rejecting keeps the form open, saying why. A new address is used by the id the server
  // gave it, and a changed one asks for a new quote through its changed point.
  const saveAddress = async (values: AddressFormValues) => {
    if (editingAddress) {
      await updateAddress.mutateAsync({ id: editingAddress.id, input: values });
      create.reset();
    } else {
      const created = await createAddress.mutateAsync(values);
      chooseAddress(created.id);
    }
  };

  const placeOrder = async () => {
    if (items.length === 0 || !delivery.ready || grandTotal === null || payment.phase !== 'idle') {
      return;
    }
    triggerHaptic('success');
    const result = await create.placeOrder({
      items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
      addressId: addr?.id ?? null,
      paymentType,
      shippingOptionKey: delivery.method,
      confirmedDeliveryUzs: delivery.method === 'courier' ? delivery.fee : null,
      deliveryQuoteId: delivery.method === 'courier' ? delivery.quoteId : null,
      promoCode: appliedPromo?.code ?? null,
      totalLabel: formatCurrency(grandTotal),
      // Backend order is built from the server cart; these tag it with the
      // buyer's vehicle + contact number (both optional server-side).
      vehicleId: garageService.getPrimary()?.id,
      contactPhone: profile?.phone ?? undefined,
    });
    if (!result) return; // hook surfaced the error; stay on the screen.

    // Payme is paid online, against the order that now exists. Terminal and cash are paid on
    // delivery, so the order is all there is to do.
    if (paymentType === 'payme') {
      await payment.collect({
        orderId: result.orderId,
        totalLabel: result.totalLabel,
        cartKey: cartKeyOf(items),
      });
      return;
    }
    clearCart();
    goToConfirmation(result.orderId);
  };

  const startOver = async () => {
    await payment.startOver();
    create.reset();
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
          {payment.orderClosed ? (
            <AppView testID="checkout-order-closed" row align="center" gap={8}>
              <AlertCircle size={16} strokeWidth={2} color={tokens.error} />
              <AppText family="default" style={{ fontSize: 12.5, color: tokens.error, flex: 1 }}>
                {t('checkout.paymentOrderClosed')}
              </AppText>
            </AppView>
          ) : null}

          {payment.pending ? (
            <PaymentRetryCard
              tokens={tokens}
              orderId={payment.pending.orderId}
              failure={payment.failure}
              onViewOrder={() =>
                router.push({ pathname: '/track-order', params: { orderId: payment.pending!.orderId } })
              }
              onStartOver={startOver}
            />
          ) : (
            <>
              {/* Delivery address (skipping it means collecting the order) */}
              <DeliverySection
                tokens={tokens}
                addr={addr}
                skipped={addressSkipped}
                canChange={addrItems.length > 1}
                onChange={cycleAddress}
                onAdd={() => openAddressForm(null)}
                onSkip={() => {
                  setAddressSkipped(true);
                  setSelectedAddressId(null);
                  create.reset();
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

              {/* Delivery — the price and nothing else about the trip */}
              {addr || addressSkipped ? (
                <DeliveryPriceCard
                  tokens={tokens}
                  delivery={delivery}
                  canChooseMethod={!!addr}
                  onToggleMethod={() => {
                    setDeliveryMethod((m) => (m === 'courier' ? 'pickup' : 'courier'));
                    create.reset();
                  }}
                  quoteFailed={
                    shipping.state === 'error' ||
                    (shipping.state === 'success' && delivery.fee === null)
                  }
                  quoteErrorCode={shipping.errorCode}
                  onRetry={shipping.refresh}
                  onEditAddress={() => openAddressForm(addr)}
                  formatCurrency={formatCurrency}
                />
              ) : null}
            </>
          )}

          {/* Order summary: what the unpaid order holds, or what this order would */}
          <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text, marginTop: 4 }}>{t('checkout.orderSummary')}</AppText>
          {payment.pending ? (
            <AppView gap={10}>
              {(payment.order?.items ?? []).map((line) => (
                <AppView key={line.id} row justify="space-between">
                  <AppText family="default" style={{ fontSize: 13.5, color: tokens.textMuted, flex: 1 }}>
                    {line.title} × {line.quantity}
                  </AppText>
                  <AppText family="accent" weight="semibold" style={{ fontSize: 13.5, color: tokens.text }}>
                    {line.price}
                  </AppText>
                </AppView>
              ))}
              <AppView row justify="space-between">
                <AppText family="accent" weight="bold" style={{ fontSize: 16, color: tokens.text }}>{t('checkout.total')}</AppText>
                <AppPrice value={payment.order?.totalLabel ?? payment.pending.totalLabel} size={18} color={tokens.text} />
              </AppView>
            </AppView>
          ) : (
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
                label={t('checkout.deliveryPriceLabel')}
                value={
                  delivery.fee === null
                    ? NO_PRICE_YET
                    : delivery.fee > 0
                      ? formatCurrency(delivery.fee)
                      : t('checkout.free')
                }
                tokens={tokens}
              />
              <AppView row justify="space-between">
                <AppText family="accent" weight="bold" style={{ fontSize: 16, color: tokens.text }}>{t('checkout.total')}</AppText>
                <AppPrice
                  value={grandTotal === null ? NO_PRICE_YET : formatCurrency(grandTotal)}
                  size={18}
                  color={tokens.text}
                />
              </AppView>
            </AppView>
          )}

          {create.error ? (
            <AppView row align="center" gap={8}>
              <AlertCircle size={16} strokeWidth={2} color={tokens.error} />
              <AppText family="default" style={{ fontSize: 12.5, color: tokens.error, flex: 1 }}>
                {orderRefusalKey ? t(orderRefusalKey) : create.error}
              </AppText>
            </AppView>
          ) : null}
        </AppView>
      </ScrollView>

      {/* Sticky place order */}
      <AppView colorName="background" px="lg" style={{ paddingTop: 14, paddingBottom: Math.max(insets.bottom, 20), borderTopWidth: 1, borderTopColor: tokens.divider }}>
        <AppButton
          testID="checkout-place-order-btn"
          title={
            payment.phase === 'paying'
              ? t('checkout.payingOrder')
              : payment.pending
                ? t('checkout.retryPayment', {
                    total: payment.order?.totalLabel ?? payment.pending.totalLabel,
                  })
                : create.phase === 'placing'
                  ? t('checkout.placingOrder')
                  : grandTotal === null
                    ? t('checkout.placeOrderNoTotal')
                    : t('checkout.placeOrder', { total: formatCurrency(grandTotal) })
          }
          kind="brand"
          size="lg"
          fullWidth
          disabled={
            payment.phase !== 'idle' ||
            (!payment.pending &&
              (items.length === 0 || create.phase === 'placing' || !delivery.ready))
          }
          onPress={payment.pending ? payment.retry : placeOrder}
        />
      </AppView>

      <AddressFormSheet
        visible={sheetVisible}
        initial={editingAddress}
        onClose={() => setSheetVisible(false)}
        onSubmit={saveAddress}
      />
    </AppView>
  );
}
