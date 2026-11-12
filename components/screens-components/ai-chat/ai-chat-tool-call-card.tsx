import { router } from 'expo-router';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Wrench } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { AiChatToolCall } from '@/types/ai-chat';
import { triggerHaptic } from '@/utils/haptics';

type AiChatToolCallCardProps = {
  toolCall: AiChatToolCall;
};

/**
 * Inline tool-invocation card. Rendered above the assistant's text body
 * when the agent decided to call into a backend tool (lookup_order,
 * search_parts, etc.). Tracks four lifecycle states:
 *   pending  → spinner + label
 *   running  → spinner + label (server confirmed work in progress)
 *   success  → check icon + summary + optional deep-link chip
 *   error    → warning icon + error message
 */
export default function AiChatToolCallCard({ toolCall }: AiChatToolCallCardProps) {
  const { tokens } = useThemeContext();
  const { t } = useTranslation();

  const inFlight = toolCall.status === 'pending' || toolCall.status === 'running';
  const success = toolCall.status === 'success';
  const failed = toolCall.status === 'error';

  const accent = success
    ? tokens.success
    : failed
      ? tokens.error
      : tokens.gray400;

  const handleDeepLink = () => {
    const href = toolCall.result?.deepLink?.href;
    if (!href) return;
    triggerHaptic('selection');
    // Tag the navigation with `from=ai-chat` so cross-tab destinations
    // (item-detail, track-order, etc.) can pop back to the chat tab
    // rather than stranding the user on the destination tab's root.
    const withOrigin = appendOriginParam(href, 'ai-chat');
    router.push(withOrigin as never);
  };

  return (
    <AppView
      rounded={12}
      px="md"
      py={10}
      gap={6}
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.card,
        maxWidth: '82%',
      }}
    >
      <AppView row align="center" gap="sm">
        <AppView
          center
          rounded={999}
          style={{
            width: 22,
            height: 22,
            backgroundColor: `${accent}1F`,
          }}
        >
          {inFlight ? (
            <ActivityIndicator size="small" color={accent} />
          ) : success ? (
            <CheckCircle2 size={12} strokeWidth={2.4} color={accent} />
          ) : failed ? (
            <AlertTriangle size={12} strokeWidth={2.4} color={accent} />
          ) : (
            <Wrench size={12} strokeWidth={2.4} color={accent} />
          )}
        </AppView>
        <AppView gap={1} style={{ flex: 1 }}>
          <AppText textVariant="caption" colorName="gray400" weight="semibold">
            {labelForTool(toolCall.name, t)}
          </AppText>
          <AppText
            textVariant="bodyXs"
            weight="semibold"
            style={{ color: tokens.text }}
          >
            {toolCall.label}
          </AppText>
        </AppView>
      </AppView>

      {success && toolCall.result?.summary ? (
        <AppText
          textVariant="bodyXs"
          colorName="gray400"
          style={{ lineHeight: 16, paddingLeft: 30 }}
        >
          {toolCall.result.summary}
        </AppText>
      ) : null}

      {failed && toolCall.errorMessage ? (
        <AppText
          textVariant="bodyXs"
          style={{ lineHeight: 16, paddingLeft: 30, color: tokens.error }}
        >
          {toolCall.errorMessage}
        </AppText>
      ) : null}

      {success && toolCall.result?.deepLink ? (
        <View style={{ paddingLeft: 30, paddingTop: 2 }}>
          <Pressable
            onPress={handleDeepLink}
            accessibilityRole="button"
            accessibilityLabel={toolCall.result.deepLink.label}
            style={({ pressed }) => ({
              alignSelf: 'flex-start',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.backgroundSecondary,
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <AppText
              textVariant="caption"
              weight="semibold"
              style={{ color: tokens.brandText, lineHeight: 14, includeFontPadding: false }}
            >
              {toolCall.result.deepLink.label}
            </AppText>
            <ArrowUpRight size={12} strokeWidth={2.4} color={tokens.brand} />
          </Pressable>
        </View>
      ) : null}
    </AppView>
  );
}

function appendOriginParam(href: string, origin: string): string {
  const sep = href.includes('?') ? '&' : '?';
  return `${href}${sep}from=${origin}`;
}

function labelForTool(
  name: AiChatToolCall['name'],
  t: (key: string) => string,
): string {
  switch (name) {
    case 'lookup_order':
      return t('aiChat.toolLookupOrder');
    case 'search_parts':
      return t('aiChat.toolSearchParts');
    case 'add_to_cart':
      return t('aiChat.toolAddToCart');
    case 'apply_promo':
      return t('aiChat.toolApplyPromo');
    case 'check_fitment':
      return t('aiChat.toolCheckFitment');
    case 'identify_part':
      return t('aiChat.toolIdentifyPart');
    default:
      return t('aiChat.toolGeneric');
  }
}
