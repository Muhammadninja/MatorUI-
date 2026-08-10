import { Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppIconButton } from '@/components/shared/app-icon-button';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Bottom-right action on the result row. Pairs with `LikeButton` at the
 * top-right so the right column reads as a save/buy action axis. Uses a
 * `Plus` glyph (not `ShoppingCart`) because the cart already lives in
 * the tab bar — "+" reads as "add this," cart would be redundant.
 *
 * Silent add with haptic feedback. Quantity picker lives on the product
 * detail page, not in the list row.
 */
export default function AddToCartButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  const handlePress = () => {
    triggerHaptic('success');
    onPress();
  };

  return (
    <AppIconButton
      Icon={Plus}
      onPress={handlePress}
      size={32}
      iconSize={18}
      strokeWidth={2}
      backgroundColorName="gray100"
      borderColorName="border"
      color={tokens.text}
      accessibilityLabel={t('search.addToCart')}
    />
  );
}
