import { Search } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type SearchEntryProps = {
  onPress: () => void;
};

/**
 * Tappable search entry from the prototype's Explore search row: a
 * backgroundSecondary field with a search icon and the placeholder copy.
 */
export default function SearchEntry({ onPress }: SearchEntryProps) {
  const { tokens } = useThemeContext();
  return (
    <AppPressableView
      onPress={onPress}
      accessibilityRole="search"
      accessibilityLabel="Search parts, brands, OEM number"
      androidRipple={false}
      pressedOpacity={0.85}
      row
      align="center"
      gap={10}
      rounded={14}
      px={16}
      py={14}
      colorName="backgroundSecondary"
      borderWidth={1}
      borderName="border"
    >
      <Search size={20} strokeWidth={2.2} color={tokens.textMuted} />
      <AppText family="default" style={{ fontSize: 15, color: tokens.textMuted }}>
        Search parts, brands, OEM #
      </AppText>
    </AppPressableView>
  );
}
