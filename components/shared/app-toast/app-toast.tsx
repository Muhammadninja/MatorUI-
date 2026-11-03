import { Check, Info, TriangleAlert, X, XCircle } from 'lucide-react-native';
import { memo, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { useThemeContext } from '@/contexts/theme.context';
import type { Toast, ToastKind } from '@/services/toast-service';
import type { ThemeTokens } from '@/themes/types';

export type AppToastProps = {
  toast: Toast;
  onDismiss: (id: string) => void;
  reduceMotion?: boolean;
};

const KIND_STYLE: Record<ToastKind, { color: keyof ThemeTokens; Icon: typeof Check }> = {
  success: { color: 'success', Icon: Check },
  danger: { color: 'error', Icon: XCircle },
  warning: { color: 'warning', Icon: TriangleAlert },
  info: { color: 'info', Icon: Info },
};

function AppToastImpl({ toast, onDismiss, reduceMotion = false }: AppToastProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  // Runs for each new toast. Starting an animation stops any exit in flight,
  // whose callback then sees `finished: false` and leaves the new toast alone.
  useEffect(() => {
    if (reduceMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
    } else {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }

    // Spoken without moving the screen reader's focus off what the user is on.
    AccessibilityInfo.announceForAccessibility(
      toast.description ? `${toast.title}. ${toast.description}` : toast.title,
    );

    if (toast.duration <= 0) return;
    const timer = setTimeout(() => handleDismiss(), toast.duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const handleDismiss = () => {
    if (reduceMotion) {
      onDismiss(toast.id);
      return;
    }
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: -12,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onDismiss(toast.id);
    });
  };

  const handleAction = () => {
    toast.onAction?.();
    handleDismiss();
  };

  const { color, Icon } = KIND_STYLE[toast.kind];
  const animatedStyle = useMemo(
    () => ({ opacity, transform: [{ translateY }] }),
    [opacity, translateY],
  );

  return (
    <Animated.View style={animatedStyle} pointerEvents="box-none">
      {/* Not `accessible`: that would merge the card into one element and hide
       *  the close and action buttons from screen readers. */}
      <Pressable
        testID="app-toast"
        onPress={handleDismiss}
        accessible={false}
        style={[styles.card, { backgroundColor: tokens.card, borderColor: tokens.border }]}
      >
        <View style={styles.icon}>
          <Icon size={18} strokeWidth={2.4} color={tokens[color]} />
        </View>

        <View style={styles.content}>
          <AppText weight="medium" colorName="text" style={styles.text}>
            {toast.title}
          </AppText>
          {toast.description ? (
            <AppText colorName="textMuted" style={styles.text}>
              {toast.description}
            </AppText>
          ) : null}
          {toast.actionLabel ? (
            <Pressable
              onPress={handleAction}
              accessibilityRole="button"
              style={({ pressed }) => [styles.action, { opacity: pressed ? 0.7 : 1 }]}
            >
              <AppText weight="medium" style={[styles.text, { color: tokens.brandText }]}>
                {toast.actionLabel}
              </AppText>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel={t('common.dismiss')}
          style={({ pressed }) => [styles.close, { opacity: pressed ? 0.5 : 1 }]}
        >
          <X size={16} strokeWidth={2.4} color={tokens.textMuted} />
        </Pressable>
      </Pressable>
    </Animated.View>
  );
}

export const AppToast = memo(AppToastImpl);

const CONTENT_PADDING_Y = 14;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingLeft: 14,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  // Centres the 18-unit icon on the first 20-unit line of text.
  icon: {
    marginTop: CONTENT_PADDING_Y + 1,
    marginRight: 10,
  },
  content: {
    flex: 1,
    paddingVertical: CONTENT_PADDING_Y,
    gap: 2,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
  },
  action: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 48,
    marginBottom: -CONTENT_PADDING_Y,
  },
  close: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
