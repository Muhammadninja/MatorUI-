import { ChevronRight, X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { AppBottomSheet } from '@/components/shared/app-bottom-sheet';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

type Tokens = ReturnType<typeof useThemeContext>['tokens'];

// ── Review row ─────────────────────────────────────────────────────────
// One line of the compact checkout: what was chosen, and a tap to change it. A missing
// required choice reads as an action in the brand colour rather than a quiet blank.

export function ReviewRow({
  tokens,
  testID,
  label,
  value,
  detail,
  missing = false,
  error = false,
  divider = true,
  onPress,
}: {
  tokens: Tokens;
  testID: string;
  label: string;
  /** What is chosen: text, or a mark such as a provider logo. */
  value: ReactNode;
  /** A quieter second line under the value. */
  detail?: string | null;
  /** The choice is required and not made yet. */
  missing?: boolean;
  /** The detail is a problem to fix. */
  error?: boolean;
  divider?: boolean;
  onPress: () => void;
}) {
  return (
    <AppPressableView
      testID={testID}
      onPress={onPress}
      androidRipple={false}
      pressedOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={[label, typeof value === 'string' ? value : null, detail].filter(Boolean).join(', ')}
      style={{
        minHeight: 56,
        paddingVertical: 12,
        borderTopWidth: divider ? 1 : 0,
        borderTopColor: tokens.divider,
      }}
    >
      <AppView row align="center" gap={12}>
        <AppText family="default" style={{ fontSize: 14, lineHeight: 20, color: tokens.textMuted, width: 112, flexShrink: 0 }}>
          {label}
        </AppText>
        <AppView flex={1} style={{ minWidth: 0, alignItems: 'flex-end' }}>
          {typeof value === 'string' ? (
            <AppText
              family="default"
              weight="semibold"
              style={{ fontSize: 14.5, lineHeight: 20, textAlign: 'right', color: missing ? tokens.brandText : tokens.text }}
            >
              {value}
            </AppText>
          ) : (
            value
          )}
          {detail ? (
            <AppText
              family="default"
              style={{ fontSize: 12.5, lineHeight: 17, textAlign: 'right', marginTop: 2, color: error ? tokens.error : tokens.textMuted }}
            >
              {detail}
            </AppText>
          ) : null}
        </AppView>
        <ChevronRight size={18} strokeWidth={2} color={tokens.textMuted} />
      </AppView>
    </AppPressableView>
  );
}

// ── Sheet ──────────────────────────────────────────────────────────────
// The app's bottom sheet with a fixed title and close control, its own scrolling body, and
// an optional fixed foot. Closing leaves the checkout exactly where it was.

export function CheckoutSheet({
  testID,
  visible,
  onClose,
  title,
  children,
  footer,
  heightFraction = 0.75,
}: {
  testID: string;
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  heightFraction?: number;
}) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  return (
    <AppBottomSheet visible={visible} onClose={onClose} heightFraction={heightFraction} avoidKeyboard={false}>
      <AppView testID={testID} style={{ flexShrink: 1 }}>
        <AppView row align="center" justify="space-between" gap={12} style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
          <AppText family="heading" weight="bold" accessibilityRole="header" style={{ flex: 1, fontSize: 18, color: tokens.text }}>
            {title}
          </AppText>
          <AppPressableView
            testID={`${testID}-close`}
            onPress={onClose}
            center
            rounded={999}
            colorName="backgroundSecondary"
            androidRipple={false}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            style={{ width: 36, height: 36 }}
          >
            <X size={18} strokeWidth={2.2} color={tokens.text} />
          </AppPressableView>
        </AppView>
        <ScrollView
          style={{ flexShrink: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: footer ? 12 : 20, gap: 10 }}
          showsVerticalScrollIndicator
        >
          {children}
        </ScrollView>
        {footer ? (
          <AppView style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: tokens.divider }}>
            {footer}
          </AppView>
        ) : null}
      </AppView>
    </AppBottomSheet>
  );
}

// ── Order items ────────────────────────────────────────────────────────

export type OrderItemLine = { id: string; title: string; quantity: number; total: string };

/** Each line in full: the name wraps, the price keeps its own right-hand column. */
export function OrderItemRows({ tokens, lines }: { tokens: Tokens; lines: OrderItemLine[] }) {
  return (
    <>
      {lines.map((line, index) => (
        <AppView
          key={line.id}
          testID={`checkout-items-line-${line.id}`}
          row
          align="flex-start"
          gap={12}
          style={{ paddingTop: index === 0 ? 0 : 10, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: tokens.divider }}
        >
          <AppView flex={1} style={{ minWidth: 0 }}>
            <AppText family="default" weight="medium" style={{ fontSize: 14, lineHeight: 20, color: tokens.text }}>
              {line.title}
            </AppText>
            <AppText family="default" style={{ fontSize: 12.5, lineHeight: 17, color: tokens.textMuted, marginTop: 2 }}>
              × {line.quantity}
            </AppText>
          </AppView>
          <AppText
            family="accent"
            weight="semibold"
            style={{ fontSize: 14, lineHeight: 20, color: tokens.text, textAlign: 'right', fontVariant: ['tabular-nums'], flexShrink: 0, maxWidth: '45%' }}
          >
            {line.total}
          </AppText>
        </AppView>
      ))}
    </>
  );
}
