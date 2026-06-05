import { ArrowLeft, Check } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type AddVehicleHeaderProps = {
  title: string;
  canSubmit: boolean;
  onBack: () => void;
  onSubmit: () => void;
};

export function AddVehicleHeader({ title, canSubmit, onBack, onSubmit }: AddVehicleHeaderProps) {
  const { tokens } = useThemeContext();

  return (
    <AppView px={20}>
      <AppView row align="center">
        <AppView style={{ flex: 1, alignItems: 'flex-start' }}>
          <AppPressableView
            androidRipple={false}
            onPress={onBack}
            hitSlop={8}
            accessibilityLabel="Go back"
          >
            <AppView row align="center">
              <ArrowLeft size={20} strokeWidth={2.2} color={tokens.text} />
            </AppView>
          </AppPressableView>
        </AppView>

        <AppText
          textVariant="title"
          family="heading"
          weight="bold"
          align="center"
          numberOfLines={1}
        >
          {title}
        </AppText>

        <AppView style={{ flex: 1, alignItems: 'flex-end' }}>
          <AppPressableView
            rounded={36}
            androidRipple={false}
            onPress={onSubmit}
            disabled={!canSubmit}
            accessibilityLabel="Save"
            style={{
              width: 36,
              height: 36,
              backgroundColor: canSubmit ? tokens.brand : tokens.disabledBg,
            }}
          >
            <AppView center style={{ width: 36, height: 36 }}>
              <Check
                size={16}
                strokeWidth={2.4}
                color={canSubmit ? tokens.onBrand : tokens.disabledFg}
              />
            </AppView>
          </AppPressableView>
        </AppView>
      </AppView>
    </AppView>
  );
}

export default AddVehicleHeader;
