import { SendHorizontal, Square } from 'lucide-react-native';

import AppTextField from '@/components/shared/app-text-field';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

type AiChatComposerProps = {
  value: string;
  onChangeText: (value: string) => void;
  onSend: () => void;
  /** Fired when the send button is tapped while empty (and not sending).
   *  Lets the screen play a haptic so the press doesn't feel ignored. */
  onEmptyTap?: () => void;
  /** True while a streaming response is in flight; flips the send button
   *  into a Stop button and routes its press to `onStop`. */
  isSending?: boolean;
  onStop?: () => void;
};

export default function AiChatComposer({
  value,
  onChangeText,
  onSend,
  onEmptyTap,
  isSending = false,
  onStop,
}: AiChatComposerProps) {
  const { tokens } = useThemeContext();
  const canSend = value.trim().length > 0 && !isSending;
  const handleRightPress = isSending
    ? onStop
    : canSend
      ? onSend
      : onEmptyTap ?? undefined;

  return (
    <AppView px={10} py={6} row align="center" gap={8}>
      <AppView flex={1} >
        <AppTextField
          placeholder="Ask a parts question…"
          value={value}
          onChangeText={onChangeText}
          autoCapitalize="sentences"
          autoCorrect={false}
          multiline
          /* Override the primitive's 100dp multiline minHeight: the
           *  composer should look like a single-line input until the
           *  user types past one line, then grow up to ~4 lines. */
          style={{ minHeight: 0, maxHeight: 96 }}
          /* Match field fill to the composer strip (now solid
           *  `tokens.background` since the BlurView underlay was removed).
           *  No border — field reads as one clean surface. */
          containerColorName="background"
          containerStyle={{ borderWidth: 0 }}
        />
      </AppView>

      <AppPressableView
        center
        rounded={36}
        androidRipple={false}
        pressedOpacity={0.7}
        onPress={handleRightPress}
        accessibilityRole="button"
        accessibilityLabel={isSending ? 'Stop generating' : 'Send message'}
        style={{
          width: 38,
          height: 38,
          backgroundColor: isSending ? tokens.error : canSend ? tokens.brand : tokens.backgroundSecondary,
        }}
      >
        {isSending ? (
          <Square
            size={14}
            strokeWidth={2.4}
            color={tokens.onBrand}
            fill={tokens.onBrand}
          />
        ) : (
          <SendHorizontal
            size={18}
            strokeWidth={2.2}
            color={canSend ? tokens.onBrand : tokens.icon}
          />
        )}
      </AppPressableView>
    </AppView>
  );
}
