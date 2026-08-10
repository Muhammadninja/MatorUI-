import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import AiChatToolCallCard from '@/components/screens-components/ai-chat/ai-chat-tool-call-card';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import type { AiChatToolCall } from '@/types/ai-chat';

type AiChatMessageBubbleProps = {
  role: 'assistant' | 'user';
  body: string;
  caption?: string;
  title?: string;
  /** Fires when the avatar is tapped. For assistant bubbles the parent
   *  typically opens an "About the assistant" affordance; for user
   *  bubbles, a route to edit-profile. */
  onAvatarPress?: () => void;
  /** Tool invocations the agent made while producing this message.
   *  Rendered as a stack of cards above the text body. */
  toolCalls?: AiChatToolCall[];
};

function AiChatMessageBubble({
  role,
  body,
  caption,
  title,
  onAvatarPress,
  toolCalls,
}: AiChatMessageBubbleProps) {
  const { tokens } = useThemeContext();
  const { t } = useTranslation();
  const { profile } = useUserContext();
  const isUser = role === 'user';

  // Real initials when available; falls back to a neutral glyph instead of
  // the literal placeholder "You".
  const userInitials = profile
    ? `${profile.firstName[0] ?? ''}${profile.lastName[0] ?? ''}`.toUpperCase().trim() || 'M'
    : 'M';

  // Unified asymmetric corner system: 16px on the three "round" corners,
  // 4px on the speech-bubble corner closest to the avatar.
  const bubbleRadii = isUser
    ? {
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 4,
      }
    : {
        borderTopLeftRadius: 4,
        borderTopRightRadius: 16,
        borderBottomLeftRadius: 16,
        borderBottomRightRadius: 16,
      };

  const hasToolCalls = !isUser && toolCalls && toolCalls.length > 0;
  const hasBody = body.trim().length > 0;

  return (
    <AppView
      row
      align="flex-end"
      justify={isUser ? 'flex-end' : 'flex-start'}
      gap="sm"
      style={{ width: '100%' }}
    >
      {!isUser ? (
        <AppPressableView
          center
          rounded={999}
          onPress={onAvatarPress}
          accessibilityRole={onAvatarPress ? 'button' : undefined}
          accessibilityLabel={onAvatarPress ? t('aiChat.aboutAssistant') : undefined}
          style={{
            width: 32,
            height: 32,
            backgroundColor: tokens.backgroundSecondary,
            marginBottom: 2,
          }}
        >
          <AppText textVariant="caption" family="accent" weight="semibold" colorName="text">
            MA
          </AppText>
        </AppPressableView>
      ) : null}

      <AppView gap="sm" style={{ maxWidth: isUser ? '72%' : '82%' }}>
        {hasToolCalls ? (
          <AppView gap={6} style={{ alignSelf: 'flex-start' }}>
            {toolCalls!.map((tc) => (
              <AiChatToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </AppView>
        ) : null}

        {hasBody ? (
          <AppView
            px={isUser ? 12 : 14}
            py={isUser ? 9 : 12}
            style={{
              borderWidth: isUser ? 0 : 1,
              borderColor: tokens.border,
              backgroundColor: isUser ? tokens.brand : tokens.card,
              ...bubbleRadii,
            }}
          >
            {title ? (
              <AppText
                textVariant="caption"
                family="accent"
                weight="semibold"
                style={{ color: isUser ? `${tokens.onBrand}CC` : tokens.gray400 }}
              >
                {title}
              </AppText>
            ) : null}

            <AppText
              textVariant="bodySm"
              weight={isUser ? 'semibold' : undefined}
              selectable={!isUser}
              style={{
                color: isUser ? tokens.onBrand : tokens.text,
                lineHeight: isUser ? 20 : 22,
              }}
            >
              {body}
            </AppText>

            {caption ? (
              <AppView row justify="flex-end">
                <AppText
                  textVariant="caption"
                  style={{ color: isUser ? `${tokens.onBrand}B3` : tokens.gray400 }}
                >
                  {caption}
                </AppText>
              </AppView>
            ) : null}
          </AppView>
        ) : null}
      </AppView>

      {isUser ? (
        <AppPressableView
          center
          rounded={999}
          onPress={onAvatarPress}
          accessibilityRole={onAvatarPress ? 'button' : undefined}
          accessibilityLabel={onAvatarPress ? t('aiChat.editProfile') : undefined}
          style={{
            width: 32,
            height: 32,
            backgroundColor: tokens.brand,
            marginBottom: 2,
          }}
        >
          <AppText
            textVariant="caption"
            family="accent"
            weight="semibold"
            style={{ color: tokens.onBrand }}
          >
            {userInitials}
          </AppText>
        </AppPressableView>
      ) : null}
    </AppView>
  );
}

export default memo(AiChatMessageBubble);
