import { SendHorizontal, Square } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TextInput, useWindowDimensions } from 'react-native';

import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

const LINE_HEIGHT = 22;
const MAX_VISIBLE_LINES = 4;
/** With the line height, makes one line as tall as the 48-unit send button. */
const INPUT_PADDING_Y = 13;
const NO_SLOP = { top: 0, bottom: 0, left: 0, right: 0 };

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
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const [focused, setFocused] = useState(false);
  const canSend = value.trim().length > 0 && !isSending;
  const handleRightPress = isSending
    ? onStop
    : canSend
      ? onSend
      : onEmptyTap ?? undefined;

  return (
    <AppView px={12} py={6}>
      <AppView
        row
        align="flex-end"
        rounded={16}
        borderWidth={1}
        borderColor={focused ? `${tokens.brand}80` : tokens.border}
        style={{ backgroundColor: tokens.card, paddingLeft: 14 }}
      >
        {/* A sibling of the button rather than under it, so text can't reach it. */}
        <TextInput
          testID="chat-composer-input"
          placeholder={t('aiChat.composerPlaceholder')}
          placeholderTextColor={tokens.textMuted}
          accessibilityLabel={t('aiChat.composerA11yLabel')}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoCapitalize="sentences"
          autoCorrect={false}
          multiline
          cursorColor={tokens.brand}
          selectionColor={tokens.brand}
          textAlignVertical="top"
          style={{
            flex: 1,
            color: tokens.text,
            fontFamily: 'Inter_400Regular',
            fontSize: 16,
            lineHeight: LINE_HEIGHT,
            paddingTop: INPUT_PADDING_Y,
            paddingBottom: INPUT_PADDING_Y,
            paddingHorizontal: 0,
            // Scaled, so large text still shows four lines before scrolling.
            maxHeight: LINE_HEIGHT * MAX_VISIBLE_LINES * fontScale + INPUT_PADDING_Y * 2,
          }}
        />

        <AppPressableView
          testID="chat-composer-send"
          center
          androidRipple={false}
          pressedOpacity={0.7}
          onPress={handleRightPress}
          accessibilityRole="button"
          accessibilityLabel={isSending ? t('aiChat.stopGenerating') : t('aiChat.sendMessage')}
          hitSlop={NO_SLOP}
          style={{ width: 48, height: 48 }}
        >
          <AppView
            center
            rounded={999}
            style={{
              width: 36,
              height: 36,
              backgroundColor: isSending
                ? tokens.error
                : canSend
                  ? tokens.brand
                  : tokens.disabledBg,
            }}
          >
            {isSending ? (
              <Square size={14} strokeWidth={2.4} color={tokens.onBrand} fill={tokens.onBrand} />
            ) : (
              <SendHorizontal
                size={18}
                strokeWidth={2.2}
                color={canSend ? tokens.onBrand : tokens.disabledFg}
              />
            )}
          </AppView>
        </AppPressableView>
      </AppView>
    </AppView>
  );
}
