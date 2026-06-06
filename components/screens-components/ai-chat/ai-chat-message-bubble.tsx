import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

type AiChatMessageBubbleProps = {
  role: 'assistant' | 'user';
  body: string;
  caption?: string;
  title?: string;
};

export default function AiChatMessageBubble({
  role,
  body,
  caption,
  title,
}: AiChatMessageBubbleProps) {
  const { tokens } = useThemeContext();
  const isUser = role === 'user';

  return (
    <AppView
      row
      align="flex-end"
      justify={isUser ? 'flex-end' : 'flex-start'}
      gap={8}
      style={{
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        width: '100%',
      }}
    >
      {!isUser ? (
        <AppView
          center
          rounded={36}
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
        </AppView>
      ) : null}

      <AppView
        rounded={22}
        px={isUser ? 12 : 14}
        py={isUser ? 9 : 12}
        style={{
          maxWidth: isUser ? '72%' : '82%',
          borderTopLeftRadius: isUser ? 22 : 10,
          borderTopRightRadius: isUser ? 4 : 12,
          borderBottomLeftRadius: isUser ? 4 : 12,
          borderBottomRightRadius: isUser ? 22 : 12,
          borderWidth: isUser ? 0 : 1,
          borderColor: tokens.border,
          backgroundColor: isUser ? tokens.brand : tokens.card,
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
          style={{ color: isUser ? tokens.onBrand : tokens.text, lineHeight: isUser ? 20 : 22 }}
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

      {isUser ? (
        <AppView
          center
          rounded={36}
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
            You
          </AppText>
        </AppView>
      ) : null}
    </AppView>
  );
}
