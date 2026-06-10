import { Heart } from 'lucide-react-native';

import { AppIconButton } from '@/components/shared/app-icon-button';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

export default function LikeButton(props: {
  liked: boolean;
  onToggle: () => void;
}) {
  const { liked, onToggle } = props;
  const { tokens } = useThemeContext();

  const handlePress = () => {
    triggerHaptic(liked ? 'selection' : 'success');
    onToggle();
  };

  // Liked state uses the theme's text color (black in light mode, white
  // in dark mode) so the filled heart reads as a deliberate brand
  // accent rather than a red flag. Unliked stays neutral gray.
  const likedColor = tokens.text;

  return (
    <AppView mt={8} mr={8}>
      <AppIconButton
        Icon={Heart}
        onPress={handlePress}
        size={32}
        iconSize={16}
        strokeWidth={2}
        backgroundColorName="gray100"
        borderColorName={liked ? 'text' : 'border'}
        color={liked ? likedColor : tokens.gray400}
        fill={liked ? likedColor : 'transparent'}
        accessibilityLabel={liked ? 'Unlike' : 'Like'}
      />
    </AppView>
  );
}
