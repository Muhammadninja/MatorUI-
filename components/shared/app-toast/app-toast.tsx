import { CheckCircle2, Info, X, XCircle } from 'lucide-react-native';
import { memo, useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { Toast, ToastKind } from '@/services/toast-service';

export type AppToastProps = {
  toast: Toast;
  onDismiss: (id: string) => void;
};

// Test palette per spec: green / red / yellow
const PALETTE: Record<ToastKind, { tint: string; tintFg: string; Icon: typeof CheckCircle2 }> = {
  success: { tint: '#16a34a', tintFg: '#ffffff', Icon: CheckCircle2 },
  danger: { tint: '#dc2626', tintFg: '#ffffff', Icon: XCircle },
  info: { tint: '#eab308', tintFg: '#1a1a1a', Icon: Info },
};

function AppToastImpl({ toast, onDismiss }: AppToastProps) {
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';

  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-16)).current;

  // Enter + auto-dismiss in one effect. Native-driver throughout.
  useEffect(() => {
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

    if (toast.duration <= 0) return;
    const timer = setTimeout(() => handleDismiss(), toast.duration);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id, toast.duration]);

  const handleDismiss = () => {
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

  const palette = PALETTE[toast.kind];
  const animatedStyle = useMemo(
    () => ({ opacity, transform: [{ translateY }] }),
    [opacity, translateY],
  );

  return (
    <Animated.View style={[styles.shell, animatedStyle]} pointerEvents="box-none">
      <Pressable
        onPress={handleDismiss}
        accessibilityRole="alert"
        accessibilityLabel={`${toast.kind}: ${toast.title}`}
        style={({ pressed }) => [
          styles.card,
          {
            backgroundColor: isDark ? tokens.card : tokens.white,
            borderColor: isDark ? `${tokens.border}80` : tokens.border,
            transform: [{ scale: pressed ? 0.985 : 1 }],
            ...Platform.select({
              ios: {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: isDark ? 0.45 : 0.14,
                shadowRadius: 20,
              },
              android: { elevation: 12 },
            }),
          },
        ]}
      >
        {/* Color rail */}
        <View style={[styles.rail, { backgroundColor: palette.tint }]} />

        <AppView row align="center" gap={12} px={14} py={12} style={{ flex: 1 }}>
          <View
            style={[
              styles.iconBubble,
              { backgroundColor: palette.tint },
            ]}
          >
            <palette.Icon size={16} strokeWidth={2.4} color={palette.tintFg} />
          </View>

          <AppView gap={2} style={{ flex: 1 }}>
            <AppText
              textVariant="bodySm"
              family="heading"
              weight="semibold"
              colorName="text"
              numberOfLines={1}
            >
              {toast.title}
            </AppText>
            {toast.description ? (
              <AppText textVariant="bodyXs" colorName="gray400" numberOfLines={2}>
                {toast.description}
              </AppText>
            ) : null}
          </AppView>

          {toast.actionLabel ? (
            <Pressable
              onPress={handleAction}
              hitSlop={8}
              style={({ pressed }) => [
                styles.actionPill,
                {
                  borderColor: palette.tint,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <AppText
                textVariant="bodyXs"
                weight="semibold"
                style={{ color: palette.tint }}
              >
                {toast.actionLabel}
              </AppText>
            </Pressable>
          ) : null}

          {/* Explicit dismiss control. The whole card is also tappable to
           *  dismiss (outer Pressable), but the X gives users a clear
           *  affordance — important when toasts stack and tapping the
           *  card body might feel ambiguous. */}
          <Pressable
            onPress={handleDismiss}
            hitSlop={8}
            accessibilityLabel="Dismiss"
            style={({ pressed }) => [
              styles.dismissButton,
              { opacity: pressed ? 0.5 : 1 },
            ]}
          >
            <X size={16} strokeWidth={2.4} color={tokens.gray400} />
          </Pressable>
        </AppView>
      </Pressable>
    </Animated.View>
  );
}

export const AppToast = memo(AppToastImpl);

const styles = StyleSheet.create({
  shell: {
    width: '100%',
  },
  card: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  rail: {
    width: 4,
  },
  iconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  dismissButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
