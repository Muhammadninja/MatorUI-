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
  const accentBg = scheme === 'dark' ? `${tokens.brand}1F` : `${tokens.brand}14`;
  const iconBg = scheme === 'dark' ? `${tokens.brand}2E` : `${tokens.brand}22`;
  const accentText = scheme === 'dark' ? tokens.text : tokens.brand;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          flexWrap: 'nowrap',
          minHeight: 40,
          paddingHorizontal: 6,
          paddingVertical: 6,
          borderRadius: 36,
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
          borderRadius: 36,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: iconBg,
        }}
      >
        <Icon size={14} strokeWidth={2.1} color={accentText} />
      </View>
      <AppText
        numberOfLines={1}
        textVariant="bodySm"
        weight="semibold"
        style={{ color: accentText, flexShrink: 0, marginLeft: 10, marginRight: 12 }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
