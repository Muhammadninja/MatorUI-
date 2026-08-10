import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { AppLogo } from '@/components/shared/app-logo';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useLanguageContext } from '@/contexts/language.context';
import { useThemeContext } from '@/contexts/theme.context';

const MIN_VISIBLE_MS = 2400;
const FADE_MS = 320;

/**
 * Branded splash rendered as a full-screen **overlay** on top of the whole
 * navigation tree (not a route). This is the seamless single-splash pattern:
 *
 *  1. The iOS/Android native launch screen is pixel-matched to this overlay's
 *     first frame (see `expo-splash-screen` config in app.json). We hold it up
 *     via `preventAutoHideAsync` and only call `hideAsync` from THIS overlay's
 *     `onLayout` — i.e. once an identical JS frame has painted — so the handoff
 *     from native → JS has no gap, flash, or double-mount.
 *  2. Underneath, `app/index.tsx` has already redirected to the real first
 *     screen (Explore, or the language picker on first launch), so when we
 *     cross-fade this overlay out the destination is live behind it.
 *
 * Shows the MATOR wordmark with the wheel-O spinning, a `— MATOR.UZ —` lockup,
 * tread bands, and a wheel spinner. Auto-dismisses after ~2.4s (tap to skip)
 * once the persisted-language choice has hydrated.
 */
export default function SplashOverlay({ onFinish }: { onFinish: () => void }) {
  const { tokens } = useThemeContext();
  const { t } = useTranslation();
  const { isHydrated } = useLanguageContext();
  const [minElapsed, setMinElapsed] = useState(false);
  const opacity = useSharedValue(1);
  const fadeStarted = useRef(false);
  const nativeHidden = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  // (c) Cross-fade the overlay out once the min-visible window has elapsed AND
  // the language choice has hydrated (so the route underneath is settled).
  useEffect(() => {
    if (fadeStarted.current) return;
    if (!minElapsed || !isHydrated) return;
    fadeStarted.current = true;
    opacity.value = withTiming(0, { duration: FADE_MS }, (finished) => {
      if (finished) runOnJS(onFinish)();
    });
  }, [minElapsed, isHydrated, onFinish, opacity]);

  // (b) Hand off from the native launch screen only once THIS overlay has
  // actually painted, guaranteeing an identical frame is already on screen.
  const handleLayout = useCallback(() => {
    if (nativeHidden.current) return;
    nativeHidden.current = true;
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);

  // Tap-to-skip collapses the min-visible window; the fade still waits for
  // hydration so we never reveal an unsettled route.
  const skip = () => setMinElapsed(true);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[StyleSheet.absoluteFill, styles.overlay, fadeStyle]}
    >
      <Pressable
        style={{ flex: 1 }}
        onPress={skip}
        accessibilityRole="button"
        accessibilityLabel={t('splash.skip')}
      >
        <AppView flex={1} colorName="background" center>
          <TreadBand color={tokens.textMuted} position="top" />

          <Animated.View entering={FadeIn.duration(400)} style={{ alignItems: 'center', gap: 18 }}>
            <AppLogo size={46} spin />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={{ width: 18, height: 1, backgroundColor: tokens.textMuted }} />
              <AppText
                family="accent"
                weight="semibold"
                style={{ fontSize: 12, letterSpacing: 2, color: tokens.textMuted }}
              >
                MATOR.UZ
              </AppText>
              <View style={{ width: 18, height: 1, backgroundColor: tokens.textMuted }} />
            </View>
          </Animated.View>

          <AppView style={{ position: 'absolute', bottom: 72, alignItems: 'center', gap: 16 }}>
            <WheelLoader size={26} color={tokens.textMuted} />
            <AppText
              family="accent"
              weight="semibold"
              style={{ fontSize: 11, letterSpacing: 3, color: tokens.textMuted }}
            >
              {t('splash.tagline')}
            </AppText>
          </AppView>

          <TreadBand color={tokens.textMuted} position="bottom" />
        </AppView>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Sit above the navigator until the cross-fade completes and we unmount.
  overlay: { zIndex: 999, elevation: 999 },
});

/**
 * Faint tire-tread band — a low-opacity row of slanted bars evoking the
 * handoff's repeating-linear-gradient tread. Pure Views, no gradient dep.
 */
function TreadBand({ color, position }: { color: string; position: 'top' | 'bottom' }) {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        [position]: 0,
        left: 0,
        right: 0,
        height: 56,
        flexDirection: 'row',
        overflow: 'hidden',
        opacity: 0.06,
      }}
    >
      {Array.from({ length: 40 }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 6,
            height: 120,
            marginRight: 8,
            backgroundColor: color,
            transform: [{ rotate: '20deg' }, { translateY: -20 }],
          }}
        />
      ))}
    </View>
  );
}
