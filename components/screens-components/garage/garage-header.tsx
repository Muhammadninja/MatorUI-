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
  title = 'My Garage',
  onAddPress,
}: GarageHeaderProps) {
  const { tokens } = useThemeContext();

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
        {title}
      </AppText>

      <AppPressableView
        rounded={RADIUS_PILL}
        px={14}
        py={10}
        colorName="brand"
        androidRipple
        onPress={onAddPress}
        accessibilityRole="button"
        accessibilityLabel="Add vehicle"
        accessibilityHint="Opens a sheet to add a new vehicle to your garage"
      >
        <AppView row align="center" gap={6}>
          <Plus size={16} strokeWidth={2} color={tokens.onBrand} />
          <AppText
            textVariant="buttonSm"
            family="accent"
            colorName="onBrand"
            numberOfLines={1}
          >
            Add
          </AppText>
        </AppView>
      </AppPressableView>
    </AppView>
  );
}

export default GarageHeader;
