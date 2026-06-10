import type React from 'react';
import { Pressable, View } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { useThemeContext } from '@/contexts/theme.context';

type IconComponent = React.ComponentType<{ size: number; strokeWidth: number; color: string }>;

type AiChatSuggestionChipProps = {
  label: string;
  Icon: IconComponent;
  onPress?: () => void;
};

export default function AiChatSuggestionChip({ label, Icon, onPress }: AiChatSuggestionChipProps) {
  const { tokens, scheme } = useThemeContext();
  // Brand-tinted soft background. Kept as alpha-hex but isolated to one
  // place so future tokens (brandSoft / brandTintIcon) can swap in cleanly.
  const accentBg = scheme === 'dark' ? `${tokens.brand}1F` : `${tokens.brand}14`;
  const iconBg = scheme === 'dark' ? `${tokens.brand}2E` : `${tokens.brand}22`;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          minHeight: 40,
          paddingHorizontal: 6,
          paddingVertical: 6,
          borderRadius: 999,
          backgroundColor: accentBg,
          borderWidth: 1,
          borderColor: tokens.border,
        },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <View
        style={{
          width: 30,
          height: 30,
          borderRadius: 999,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: iconBg,
        }}
      >
        <Icon size={14} strokeWidth={2.1} color={tokens.brand} />
      </View>
      <AppText
        numberOfLines={1}
        textVariant="bodySm"
        weight="semibold"
        style={{ color: tokens.brand, marginLeft: 10, marginRight: 12 }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
