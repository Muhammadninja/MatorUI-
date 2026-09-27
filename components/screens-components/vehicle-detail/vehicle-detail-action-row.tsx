import { ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';

import { RADIUS_MEDIA, RADIUS_SHEET } from '@/components/screens-components/search/radii';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type VehicleDetailActionRowProps = {
  icon: ReactNode;
  label: string;
  hint?: string;
  onPress?: () => void;
  destructive?: boolean;
  muted?: boolean;
};

export function VehicleDetailActionRow({
  icon,
  label,
  hint,
  onPress,
  destructive,
  muted,
}: VehicleDetailActionRowProps) {
  const { tokens } = useThemeContext();

  return (
    <AppPressableView
      rounded={RADIUS_SHEET}
      colorName="card"
      borderName="border"
      borderWidth={1}
      androidRipple
      onPress={onPress}
      disabled={muted}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!muted }}
    >
      <AppView row align="center" gap={14} px="lg" py={14}>
        <AppView
          center
          rounded={RADIUS_MEDIA}
          colorName="backgroundSecondary"
          style={{ width: 36, height: 36, flexShrink: 0, opacity: muted ? 0.5 : 1 }}
        >
          {icon}
        </AppView>
        <AppView flex={1} gap={2} style={{ opacity: muted ? 0.5 : 1 }}>
          <AppText
            textVariant="bodySemibold"
            style={{ color: destructive ? tokens.error : tokens.text }}
          >
            {label}
          </AppText>
          {hint ? (
            <AppText textVariant="bodyXs" colorName="gray400">
              {hint}
            </AppText>
          ) : null}
        </AppView>
        {!muted ? (
          <AppView style={{ flexShrink: 0 }}>
            <ChevronRight size={18} strokeWidth={2} color={tokens.gray400} />
          </AppView>
        ) : null}
      </AppView>
    </AppPressableView>
  );
}

export default VehicleDetailActionRow;
