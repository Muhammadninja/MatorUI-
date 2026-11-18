import { router } from 'expo-router';
import { AlertCircle, ArrowLeft } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddressFormSheet, {
  type AddressFormValues,
} from '@/components/screens-components/account/address-form-sheet';
import {
  LinkAction,
  NO_PRICE_YET,
  OrderChargeRows,
  PaymentOptionMark,
  PaymentRetryCard,
  SummaryRow,
} from '@/components/screens-components/checkout/checkout-sections';
import { ReviewRow } from '@/components/screens-components/checkout/checkout-review';
import {
  CheckoutChoiceSheets,
  reviewSummaries,
  type CheckoutSheetName,
} from '@/components/screens-components/checkout/checkout-choice-sheets';
import { StockShortagePanel } from '@/components/screens-components/checkout/stock-shortage-panel';
import { OrderLinePrice } from '@/components/screens-components/orders/order-price-breakdown';
import { AppButton } from '@/components/shared/app-button';
import { AppPrice } from '@/components/shared/app-price';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { DEFAULT_PAYMENT_TYPE, PAYMENT_OPTIONS } from '@/constants/payment-options';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import {
  type ShortageAlternative,
  type StockShortageLine,
  alternativeQuantity,
  stockShortageLines,
} from '@/services/stock-shortage';
import { cartKeyOf, useCheckoutPayment } from '@/hooks/use-order-payment';
import {
  useAddresses,
  useCreateAddress,
  useCreateOrder,
  useShippingQuote,
  useUpdateAddress,
} from '@/hooks/use-orders';
import { usePickupPoints } from '@/hooks/use-pickup-points';
import {
  checkoutTotal,
  courierOffer,
  orderRefusalKey,
  resolveCheckoutDelivery,
  type DeliveryMethod,
} from '@/services/checkout-presentation';
import garageService from '@/services/garage-service';
import type { Address, PaymentType } from '@/services/orders-service';
import { pickupCartKey } from '@/services/pickup-points';
import { triggerHaptic } from '@/utils/haptics';
import { checkoutFooterBottom } from '@/utils/sticky-footer';

/**
 * Checkout — the Uzbek-market flow. The buyer chooses pickup or Mator's courier, seeing
 * both: pickup is free, and the courier's price is the backend's for the chosen address.
 * A courier needs a delivery address, because the backend prices the delivery from it; a
 * buyer who skips the address collects the order themselves. Payment is a fixed choice of
 * Payme / Terminal / Cash rather than a stored card. Addresses can be added inline via a
 * bottom-sheet.
 * "Place order" builds a `CreateOrderInput` (addressId may be null) and hands the
 * created order id to the confirmation screen.
 *
 * The delivery price is the only thing the buyer learns about the courier: no
 * map, distance, route or arrival time is shown for it, and the app never talks to a
 * routing provider. Every figure comes from the backend's quote. A buyer who collects the
 * order is shown where: the dealer each part is bought from, with its address and its pin
 * on the existing map, as the backend states them (`PickupPoints`), never a route.
 *
 * So do the cost of the parts and Mator's service fee: the backend's cart states them, and
 * the app works none of it out. The total is shown and the order placed only while those
 * figures match the cart on screen, and the server refuses an order whose total moved since
 * (`ORDER_TOTAL_CHANGED`), after which the figures are fetched again.
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
  const {
    items,
    totals,
    charges,
    appliedPromo,
    pendingIds,
    error: cartError,
    formatCurrency,
    clearCart,
    refresh: refreshCart,
    addItem,
    removeItem,
    incrementItem,
  } = useCartContext();
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
  // One choice sheet at a time; closing it leaves every selection as it was.
  const [openSheet, setOpenSheet] = useState<CheckoutSheetName | null>(null);
  const closeSheet = () => setOpenSheet(null);

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
  // either changes, and waits for cart changes still on their way to the server. It asks
  // whichever way the buyer has chosen, so the courier's price stands beside pickup for them
  // to compare. Nothing is asked without an address, or while paying an order already priced.
  const cartKey = useMemo(() => items.map((i) => i.id).sort().join(','), [items]);
  const shippingRequest = useMemo(
    () =>
      addr && pendingIds.size === 0 && !payment.pending
        ? { addressId: addr.id, location: `${addr.lat ?? ''},${addr.lng ?? ''}`, cartKey }
        : null,
    [addr, pendingIds.size, cartKey, payment.pending],
  );
  const shipping = useShippingQuote(shippingRequest);
  const delivery = resolveCheckoutDelivery({
    hasAddress: !!addr,
    addressSkipped,
    method: deliveryMethod,
    quoteState: shipping.state,
    options: shipping.options,
  });
  const courier = addr
    ? courierOffer({
        quoteState: shipping.state,
        options: shipping.options,
        errorCode: shipping.errorCode,
      })
    : null;
  // Where each dealer's goods are collected: asked while the order would be collected, which
  // includes before any way is chosen, so the warehouse shows from the start. Not while the
  // saved addresses load: one of them may make it the courier's. For the cart as the server
  // has it, so it waits for cart changes still on their way.
  const pickup = usePickupPoints(
    delivery.method === 'pickup' &&
      addresses.state !== 'loading' &&
      items.length > 0 &&
      pendingIds.size === 0 &&
      !payment.pending
      ? pickupCartKey(items)
      : null,
  );
  // The server's own figures for this cart: a sale may have started or ended, or the cart
  // changed on another device, since it was last read.
  useEffect(() => {
    void refreshCart();
    // Once, on opening the checkout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Only while no change to the cart is on its way: until then the server's figures are for
  // the cart as it was.
  const cartSettled = pendingIds.size === 0;
  const settledCharges = cartSettled ? charges : null;
  const grandTotal = checkoutTotal(charges, delivery.fee, cartSettled);

  // The server refused the price or the total on placing the order, so what is on screen is
  // out of date: fetch what it would charge now, and the buyer confirms that or nothing.
  const refusalKey = orderRefusalKey(create.errorCode);
  useEffect(() => {
    if (!refusalKey) return;
    shipping.refresh();
    void refreshCart();
    // Only on a new refusal: `shipping` is a new object every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refusalKey]);

  // Not enough stock: what each part lacks, and the same part at other sellers. The cart is
  // read again so it shows what the server now has; it changes only when the buyer chooses.
  const shortages = useMemo(
    () => stockShortageLines(create.errorCode, create.errorDetails),
    [create.errorCode, create.errorDetails],
  );
  useEffect(() => {
    if (shortages.length > 0) void refreshCart();
    // Only on a new refusal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shortages]);
  const cartTitles = useMemo(
    () => Object.fromEntries(items.map((i) => [i.id, i.title])),
    [items],
  );
  const chooseAlternative = (line: StockShortageLine, alt: ShortageAlternative) => {
    const original = items.find((i) => i.id === line.partId);
    if (original) removeItem(original.id);
    addItem({
      id: alt.partId,
      title: alt.title,
      description: alt.sellerName,
      price: String(alt.priceUzs),
      priceLabel: formatCurrency(alt.priceUzs),
      imageUrl: original?.imageUrl,
    });
    for (let n = 1; n < alternativeQuantity(line, alt); n += 1) incrementItem(alt.partId);
    create.reset();
  };

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

  // The address form is a sheet of its own, so a choice sheet closes before it opens.
  const openAddressForm = (address: Address | null) => {
    setOpenSheet(null);
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
    if ((!create.hasPendingAttempt && (items.length === 0 || !delivery.ready || grandTotal === null)) || payment.phase !== 'idle') {
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
      confirmedTotalUzs: grandTotal ?? 0,
      promoCode: appliedPromo?.code ?? null,
      totalLabel: formatCurrency(grandTotal ?? 0),
      // Backend order is built from the server cart; these tag it with the
      // buyer's vehicle + contact number (both optional server-side).
      vehicleId: garageService.getPrimary()?.id,
      contactPhone: profile?.phone ?? undefined,
    });
    if (!result) return; // hook surfaced the error; stay on the screen.

    // Payme is paid online, against the order that now exists. Terminal and cash are paid on
    // delivery, so the order is all there is to do.
    const submittedAttempt = result.recoveredAttempt;
    const submittedPaymentType = submittedAttempt?.paymentType ?? paymentType;
    if (submittedPaymentType === 'payme') {
      await payment.collect({
        orderId: result.orderId,
        totalLabel: result.totalLabel,
        cartKey: cartKeyOf(submittedAttempt?.items.map((item) => ({ id: item.productId, quantity: item.quantity })) ?? items),
      });
      return;
    }
    if (!submittedAttempt) clearCart();
    goToConfirmation(result.orderId);
  };

  const startOver = async () => {
    await payment.startOver();
    create.reset();
  };

  const { deliveryReview, addressReview } = reviewSummaries({
    t,
    formatCurrency,
    addr,
    addressSkipped,
    delivery,
    courier,
    pickup,
    onOpen: setOpenSheet,
  });
  const paymentOption = PAYMENT_OPTIONS.find((o) => o.id === paymentType);
  const productsSubtotal = settledCharges?.subtotal ?? totals.subtotal;

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
          <AppPressableView onPress={() => router.back()} center rounded={999} borderWidth={1} borderName="border" colorName="surface" accessibilityRole="button" accessibilityLabel={t('checkout.back')} style={{ width: 36, height: 36 }}>
            <ArrowLeft size={18} strokeWidth={2.2} color={tokens.text} />
          </AppPressableView>
          <AppText family="heading" weight="bold" style={{ fontSize: 20, color: tokens.text }}>{t('checkout.title')}</AppText>
        </AppView>

        <AppView px="lg" gap={16}>
          {payment.orderClosed ? (
            <AppView testID="checkout-order-closed" row align="center" gap={8}>
              <AlertCircle size={16} strokeWidth={2} color={tokens.error} />
              <AppText family="default" style={{ fontSize: 12, color: tokens.error, flex: 1 }}>
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
              {/* The review: one compact row per choice, each opening its own sheet. */}
              <AppView testID="checkout-review" rounded={16} colorName="card" borderWidth={1} borderName="border" style={{ paddingHorizontal: 16 }}>
                <ReviewRow
                  tokens={tokens}
                  testID="checkout-review-delivery"
                  label={t('checkout.shipping')}
                  divider={false}
                  {...deliveryReview}
                  onPress={() => setOpenSheet(addr || addressSkipped ? 'delivery' : 'address')}
                />
                <ReviewRow tokens={tokens} testID="checkout-review-address" {...addressReview} />
                <ReviewRow
                  tokens={tokens}
                  testID="checkout-review-payment"
                  label={t('checkout.payment')}
                  value={
                    paymentOption?.logo ? (
                      <PaymentOptionMark option={paymentOption} width={76} iconSize={18} color={tokens.text} />
                    ) : (
                      t(paymentOption?.labelKey ?? 'checkout.payment')
                    )
                  }
                  onPress={() => setOpenSheet('payment')}
                />
                <ReviewRow
                  tokens={tokens}
                  testID="checkout-review-items"
                  label={t('checkout.reviewItems')}
                  value={t('checkout.reviewItemsCount', { count: items.length })}
                  detail={formatCurrency(productsSubtotal)}
                  onPress={() => setOpenSheet('items')}
                />
              </AppView>

              {/* What the order adds on top: Mator's fee, and a discount when there is one. */}
              <AppView gap={8} style={{ paddingHorizontal: 4 }}>
                {(settledCharges?.discount ?? totals.discount) > 0 ? (
                  <SummaryRow
                    label={t('checkout.discount')}
                    value={`−${formatCurrency(settledCharges?.discount ?? totals.discount)}`}
                    tokens={tokens}
                  />
                ) : null}
                {settledCharges?.serviceFee !== 0 ? (
                  <SummaryRow
                    testID="order-service-fee"
                    label={t('checkout.serviceFee')}
                    value={settledCharges ? formatCurrency(settledCharges.serviceFee) : NO_PRICE_YET}
                    tokens={tokens}
                  />
                ) : null}
                {!charges && cartSettled && cartError ? (
                  <AppView testID="checkout-charges-unavailable" row align="center" gap={8}>
                    <AlertCircle size={16} strokeWidth={2} color={tokens.error} />
                    <AppText family="default" style={{ fontSize: 12, color: tokens.error, flex: 1 }}>
                      {t('checkout.totalsUnavailable')}
                    </AppText>
                    <LinkAction label={t('common.retry')} onPress={() => void refreshCart()} color={tokens.brandText} />
                  </AppView>
                ) : null}
              </AppView>
            </>
          )}

          {/* An unpaid order keeps what it was placed with: its own lines and charges. */}
          {payment.pending ? (
            <>
              <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text, marginTop: 4 }}>{t('checkout.orderSummary')}</AppText>
            <AppView gap={10}>
              {(payment.order?.items ?? []).map((line, index) => (
                <AppView key={line.id} row justify="space-between">
                  <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted, flex: 1 }}>
                    {line.title}{line.quantity > 0 ? ` × ${line.quantity}` : ''}
                  </AppText>
                  {payment.order?.pricing ? (
                    <OrderLinePrice line={payment.order.pricing.lines[index]} />
                  ) : (
                    <AppText family="accent" weight="semibold" style={{ fontSize: 14, color: tokens.text }}>
                      {line.price}
                    </AppText>
                  )}
                </AppView>
              ))}
              {/* What the order was placed at: fixed, whatever the cart says now. */}
              {payment.order?.charges ? (
                <>
                  <AppView style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 4 }} />
                  <OrderChargeRows tokens={tokens} charges={payment.order.charges} formatCurrency={formatCurrency} />
                </>
              ) : null}
              <AppView row justify="space-between">
                <AppText family="accent" weight="bold" style={{ fontSize: 16, color: tokens.text }}>{t('checkout.total')}</AppText>
                <AppPrice value={payment.order?.totalLabel ?? payment.pending.totalLabel} size={18} color={tokens.text} />
              </AppView>
            </AppView>
            </>
          ) : null}

          {shortages.length > 0 ? (
            <StockShortagePanel
              lines={shortages}
              titles={cartTitles}
              tokens={tokens}
              formatCurrency={formatCurrency}
              onChoose={chooseAlternative}
            />
          ) : null}

          {/* The return conditions, readable before the buyer pays. */}
          <AppView testID="checkout-refund-policy" row align="center" gap={6} style={{ flexWrap: 'wrap' }}>
            <AppText family="default" style={{ fontSize: 12, color: tokens.textMuted }}>
              {t('checkout.refundPolicyPrefix')}
            </AppText>
            <LinkAction
              label={t('checkout.refundPolicyLink')}
              onPress={() => router.push('/return-policy')}
              color={tokens.brandText}
            />
          </AppView>

          {create.error ? (
            <AppView row align="center" gap={8}>
              <AlertCircle size={16} strokeWidth={2} color={tokens.error} />
              <AppText family="default" style={{ fontSize: 12, color: tokens.error, flex: 1 }}>
                {refusalKey ? t(refusalKey) : create.error}
              </AppText>
            </AppView>
          ) : null}
        </AppView>
      </ScrollView>

      {/* Sticky place order */}
      <AppView testID="checkout-footer" colorName="background" px="lg" gap={12} style={{ paddingTop: 12, paddingBottom: checkoutFooterBottom(insets.bottom, Platform.OS), borderTopWidth: 1, borderTopColor: tokens.divider }}>
        <AppView row align="center" justify="space-between" gap={12}>
          <AppText family="default" weight="medium" style={{ fontSize: 14, color: tokens.textMuted, flexShrink: 1 }}>
            {t('checkout.total')}
          </AppText>
          <AppView testID="checkout-total">
          <AppPrice
            value={
              payment.pending
                ? payment.order?.totalLabel ?? payment.pending.totalLabel
                : grandTotal === null
                  ? NO_PRICE_YET
                  : formatCurrency(grandTotal)
            }
            size={24}
            color={tokens.text}
            // The one figure the buyer confirms: the heaviest weight on the screen.
            fontFamily={{ amount: 'Inter_800ExtraBold', affix: 'Inter_700Bold' }}
          />
          </AppView>
        </AppView>
        <AppButton
          testID="checkout-place-order-btn"
          title={
            payment.phase === 'paying'
              ? t('checkout.payingOrder')
              : payment.pending
                ? t('checkout.retryPaymentShort')
                : create.phase === 'placing'
                  ? t('checkout.placingOrder')
                  : t('checkout.placeOrderNoTotal')
          }
          kind="brand"
          size="lg"
          fullWidth
          disabled={
            payment.phase !== 'idle' ||
            (!payment.pending &&
              (items.length === 0 ||
                create.phase === 'placing' ||
                !delivery.ready ||
                grandTotal === null))
          }
          onPress={payment.pending ? payment.retry : placeOrder}
        />
      </AppView>

      {/* An unpaid order's choices were made when it was placed: nothing to change here. */}
      {payment.pending ? null : (
      <CheckoutChoiceSheets
        open={openSheet}
        onClose={closeSheet}
        tokens={tokens}
        addr={addr}
        addressSkipped={addressSkipped}
        canChangeAddress={addrItems.length > 1}
        onCycleAddress={cycleAddress}
        onAddAddress={() => openAddressForm(null)}
        onEditAddress={() => openAddressForm(addr)}
        onSkipAddress={() => {
          setAddressSkipped(true);
          setSelectedAddressId(null);
          create.reset();
        }}
        delivery={delivery}
        courier={courier}
        onChooseMethod={(method) => {
          setDeliveryMethod(method);
          create.reset();
        }}
        onRetryQuote={shipping.refresh}
        pickup={pickup}
        paymentType={paymentType}
        onChoosePayment={setPaymentType}
        items={items}
        productsSubtotal={productsSubtotal}
        formatCurrency={formatCurrency}
      />
      )}

      <AddressFormSheet
        visible={sheetVisible}
        initial={editingAddress}
        onClose={() => setSheetVisible(false)}
        onSubmit={saveAddress}
      />
    </AppView>
  );
}
