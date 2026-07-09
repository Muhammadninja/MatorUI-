import { ScrollView } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { MATOR_CATEGORIES, type MatorCategory } from '@/mocks/mator-catalog';
import { triggerHaptic } from '@/utils/haptics';

export type CategoryChipsProps = {
  selected: MatorCategory | 'All';
  onSelect: (cat: MatorCategory | 'All') => void;
  /** Chip set to render. Defaults to the prototype's static categories;
   *  the Explore screen passes the server-driven list from the home feed. */
  categories?: readonly (MatorCategory | 'All')[];
};

/** Horizontal category pills from the prototype's Explore chip row. */
export default function CategoryChips({
  selected,
  onSelect,
  categories = MATOR_CATEGORIES,
}: CategoryChipsProps) {
  const { tokens } = useThemeContext();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 20 }}
      style={{ marginHorizontal: -20 }}
    >
      {categories.map((cat) => {
        const active = cat === selected;
        return (
          <AppPressableView
            key={cat}
            onPress={() => {
              triggerHaptic('selection');
              onSelect(cat);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            androidRipple={false}
            rounded={999}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 9,
              borderWidth: 1,
              borderColor: active ? tokens.brandBg : tokens.border,
              backgroundColor: active ? tokens.brandBg : 'transparent',
            }}
          >
            <AppText
              family="accent"
              weight="semibold"
              style={{ fontSize: 13, color: active ? tokens.onBrand : tokens.text }}
            >
              {cat}
            </AppText>
          </AppPressableView>
        );
      })}
    </ScrollView>
  );
}
