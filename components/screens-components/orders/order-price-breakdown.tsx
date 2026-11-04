import { useTranslation } from 'react-i18next';

import { AppPrice } from '@/components/shared/app-price';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { formatOrderMoney, type OrderLinePricing, type OrderPricing } from '@/services/order-pricing';

/** A line total is never substituted with its unit price or a guessed delta. */
export function OrderLinePrice({ line }: { line?: OrderLinePricing }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const isUnit = line?.lineTotal == null && line?.unitPrice != null;
  return (
    <AppView align="flex-end" gap={2}>
      <AppPrice value={formatOrderMoney(isUnit ? line?.unitPrice : line?.lineTotal)} size={14} color={tokens.text} />
      {isUnit ? <AppText textVariant="bodyXs" colorName="textMuted">{t('trackOrder.unitPrice')}</AppText> : null}
    </AppView>
  );
}

/** Show supplied fields, including explicit zero; unknown fees stay absent. */
export function OrderPriceBreakdown({ pricing }: { pricing?: OrderPricing }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const rows = [
    ['subtotal', 'checkout.subtotal', pricing?.subtotal],
    ['delivery', 'checkout.shipping', pricing?.delivery],
    ['serviceFee', 'checkout.serviceFee', pricing?.serviceFee],
    ['discount', 'checkout.discount', pricing?.discount],
  ] as const;
  return (
    <AppView gap={8} testID="order-price-breakdown">
      {rows.map(([key, label, amount]) => amount == null ? null : (
        <AppView key={key} row justify="space-between" align="center" gap={12} testID={`order-amount-${key}`}>
          <AppText textVariant="bodySm" colorName="textMuted" style={{ flex: 1 }}>{t(label)}</AppText>
          <AppView row align="center" gap={2}>
            {key === 'discount' && amount > 0 ? <AppText colorName="text">−</AppText> : null}
            <AppPrice value={formatOrderMoney(amount)} size={14} color={tokens.text} />
          </AppView>
        </AppView>
      ))}
      <AppView row justify="space-between" align="center" gap={12} testID="order-amount-total">
        <AppText family="default" weight="semibold" colorName="textMuted" style={{ flex: 1 }}>{t('trackOrder.total')}</AppText>
        <AppPrice value={formatOrderMoney(pricing?.total)} size={16} color={tokens.text} />
      </AppView>
      {pricing?.status !== 'confirmed' ? (
        <AppText textVariant="bodySm" colorName="textMuted" testID="order-amount-notice">
          {t(pricing?.status === 'inconsistent' ? 'trackOrder.amountsMismatch' : 'trackOrder.breakdownUnavailable')}
        </AppText>
      ) : null}
    </AppView>
  );
}
