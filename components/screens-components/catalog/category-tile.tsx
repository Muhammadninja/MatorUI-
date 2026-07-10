import { memo } from 'react';

import AutoPartIcon from '@/components/screens-components/catalog/auto-part-icon';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type CategoryTileProps = {
  /** Category name (also the icon key). */
  name: string;
  /** Parts count shown under the name. */
  count: number;
  onPress: (name: string) => void;
};

/**
 * `CategoryTile` — a single "Shop by category" grid cell: realistic part icon
 * + name + count on a bordered card. Presentational; the parent supplies the
 * data + tap handler.
 */
function CategoryTile({ name, count, onPress }: CategoryTileProps) {
  const { tokens } = useThemeContext();
  return (
    <AppPressableView
      onPress={() => onPress(name)}
      androidRipple={false}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${count} parts`}
      center
      rounded={18}
      colorName="card"
      borderWidth={1}
      borderName="border"
      style={{ width: '31.5%', paddingTop: 16, paddingBottom: 13, paddingHorizontal: 8, gap: 10 }}
    >
      <AppView center style={{ width: 68, height: 68 }}>
        <AutoPartIcon name={name} size={60} />
      </AppView>
      <AppView align="center">
        <AppText
          family="accent"
          weight="bold"
          style={{ fontSize: 12.5, color: tokens.text, textAlign: 'center', lineHeight: 15 }}
          numberOfLines={1}
        >
          {name}
        </AppText>
        <AppText family="default" style={{ fontSize: 10.5, color: tokens.textMuted, marginTop: 2 }}>
          {count} parts
        </AppText>
      </AppView>
    </AppPressableView>
  );
}

export default memo(CategoryTile);
