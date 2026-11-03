import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppPressableView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

import { ROW_ICON } from './like-button';

/** Drawn at 36; hitSlop keeps the touch target at 48 × 48. */
const BUTTON_SIZE = 36;

/**
 * The row's add action: a small teal circle with a plus. Silent add with haptic
 * feedback; the row owns the duplicate-tap guard, and the quantity picker lives on
 * the product detail page. An unavailable part can't be added, and the row says so.
 */
export default function AddToCartButton({
  onPress,
  outOfStock = false,
}: {
  onPress: () => void;
  outOfStock?: boolean;
}) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  const handlePress = () => {
    triggerHaptic('success');
    onPress();
  };

  return (
    <AppPressableView
      center
      rounded={999}
      androidRipple={false}
      pressedOpacity={0.8}
      disabled={outOfStock}
      onPress={handlePress}
      hitSlop={(48 - BUTTON_SIZE) / 2}
      accessibilityRole="button"
      accessibilityLabel={outOfStock ? t('catalog.outOfStock') : t('search.addToCartA11y')}
      accessibilityState={{ disabled: outOfStock }}
      style={{
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        flexShrink: 0,
        backgroundColor: outOfStock ? tokens.disabledBg : tokens.brand,
      }}
    >
      <Plus
        size={ROW_ICON.size}
        strokeWidth={ROW_ICON.strokeWidth}
        color={outOfStock ? tokens.disabledFg : tokens.onBrand}
      />
    </AppPressableView>
  );
}
