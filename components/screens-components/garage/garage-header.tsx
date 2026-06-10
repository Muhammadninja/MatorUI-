import { Plus } from 'lucide-react-native';

import { RADIUS_PILL } from '@/components/screens-components/search/radii';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type GarageHeaderProps = {
  eyebrow?: string;
  title?: string;
  onAddPress: () => void;
};

export function GarageHeader({
  eyebrow = 'Garage',
  title = 'My vehicles',
  onAddPress,
}: GarageHeaderProps) {
  const { tokens } = useThemeContext();

  return (
    <AppView row align="center" justify="space-between" px={20} py={16} gap={12}>
      <AppView gap={2} flex={1}>
        <AppText
          textVariant="caption"
          family="accent"
          colorName="gray400"
          transform="uppercase"
          numberOfLines={1}
        >
          {eyebrow}
        </AppText>
        <AppText
          textVariant="title"
          family="heading"
          weight="bold"
          colorName="text"
          numberOfLines={1}
          accessibilityRole="header"
        >
          {title}
        </AppText>
      </AppView>

      <AppPressableView
        rounded={RADIUS_PILL}
        px={14}
        py={10}
        colorName="secondary"
        androidRipple
        onPress={onAddPress}
        accessibilityRole="button"
        accessibilityLabel="Add vehicle"
        accessibilityHint="Opens a sheet to add a new vehicle to your garage"
      >
        <AppView row align="center" gap={6}>
          <Plus size={16} strokeWidth={2} color={tokens.onSecondary} />
          <AppText
            textVariant="buttonSm"
            family="accent"
            colorName="onSecondary"
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
