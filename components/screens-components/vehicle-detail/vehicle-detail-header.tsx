import { ArrowLeft, Star } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type VehicleDetailHeaderProps = {
  onBack: () => void;
  isPrimary: boolean;
};

export function VehicleDetailHeader({ onBack, isPrimary }: VehicleDetailHeaderProps) {
  const { tokens } = useThemeContext();

  return (
    <AppView px={20} row align="center" justify="space-between">
      <AppPressableView
        androidRipple={false}
        onPress={onBack}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityLabel="Go back"
      >
        <AppView row align="center">
          <ArrowLeft size={20} strokeWidth={2.2} color={tokens.text} />
        </AppView>
      </AppPressableView>

      {isPrimary ? (
        <AppView rounded={999} colorName="secondary">
          <AppView row align="center" gap={6} px={10} py={6}>
            <AppView style={{ flexShrink: 0 }}>
              <Star size={12} strokeWidth={2.4} color={tokens.onSecondary} />
            </AppView>
            <AppText
              textVariant="caption"
              family="accent"
              colorName="onSecondary"
              numberOfLines={1}
            >
              PRIMARY
            </AppText>
          </AppView>
        </AppView>
      ) : (
        <AppView style={{ width: 36 }} />
      )}
    </AppView>
  );
}

export default VehicleDetailHeader;
