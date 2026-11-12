import type { TFunction } from 'i18next';
import { MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import {
  CheckoutSheet,
  OrderItemRows,
} from '@/components/screens-components/checkout/checkout-review';
import {
  DeliveryOptionsCard,
  DeliverySection,
  PaymentRow,
  SummaryRow,
} from '@/components/screens-components/checkout/checkout-sections';
import { PickupPoints } from '@/components/screens-components/checkout/pickup-points';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { PAYMENT_OPTIONS } from '@/constants/payment-options';
import { useThemeContext } from '@/contexts/theme.context';
import type { CartItem } from '@/contexts/cart.context';
import type { usePickupPoints } from '@/hooks/use-pickup-points';
import { parsePrice } from '@/services/cart-math';
import {
  formatAddressLine,
  quoteErrorKey,
  type CheckoutDelivery,
  type CourierOffer,
  type DeliveryMethod,
} from '@/services/checkout-presentation';
import type { Address, PaymentType } from '@/services/orders-service';
import { groupLinesByPickup } from '@/services/pickup-points';

type Tokens = ReturnType<typeof useThemeContext>['tokens'];
type Pickup = ReturnType<typeof usePickupPoints>;

export type CheckoutSheetName = 'delivery' | 'pickup' | 'address' | 'payment' | 'items';

type ReviewText = {
  value: string;
  detail?: string | null;
  missing?: boolean;
  error?: boolean;
};

/**
 * What the Доставка and Адрес rows say, from the checkout's own state. A courier needs an
 * address first; pickup shows where the order is collected instead of an address.
 */
export function reviewSummaries({
  t,
  formatCurrency,
  addr,
  addressSkipped,
  delivery,
  courier,
  pickup,
  onOpen,
}: {
  t: TFunction;
  formatCurrency: (amount: number) => string;
  addr: Address | null;
  addressSkipped: boolean;
  delivery: CheckoutDelivery;
  courier: CourierOffer | null;
  pickup: Pickup;
  onOpen: (sheet: CheckoutSheetName) => void;
}): {
  deliveryReview: ReviewText;
  addressReview: ReviewText & { label: string; onPress: () => void };
} {
  const pickupChosen = delivery.method === 'pickup';
  const deliveryReview: ReviewText =
    !addr && !addressSkipped
      ? { value: t('checkout.reviewChooseAddress'), missing: true }
      : pickupChosen
        ? { value: t('checkout.pickup'), detail: t('checkout.free') }
        : courier?.state === 'priced'
          ? {
              value: t('checkout.courierMator'),
              detail: courier.price > 0 ? formatCurrency(courier.price) : t('checkout.free'),
            }
          : courier?.state === 'refused'
            ? { value: t('checkout.courierMator'), detail: t(quoteErrorKey(courier.code)), error: true }
            : { value: t('checkout.courierMator'), detail: t('checkout.deliveryCalculating') };

  if (!pickupChosen) {
    return {
      deliveryReview,
      addressReview: {
        label: t('checkout.deliveryAddress'),
        value: addr ? addr.label : t('checkout.reviewChooseAddress'),
        detail: addr ? formatAddressLine(addr) || null : null,
        missing: !addr,
        onPress: () => onOpen('address'),
      },
    };
  }

  const first = pickup.points[0];
  const ready = pickup.state === 'success' && first;
  const more = pickup.points.length > 1 ? t('checkout.reviewPickupMore', { count: pickup.points.length - 1 }) : null;
  return {
    deliveryReview,
    addressReview: {
      label: t('checkout.reviewPickupPoint'),
      value: ready
        ? first.dealerName ?? first.address ?? t('checkout.reviewPickupPoint')
        : pickup.state === 'error'
          ? t('checkout.pickupPointsError')
          : t('checkout.pickupPointsLoading'),
      detail: ready ? [first.dealerName ? first.address : null, more].filter(Boolean).join(' · ') || null : null,
      error: pickup.state === 'error',
      // Where to collect has a sheet of its own; the delivery picker stays a picker.
      onPress: () => onOpen('pickup'),
    },
  };
}

/**
 * The checkout's choice sheets: delivery (with the pickup points), address, payment and the
 * order's lines. Each holds the existing choice components, so eligibility, pricing and
 * validation are exactly what they were; only one is open at a time.
 */
export function CheckoutChoiceSheets({
  open,
  onClose,
  tokens,
  addr,
  addressSkipped,
  canChangeAddress,
  onCycleAddress,
  onAddAddress,
  onEditAddress,
  onSkipAddress,
  delivery,
  courier,
  onChooseMethod,
  onRetryQuote,
  pickup,
  paymentType,
  onChoosePayment,
  items,
  productsSubtotal,
  formatCurrency,
}: {
  open: CheckoutSheetName | null;
  onClose: () => void;
  tokens: Tokens;
  addr: Address | null;
  addressSkipped: boolean;
  canChangeAddress: boolean;
  onCycleAddress: () => void;
  onAddAddress: () => void;
  onEditAddress: () => void;
  onSkipAddress: () => void;
  delivery: CheckoutDelivery;
  courier: CourierOffer | null;
  onChooseMethod: (method: DeliveryMethod) => void;
  onRetryQuote: () => void;
  pickup: Pickup;
  paymentType: PaymentType;
  onChoosePayment: (type: PaymentType) => void;
  items: CartItem[];
  productsSubtotal: number;
  formatCurrency: (amount: number) => string;
}) {
  const { t } = useTranslation();
  const lines = items.map((item) => ({
    id: item.id,
    title: item.title,
    quantity: item.quantity,
    total: formatCurrency(parsePrice(item.price) * item.quantity),
  }));
  // Collected from several places: the lines grouped by where each is picked up.
  const groups = delivery.method === 'pickup' && pickup.state === 'success' ? groupLinesByPickup(lines, pickup.points) : null;
  return (
    <>
      <CheckoutSheet testID="checkout-sheet-delivery" visible={open === 'delivery'} onClose={onClose} title={t('checkout.shipping')}>
        {addr || addressSkipped ? (
          <DeliveryOptionsCard
            bare
            tokens={tokens}
            delivery={delivery}
            courier={courier}
            onChooseMethod={onChooseMethod}
            onRetry={onRetryQuote}
            onEditAddress={onEditAddress}
            formatCurrency={formatCurrency}
          />
        ) : null}
      </CheckoutSheet>

      {/* The place, its address and map: never the goods, which the order's sheet lists. */}
      <CheckoutSheet testID="checkout-sheet-pickup" visible={open === 'pickup'} onClose={onClose} title={t('checkout.reviewPickupPoint')}>
        <PickupPoints
          bare
          showItems={false}
          tokens={tokens}
          state={pickup.state}
          points={pickup.points}
          onRetry={pickup.refresh}
        />
      </CheckoutSheet>

      <CheckoutSheet testID="checkout-sheet-address" visible={open === 'address'} onClose={onClose} title={t('checkout.deliveryAddress')}>
        {/* Skipping the address means collecting the order. */}
        <DeliverySection
          bare
          tokens={tokens}
          addr={addr}
          skipped={addressSkipped}
          canChange={canChangeAddress}
          onChange={onCycleAddress}
          onAdd={onAddAddress}
          onSkip={onSkipAddress}
        />
      </CheckoutSheet>

      <CheckoutSheet testID="checkout-sheet-payment" visible={open === 'payment'} onClose={onClose} title={t('checkout.payment')}>
        {PAYMENT_OPTIONS.map((opt) => (
          <PaymentRow
            key={opt.id}
            option={opt}
            selected={paymentType === opt.id}
            onPress={() => onChoosePayment(opt.id)}
            tokens={tokens}
          />
        ))}
      </CheckoutSheet>

      <CheckoutSheet
        testID="checkout-sheet-items"
        visible={open === 'items'}
        onClose={onClose}
        title={t('checkout.reviewItems')}
        heightFraction={0.85}
        footer={
          <SummaryRow
            testID="checkout-items-subtotal"
            label={t('checkout.subtotal')}
            value={formatCurrency(productsSubtotal)}
            valueColor={tokens.brandText}
            tokens={tokens}
          />
        }
      >
        {groups ? (
          groups.map((group) => (
            <AppView key={group.key} testID="checkout-items-group" gap={10} style={{ paddingBottom: 6 }}>
              <AppView row align="center" gap={6}>
                <MapPin size={14} strokeWidth={2} color={tokens.textMuted} />
                <AppText family="accent" weight="bold" style={{ flex: 1, fontSize: 13, color: tokens.textMuted }}>
                  {group.point
                    ? [group.point.dealerName ?? t('checkout.pickupDealerUnknown'), group.point.address].filter(Boolean).join(' · ')
                    : t('checkout.pickupDealerUnknown')}
                </AppText>
              </AppView>
              <OrderItemRows tokens={tokens} lines={group.lines} />
            </AppView>
          ))
        ) : (
          <OrderItemRows tokens={tokens} lines={lines} />
        )}
      </CheckoutSheet>
    </>
  );
}
