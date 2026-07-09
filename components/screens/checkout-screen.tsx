import { router } from 'expo-router';
import { AlertCircle, ArrowLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView } from 'react-native';

import { WheelLoader } from '@/components/shared/wheel-loader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useAddresses, useCreateOrder, usePaymentMethods, useShippingQuote } from '@/hooks/use-orders';
import { parsePrice } from '@/services/cart-math';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Checkout — faithful rebuild of the prototype's `scCheckout`, now on the
 * real orders layer. Shipping + payment section cards cycle through the
 * server's address / card / shipping lists (`useAddresses`,
 * `usePaymentMethods`, `useShippingQuote`). "Place order" builds a
 * `CreateOrderInput` from the cart + selections, calls
 * `useCreateOrder().placeOrder`, clears the cart, and hands the created
 * order id to the confirmation screen via a route param.
 */
export default function CheckoutScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { items, totals, appliedPromo, formatCurrency, clearCart } = useCartContext();

  const addresses = useAddresses();
  const payments = usePaymentMethods();

  const [addrIdx, setAddrIdx] = useState(0);
  const [cardIdx, setCardIdx] = useState(0);
  const [shipIdx, setShipIdx] = useState(0);

  // Default the card to the one the server marks default; addresses have no
  // default flag so we take the first. We track selections by index and clamp
  // on read so a shorter-than-expected list never crashes.
  const defaultCardIdx = Math.max(payments.items.findIndex((c) => c.isDefault), 0);
  const addr = addresses.items[addrIdx] ?? addresses.items[0];
  const card = payments.items[cardIdx] ?? payments.items[defaultCardIdx] ?? payments.items[0];

  // Shipping quote depends on the selected address + current subtotal.
  const shippingRequest = useMemo(
    () => (addr ? { addressId: addr.id, subtotal: totals.subtotal } : null),
    [addr, totals.subtotal],
  );
  const shipping = useShippingQuote(shippingRequest);
  const shipOption = shipping.options[shipIdx] ?? shipping.options[0];

  const create = useCreateOrder();

  const collectionsLoading = addresses.state === 'loading' || payments.state === 'loading';
  const collectionsError =
    addresses.state === 'error' || payments.state === 'error'
      ? addresses.error ?? payments.error ?? 'Could not load checkout details.'
      : null;

  const grandTotal = totals.total + (shipOption?.price ?? 0);

  const placeOrder = async () => {
    if (items.length === 0 || !addr || !card || !shipOption) return;
    triggerHaptic('success');
    const result = await create.placeOrder({
      items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
      addressId: addr.id,
      paymentMethodId: card.id,
      shippingOptionKey: shipOption.key,
      promoCode: appliedPromo?.code ?? null,
      totalLabel: formatCurrency(grandTotal),
    });
    if (!result) return; // hook surfaced the error; stay on the screen.
    clearCart();
    router.replace({
      pathname: '/order-confirmation',
      params: { orderId: result.orderId },
    });
  };

  if (collectionsLoading) {
    return (
      <AppView flex={1} colorName="background" center>
        <WheelLoader size={30} color={tokens.text} />
      </AppView>
    );
  }

  if (collectionsError || !addr || !card) {
    return (
      <AppView flex={1} colorName="background" center px="xl" gap={12}>
        <AlertCircle size={32} strokeWidth={2} color={tokens.error} />
        <AppText family="default" style={{ color: tokens.textMuted, textAlign: 'center' }}>
          {collectionsError ?? 'No addresses or cards available.'}
        </AppText>
        <AppButton
          title="Retry"
          kind="secondary"
          size="sm"
          onPress={() => {
            addresses.refresh();
            payments.refresh();
          }}
        />
      </AppView>
    );
  }

  return (
    <AppView flex={1} colorName="background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + 6, paddingBottom: 24 }}
      >
        {/* Header */}
        <AppView row align="center" gap={12} px="lg" style={{ paddingBottom: 14 }}>
          <AppPressableView onPress={() => router.back()} center rounded={12} borderWidth={1} borderName="border" accessibilityRole="button" accessibilityLabel="Back" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} style={{ width: 40, height: 40 }}>
            <ArrowLeft size={22} strokeWidth={2.2} color={tokens.text} />
          </AppPressableView>
          <AppText family="heading" weight="bold" style={{ fontSize: 20, color: tokens.text }}>Checkout</AppText>
        </AppView>

        <AppView px="lg" gap={16}>
          <SectionCard
            label="Shipping address"
            main={addr.label}
            sub={`${addr.line1}, ${addr.city}`}
            onChange={
              addresses.items.length > 1
                ? () => setAddrIdx((i) => (i + 1) % addresses.items.length)
                : undefined
            }
            tokens={tokens}
          />
          <SectionCard
            label="Payment"
            main={`${card.brand} ···· ${card.last4}`}
            sub={`Expires ${card.exp}`}
            onChange={
              payments.items.length > 1
                ? () => setCardIdx((i) => (i + 1) % payments.items.length)
                : undefined
            }
            tokens={tokens}
          />

          {/* Shipping option */}
          {shipOption ? (
            <SectionCard
              label="Shipping"
              main={`${shipOption.label} · ${shipOption.price === 0 ? 'Free' : formatCurrency(shipOption.price)}`}
              sub={shipOption.eta}
              onChange={
                shipping.options.length > 1
                  ? () => setShipIdx((i) => (i + 1) % shipping.options.length)
                  : undefined
              }
              tokens={tokens}
            />
          ) : null}

          {/* Order summary */}
          <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text, marginTop: 4 }}>Order summary</AppText>
          <AppView gap={10}>
            {items.map((item) => (
              <AppView key={item.id} row justify="space-between">
                <AppText family="default" style={{ fontSize: 13.5, color: tokens.textMuted, flex: 1 }} numberOfLines={1}>
                  {item.title} × {item.quantity}
                </AppText>
                <AppText family="accent" weight="semibold" style={{ fontSize: 13.5, color: tokens.text }}>
                  {formatCurrency(parsePrice(item.price) * item.quantity)}
                </AppText>
              </AppView>
            ))}
            <AppView style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 4 }} />
            <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal)} tokens={tokens} />
            {totals.discount > 0 ? (
              <SummaryRow label="Discount" value={`−${formatCurrency(totals.discount)}`} tokens={tokens} />
            ) : null}
            <SummaryRow label="Shipping" value={shipOption && shipOption.price > 0 ? formatCurrency(shipOption.price) : 'Free'} tokens={tokens} />
            <SummaryRow label="Tax" value={formatCurrency(totals.tax)} tokens={tokens} />
            <AppView row justify="space-between">
              <AppText family="accent" weight="bold" style={{ fontSize: 16, color: tokens.text }}>Total</AppText>
              <AppText family="heading" weight="bold" style={{ fontSize: 18, color: tokens.text }}>{formatCurrency(grandTotal)}</AppText>
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
          title={create.phase === 'placing' ? 'Placing order…' : `Place order · ${formatCurrency(grandTotal)}`}
          kind="brand"
          size="lg"
          fullWidth
          disabled={items.length === 0 || create.phase === 'placing'}
          onPress={placeOrder}
        />
      </AppView>
    </AppView>
  );
}

function SectionCard({ label, main, sub, onChange, tokens }: { label: string; main: string; sub: string; onChange?: () => void; tokens: ReturnType<typeof useThemeContext>['tokens'] }) {
  return (
    <AppView rounded={16} p={16} colorName="card" borderWidth={1} borderName="border">
      <AppView row align="center" justify="space-between" style={{ marginBottom: 8 }}>
        <AppText family="accent" weight="bold" style={{ fontSize: 12, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 }}>
          {label}
        </AppText>
        {onChange ? (
          <AppPressableView onPress={onChange} accessibilityRole="button" accessibilityLabel={`Change ${label}`}>
            <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.text }}>Change</AppText>
          </AppPressableView>
        ) : null}
      </AppView>
      <AppText family="default" weight="semibold" style={{ fontSize: 15, color: tokens.text }}>{main}</AppText>
      <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted, marginTop: 2 }}>{sub}</AppText>
    </AppView>
  );
}

function SummaryRow({ label, value, tokens }: { label: string; value: string; tokens: ReturnType<typeof useThemeContext>['tokens'] }) {
  return (
    <AppView row justify="space-between">
      <AppText family="default" style={{ fontSize: 13.5, color: tokens.textMuted }}>{label}</AppText>
      <AppText family="accent" weight="semibold" style={{ fontSize: 13.5, color: tokens.text }}>{value}</AppText>
    </AppView>
  );
}
