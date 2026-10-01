import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/shared/app-button';
import { AppPrice } from '@/components/shared/app-price';
import { AppQtyStepper } from '@/components/shared/app-qty-stepper';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type ItemBuyBarProps = {
  /** Pre-formatted line total (unit price × qty). */
  total: string;
  /** Pre-formatted saving on this line; null when nothing is discounted. */
  savingsLabel: string | null;
  qty: number;
  onQtyChange: (next: number) => void;
  /** Out of stock → both CTAs go dead and say why. */
  outOfStock: boolean;
  onAddToCart: () => void;
  onBuyNow: () => void;
  /** Safe-area bottom inset. */
  insetBottom: number;
};

/**
 * Sticky buy bar: line total + savings, the quantity stepper, and the two
 * exits — "Buy now" (add and go straight to checkout) and "Add to cart".
 *
 * The stepper lives here rather than in the page body so quantity can be
 * changed at the moment of purchase, without scrolling back up; the total
 * above it updates as you tap. Out of stock disables both CTAs instead of
 * letting an order be placed that can't be filled.
 */
export function ItemBuyBar({
  total,
  savingsLabel,
  qty,
  onQtyChange,
  outOfStock,
  onAddToCart,
  onBuyNow,
  insetBottom,
}: ItemBuyBarProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppView
      gap={10}
      px="lg"
      colorName="background"
      style={{
        paddingTop: 11,
        paddingBottom: Math.max(insetBottom, 12),
        borderTopWidth: 1,
        borderTopColor: tokens.divider,
      }}
    >
      <AppView row align="center" justify="space-between" gap={12}>
        <AppView gap={2}>
          <AppView row align="center" gap={7}>
            <AppText family="default" style={{ fontSize: 11, color: tokens.textMuted }}>
              {t('itemDetail.total')}
            </AppText>
            {savingsLabel ? (
              <AppView rounded={999} px={6} py={2} style={{ backgroundColor: tokens.successSoft }}>
                <AppText
                  family="accent"
                  weight="bold"
                  style={{ fontSize: 10, color: tokens.success }}
                >
                  {savingsLabel}
                </AppText>
              </AppView>
            ) : null}
          </AppView>
          <AppPrice value={total} size={21} color={tokens.text} />
        </AppView>
        <AppQtyStepper
          value={qty}
          onIncrement={() => onQtyChange(qty + 1)}
          onDecrement={() => onQtyChange(Math.max(1, qty - 1))}
          size="sm"
          disabled={outOfStock}
          testID="item-qty"
        />
      </AppView>

      <AppView row align="center" gap={10}>
        <AppView flex={1}>
          <AppButton
            testID="buy-now-btn"
            title={t('itemDetail.buyNow')}
            kind="secondary"
            size="lg"
            fullWidth
            disabled={outOfStock}
            onPress={onBuyNow}
          />
        </AppView>
        <AppView style={{ flex: 1.25 }}>
          <AppButton
            testID="add-to-cart-btn"
            title={outOfStock ? t('itemDetail.outOfStock') : t('itemDetail.addToCart')}
            kind="brand"
            size="lg"
            fullWidth
            disabled={outOfStock}
            onPress={onAddToCart}
          />
        </AppView>
      </AppView>
    </AppView>
  );
}

export default ItemBuyBar;
