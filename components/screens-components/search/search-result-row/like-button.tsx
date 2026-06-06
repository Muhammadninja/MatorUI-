import { Heart } from 'lucide-react-native';

import { AppPressableView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

export default function LikeButton(props: {
  liked: boolean;
  onToggle: () => void;
}) {
  const { liked, onToggle } = props;
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';

  const handlePress = () => {
    triggerHaptic(liked ? 'selection' : 'success');
    onToggle();
  };

  // Liked state uses the theme's text color (black in light mode, white
  // in dark mode) so the filled heart reads as a deliberate brand
  // accent rather than a red flag. Unliked stays neutral gray.
  const likedColor = tokens.text;
  const heartColor = liked ? likedColor : tokens.gray400;

  return (
    <AppPressableView
      center
      rounded={36}
      onPress={handlePress}
      androidRipple
      accessibilityLabel={liked ? 'Unlike' : 'Like'}
      accessibilityRole="button"
      hitSlop={8}
      style={{
        width: 32,
        height: 32,
        backgroundColor: isDark ? tokens.gray200 : tokens.gray100,
        borderWidth: 1,
        borderColor: liked ? likedColor : tokens.border,
      }}
    >
      <Heart
        size={16}
        strokeWidth={2.4}
        color={heartColor}
        fill={liked ? likedColor : 'transparent'}
      />
    </AppPressableView>
  );
}
