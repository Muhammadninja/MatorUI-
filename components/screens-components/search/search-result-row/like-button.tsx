import { Heart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppPressableView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

/** Shared with the add button, so the row's two icons match. */
export const ROW_ICON = { size: 20, strokeWidth: 2.2 } as const;

export default function LikeButton(props: { liked: boolean; onToggle: () => void }) {
  const { liked, onToggle } = props;
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  const handlePress = () => {
    triggerHaptic(liked ? 'selection' : 'success');
    onToggle();
  };

  // Neutral in both states: the fill is what marks a saved part, in the theme's
  // text colour rather than a red flag.
  return (
    <AppPressableView
      center
      androidRipple={false}
      pressedOpacity={0.7}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={t(
        liked ? 'itemDetail.removeFromFavorites' : 'itemDetail.saveToFavorites',
      )}
      accessibilityState={{ selected: liked }}
      // Reserves 32 × 40 beside the title, centred over the add button below it; hitSlop makes the target 48 × 48.
      hitSlop={{ top: 4, bottom: 4, left: 8, right: 8 }}
      style={{ width: 32, height: 40, marginTop: -10, marginRight: 2, flexShrink: 0 }}
    >
      <Heart
        size={ROW_ICON.size}
        strokeWidth={ROW_ICON.strokeWidth}
        color={liked ? tokens.text : tokens.textMuted}
        fill={liked ? tokens.text : 'transparent'}
      />
    </AppPressableView>
  );
}
