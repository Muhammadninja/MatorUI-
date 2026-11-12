import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

import { RADIUS_PILL } from '../radii';
import { SEARCH_FONT } from './fonts';

/** Drawn at 32; hitSlop keeps the touch target at least 48 tall. */
const BUTTON_HEIGHT = 32;

/**
 * The card's add action: a compact teal «В корзину» pill. Silent add with haptic
 * feedback; the row owns the duplicate-tap guard, and the quantity picker lives on
 * the product detail page. An unavailable part can't be added, and the row says so.
 */
export default function AddToCartButton({
  onPress,
  outOfStock = false,
  testID,
}: {
  onPress: () => void;
  outOfStock?: boolean;
  testID?: string;
}) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  const handlePress = () => {
    triggerHaptic('success');
    onPress();
  };

  return (
    <AppPressableView
      testID={testID}
      center
      androidRipple={false}
      pressedOpacity={0.8}
      disabled={outOfStock}
      onPress={handlePress}
      hitSlop={{ top: (48 - BUTTON_HEIGHT) / 2, bottom: (48 - BUTTON_HEIGHT) / 2, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={outOfStock ? t('catalog.outOfStock') : t('search.addToCartA11y')}
      accessibilityState={{ disabled: outOfStock }}
      style={{
        // About 70% of the details column, left-aligned under the price.
        alignSelf: 'flex-start',
        width: '70%',
        height: BUTTON_HEIGHT,
        paddingHorizontal: 14,
        borderRadius: RADIUS_PILL,
        backgroundColor: outOfStock ? tokens.disabledBg : tokens.brand,
      }}
    >
      <AppText
        style={{
          fontFamily: SEARCH_FONT.semibold,
          fontSize: 13,
          lineHeight: 18,
          color: outOfStock ? tokens.disabledFg : tokens.onBrand,
        }}
      >
        {t('search.addToCart')}
      </AppText>
    </AppPressableView>
  );
}
