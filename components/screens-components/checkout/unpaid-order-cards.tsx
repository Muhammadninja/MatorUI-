import { AlertCircle, CircleCheck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { LinkAction } from '@/components/screens-components/checkout/checkout-sections';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import type { useThemeContext } from '@/contexts/theme.context';
import type { CancelFailure } from '@/hooks/use-order-payment';
import {
  paymentFailureKey,
  paymentFailureTitleKey,
  type PaymentFailureReason,
} from '@/services/checkout-presentation';
import { formatOrderNo } from '@/services/orders-service';

type Tokens = ReturnType<typeof useThemeContext>['tokens'];

type CancelProps = {
  onCancel: () => void;
  cancelling: boolean;
  cancelFailure: CancelFailure | null;
};

function CancelLink({ tokens, onCancel, cancelling }: { tokens: Tokens } & Omit<CancelProps, 'cancelFailure'>) {
  const { t } = useTranslation();
  return (
    <LinkAction
      label={cancelling ? t('trackOrder.cancelling') : t('trackOrder.cancelOrder')}
      onPress={cancelling ? () => undefined : onCancel}
      color={tokens.error}
    />
  );
}

function CancelFailureLine({ tokens, failure }: { tokens: Tokens; failure: CancelFailure | null }) {
  const { t } = useTranslation();
  if (!failure) return null;
  return (
    <AppView testID="checkout-cancel-error" row align="center" gap={6}>
      <AlertCircle size={14} strokeWidth={2} color={tokens.error} />
      <AppText family="default" style={{ fontSize: 12.5, color: tokens.error, flex: 1 }}>
        {t(failure === 'refused' ? 'trackOrder.cancelRefused' : 'trackOrder.cancelFailed')}
      </AppText>
    </AppView>
  );
}

// ── Unpaid order, same cart ─────────────────────────────────────────────
// Takes the place of the address, payment and delivery choices: those were made when the
// order was placed, and this pays that order. Choosing differently means cancelling it and
// placing a new one.

export function PaymentRetryCard({
  tokens,
  orderId,
  failure,
  onViewOrder,
  onCancel,
  cancelling,
  cancelFailure,
}: {
  tokens: Tokens;
  orderId: string;
  failure: PaymentFailureReason | null;
  onViewOrder: () => void;
} & CancelProps) {
  const { t } = useTranslation();
  const reason = failure ?? 'unpaid';
  return (
    <AppView testID="checkout-payment-failed" rounded={16} p={16} colorName="card" borderWidth={1} borderName="border" gap={10}>
      <AppView row align="center" gap={8}>
        <AlertCircle size={18} strokeWidth={2} color={tokens.error} />
        <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text, flex: 1 }}>
          {t(paymentFailureTitleKey(reason))}
        </AppText>
      </AppView>
      <AppText family="default" style={{ fontSize: 13.5, color: tokens.text }}>
        {t(paymentFailureKey(reason))}
      </AppText>
      <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted }}>
        {t('checkout.unpaidOrderNumber', { number: formatOrderNo(orderId) })}
      </AppText>
      <AppView row wrap gap={18} style={{ marginTop: 2, rowGap: 8 }}>
        <LinkAction label={t('checkout.viewOrder')} onPress={onViewOrder} color={tokens.text} />
        <CancelLink tokens={tokens} onCancel={onCancel} cancelling={cancelling} />
      </AppView>
      <CancelFailureLine tokens={tokens} failure={cancelFailure} />
      <AppText family="default" style={{ fontSize: 12, color: tokens.textMuted }}>
        {t('checkout.unpaidOrderExpires')}
      </AppText>
    </AppView>
  );
}

// ── Unpaid order, another cart ──────────────────────────────────────────
// The buyer changed the cart since, so this checkout is for a new order. The old one is only
// mentioned, to pay from its own screen or to cancel here; it never blocks the new one.

export function UnpaidOrderNotice({
  tokens,
  orderId,
  totalLabel,
  onPay,
  onCancel,
  cancelling,
  cancelFailure,
}: {
  tokens: Tokens;
  orderId: string;
  totalLabel: string;
  onPay: () => void;
} & CancelProps) {
  const { t } = useTranslation();
  return (
    <AppView
      testID="checkout-other-unpaid"
      rounded={16}
      p={14}
      gap={8}
      style={{ backgroundColor: tokens.warningSoft }}
    >
      <AppView row align="center" gap={8}>
        <AlertCircle size={16} strokeWidth={2.2} color={tokens.warning} />
        <AppText family="accent" weight="bold" style={{ fontSize: 14, color: tokens.text, flex: 1 }}>
          {t('checkout.otherUnpaidTitle')}
        </AppText>
      </AppView>
      <AppText family="default" style={{ fontSize: 13, lineHeight: 18, color: tokens.text }}>
        {totalLabel
          ? t('checkout.otherUnpaidBody', { number: formatOrderNo(orderId), total: totalLabel })
          : t('checkout.otherUnpaidBodyNoTotal', { number: formatOrderNo(orderId) })}
      </AppText>
      <AppView row wrap gap={18} style={{ rowGap: 8 }}>
        <LinkAction label={t('checkout.otherUnpaidPay')} onPress={onPay} color={tokens.text} />
        <CancelLink tokens={tokens} onCancel={onCancel} cancelling={cancelling} />
      </AppView>
      <CancelFailureLine tokens={tokens} failure={cancelFailure} />
    </AppView>
  );
}

/** Said once, after the buyer cancelled the unpaid order from the checkout. */
export function CancelledOrderNote({ tokens, orderId }: { tokens: Tokens; orderId: string }) {
  const { t } = useTranslation();
  return (
    <AppView testID="checkout-order-cancelled" row align="center" gap={8}>
      <CircleCheck size={16} strokeWidth={2} color={tokens.success} />
      <AppText family="default" style={{ fontSize: 12.5, color: tokens.text, flex: 1 }}>
        {t('checkout.unpaidOrderCancelled', { number: formatOrderNo(orderId) })}
      </AppText>
    </AppView>
  );
}
