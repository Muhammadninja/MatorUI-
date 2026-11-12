import { Heart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppPressableView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

/** The heart's glyph size. */
export const ROW_ICON = { size: 20, strokeWidth: 2.2 } as const;

export default function LikeButton(props: { liked: boolean; onToggle: () => void; testID?: string }) {
  const { liked, onToggle, testID } = props;
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  const handlePress = () => {
    triggerHaptic(liked ? 'selection' : 'success');
    onToggle();
  };

  // A saved part's heart is filled red; an unsaved one is a muted outline.
  return (
    <AppPressableView
      center
      androidRipple={false}
      pressedOpacity={0.7}
      onPress={handlePress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t(
        liked ? 'itemDetail.removeFromFavorites' : 'itemDetail.saveToFavorites',
      )}
      accessibilityState={{ selected: liked }}
      // 40 × 40 in the card's top-right corner; hitSlop makes the target 48 × 48.
      hitSlop={4}
      style={{ width: 40, height: 40, flexShrink: 0 }}
    >
      <Heart
        size={ROW_ICON.size}
        strokeWidth={ROW_ICON.strokeWidth}
        color={liked ? tokens.error : tokens.textMuted}
        fill={liked ? tokens.error : 'transparent'}
      />
    </AppPressableView>
  );
}
