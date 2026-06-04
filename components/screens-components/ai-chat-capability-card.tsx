import type React from 'react';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

type IconComponent = React.ComponentType<{ size: number; strokeWidth: number; color: string }>;

type AiChatCapabilityCardProps = {
  title: string;
  description: string;
  Icon: IconComponent;
};

export default function AiChatCapabilityCard({
  title,
  description,
  Icon,
}: AiChatCapabilityCardProps) {
  const { tokens } = useThemeContext();

  return (
    <AppView
      rounded={24}
      px={14}
      py={14}
      gap={12}
      style={{
        width: '48.5%',
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.card,
      }}
    >
      <AppView
        center
        rounded={18}
        style={{
          width: 42,
          height: 42,
          backgroundColor: tokens.backgroundSecondary,
        }}
      >
        <Icon size={18} strokeWidth={2.1} color={tokens.icon} />
      </AppView>

      <AppView gap={4}>
        <AppText textVariant="bodySemibold" colorName="text">
          {title}
        </AppText>
        <AppText textVariant="bodyXs" colorName="gray400">
          {description}
        </AppText>
      </AppView>
    </AppView>
  );
}
