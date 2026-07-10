import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { AppLogo } from '@/components/shared/app-logo';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useLanguageContext } from '@/contexts/language.context';
import { useThemeContext } from '@/contexts/theme.context';

const MIN_VISIBLE_MS = 2400;

/**
 * Branded splash. Shows the MATOR wordmark with the wheel-O spinning, a
 * `— MATOR.UZ —` lockup, tread bands top & bottom, and a wheel spinner.
 * Auto-advances after ~2.4s (tap to skip) to the language picker on first
 * launch, or straight to Explore once a language has been chosen. Waits for
 * the persisted-language hydration before deciding so we never flash the
 * wrong route.
 */
export default function SplashScreen() {
  const { tokens } = useThemeContext();
  const { isHydrated, hasChosen } = useLanguageContext();
  const [minElapsed, setMinElapsed] = useState(false);
  const navigatedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setMinElapsed(true), MIN_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (navigatedRef.current) return;
    if (!minElapsed || !isHydrated) return;
    navigatedRef.current = true;
    router.replace(hasChosen ? '/explore' : '/select-language?mode=onboarding');
  }, [minElapsed, isHydrated, hasChosen]);

  const skip = () => {
    if (navigatedRef.current) return;
    // Tap-to-skip still respects hydration; if not hydrated yet, collapse the
    // min-visible window so navigation fires the instant hydration lands.
    if (isHydrated) {
      navigatedRef.current = true;
      router.replace(hasChosen ? '/explore' : '/select-language?mode=onboarding');
    } else {
      setMinElapsed(true);
    }
  };

  return (
    <Pressable style={{ flex: 1 }} onPress={skip} accessibilityRole="button" accessibilityLabel="Skip">
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
            AUTO PARTS MARKETPLACE
          </AppText>
        </AppView>

        <TreadBand color={tokens.textMuted} position="bottom" />
      </AppView>
    </Pressable>
  );
}

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
