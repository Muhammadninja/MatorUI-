import { ChevronRight } from 'lucide-react-native';
import { memo } from 'react';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { CatalogSystem } from '@/constants/catalog-systems';

export type MasterSystemRowProps = {
  system: CatalogSystem;
  onPress: (system: CatalogSystem) => void;
};

/**
 * `MasterSystemRow` — a plain catalog-system list row: bold EN title + RU
 * subtitle on the page background, separated by dividers (no card, no icon).
 * Presentational.
 */
function MasterSystemRow({ system, onPress }: MasterSystemRowProps) {
  const { tokens } = useThemeContext();
  return (
    <AppPressableView
      testID={`system-item-${system.id}`}
      onPress={() => onPress(system)}
      androidRipple={false}
      accessibilityRole="button"
      accessibilityLabel={system.label}
      row
      align="center"
      gap={12}
      py={18}
    >
      <AppView flex={1}>
        <AppText family="heading" weight="bold" style={{ fontSize: 19, color: tokens.text }}>
          {system.label}
        </AppText>
        <AppText family="default" style={{ fontSize: 13.5, color: tokens.textMuted, marginTop: 2 }}>
          {system.labelRu}
        </AppText>
      </AppView>
      <ChevronRight size={22} strokeWidth={2.2} color={tokens.textMuted} />
    </AppPressableView>
  );
}

export default memo(MasterSystemRow);
