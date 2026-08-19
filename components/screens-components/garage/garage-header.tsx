import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';

import { RADIUS_PILL } from '@/components/screens-components/search/radii';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type GarageHeaderProps = {
  title?: string;
  onAddPress: () => void;
};

export function GarageHeader({
  title,
  onAddPress,
}: GarageHeaderProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const resolvedTitle = title ?? t('garage.title');

  return (
    <AppView row align="center" justify="space-between" px={20} py="lg" gap="md">
      <AppText
        family="heading"
        weight="bold"
        colorName="text"
        numberOfLines={1}
        accessibilityRole="header"
        style={{ fontSize: 26, lineHeight: 32 }}
      >
        {resolvedTitle}
      </AppText>

      {/* Icon-only round button — language-proof (the RU label "Добавить" made a
       *  text pill wide and heavy next to the title). The medallion reads as an
       *  "add" affordance in every locale; the label lives on the a11y layer. */}
      <AppPressableView
        center
        rounded={RADIUS_PILL}
        colorName="brand"
        androidRipple
        onPress={onAddPress}
        accessibilityRole="button"
        accessibilityLabel={t('garage.addVehicle')}
        accessibilityHint={t('garage.addVehicleHint')}
        style={{ width: 44, height: 44 }}
      >
        <Plus size={22} strokeWidth={2.5} color={tokens.onBrand} />
      </AppPressableView>
    </AppView>
  );
}

export default GarageHeader;
