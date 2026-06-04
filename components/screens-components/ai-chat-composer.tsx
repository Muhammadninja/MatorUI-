import { Plus, SendHorizontal } from 'lucide-react-native';

import AppTextField from '@/components/shared/app-text-field';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

type AiChatComposerProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  onLeftActionPress?: () => void;
  disabled?: boolean;
};

export default function AiChatComposer({
  value,
  onChangeText,
  onSend,
  onLeftActionPress,
  disabled = false,
}: AiChatComposerProps) {
  const { tokens } = useThemeContext();
  const canSend = value.trim().length > 0 && !disabled;

  return (
    <AppView
      px={6}
      py={6}
      row
      align="center"
      gap={8}
      style={{
        borderColor: tokens.border,
        borderTopLeftRadius: 1,
        borderTopRightRadius: 36,
      }}
    >
      <AppPressableView
        center
        rounded={36}
        androidRipple={false}
        pressedOpacity={0.7}
        onPress={disabled ? undefined : onLeftActionPress}
        style={{
          width: 38,
          height: 38,
          backgroundColor: tokens.backgroundSecondary,
        }}
      >
        <Plus size={18} strokeWidth={2.2} color={tokens.icon} />
      </AppPressableView>

      <AppView flex={1}>
        <AppTextField
          placeholder="Ask a parts question"
          value={value}
          onChangeText={onChangeText}
          disabled={disabled}
          autoCapitalize="sentences"
          autoCorrect={false}
        />
      </AppView>

      <AppPressableView
        center
        rounded={36}
        androidRipple={false}
        pressedOpacity={0.7}
        onPress={canSend ? onSend : undefined}
        style={{
          width: 38,
          height: 38,
          backgroundColor: canSend ? tokens.brand : tokens.backgroundSecondary,
        }}
      >
        <SendHorizontal
          size={18}
          strokeWidth={2.2}
          color={canSend ? tokens.onBrand : tokens.icon}
        />
      </AppPressableView>
    </AppView>
  );
}
