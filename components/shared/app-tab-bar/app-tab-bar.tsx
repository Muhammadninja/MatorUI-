import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withDelay,
    withRepeat,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type AppTabBarItem = {
  key: string;
  label: string;
  icon?: ReactNode | ((isActive: boolean) => ReactNode);
  onPress?: () => void;
  badgeLabel?: string;
  disabled?: boolean;
  /** Center "Assistant" tab: renders inline as a brand-filled circular
   *  button instead of a plain icon (no active-indicator bar). */
  emphasized?: boolean;
};

export type AppTabBarProps = {
  items?: AppTabBarItem[];
  activeKey?: string;
};

/** Soft indigo accent for the emphasized AI Assistant button (both themes). */
const ASSISTANT_ACCENT = '#000';

/** Diameter of the emphasized Assistant button (drives the shine geometry). */
const EMPHASIZED_SIZE = 46;

const PREVIEW_ITEMS: AppTabBarItem[] = [
  { key: 'home', label: 'Home' },
  { key: 'discover', label: 'Discover' },
  { key: 'profile', label: 'Profile' },
];

function TabBarAnimatedIcon({ icon, isActive }: { icon: ReactNode; isActive: boolean }) {
  // Worklet-driven spring — runs on the UI thread, never competes with
  // React Query / chat streaming on the JS thread.
  const scale = useSharedValue(isActive ? 1.12 : 1);

  useEffect(() => {
    scale.value = withSpring(isActive ? 1.12 : 1, {
      damping: 12,
      stiffness: 220,
      mass: 0.7,
    });
  }, [isActive, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return <Animated.View style={animatedStyle}>{icon}</Animated.View>;
}

/**
 * `AssistantShine` — a soft white gloss that periodically sweeps diagonally
 * across the emphasized Assistant button (a "glint" that says the tab is the
 * smart/AI one). Runs entirely on the UI thread (reanimated worklet), so it
 * never competes with chat streaming on the JS thread. Meant to be rendered
 * inside an `overflow: 'hidden'` round wrapper so the streak is clipped to the
 * circle. Non-interactive.
 */
function AssistantShine({ size }: { size: number }) {
  // 0 → 1 drives the streak from off the left edge to off the right edge, then
  // waits (withDelay) before glinting again. reverse=false + a 0-opacity
  // envelope at both ends hides the instant 1→0 reset.
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(
      withDelay(1800, withTiming(1, { duration: 850, easing: Easing.inOut(Easing.ease) })),
      -1,
      false,
    );
  }, [progress]);

  const streakStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.15, 0.85, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-size * 0.85, size * 0.85]) },
      { rotate: '22deg' },
    ],
  }));

  return (
    <AppView pointerEvents="none" style={StyleSheet.absoluteFill} center>
      <Animated.View style={streakStyle}>
        {/* Wide faint halo + narrow bright core = a soft-edged gloss. */}
        <AppView center style={{ width: size * 0.5, height: size * 1.7 }}>
          <AppView
            style={{
              position: 'absolute',
              width: size * 0.5,
              height: size * 1.7,
              borderRadius: size,
              backgroundColor: 'rgba(255, 255, 255, 0.10)',
            }}
          />
          <AppView
            style={{
              width: size * 0.16,
              height: size * 1.7,
              borderRadius: size,
              backgroundColor: 'rgba(255, 255, 255, 0.45)',
            }}
          />
        </AppView>
      </Animated.View>
    </AppView>
  );
}

/** Breathing room between the tab row and the bottom safe-area edge (home
 *  indicator / Android nav bar). Used as a floor when there's no system inset
 *  (e.g. older Android with an opaque nav bar reporting inset 0). */
const BAR_BOTTOM_GAP = 12;

export default function AppTabBar({ items = PREVIEW_ITEMS, activeKey = 'home' }: AppTabBarProps) {
  const { scheme, tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Pad the bar past the real bottom inset so it clears the home indicator on
  // iOS and the gesture pill / 3-button nav bar on Android (edge-to-edge is the
  // default on modern Expo/Android, so the system bar draws over our content).
  // A fixed value here (the old pb={28}) sat *under* the Android nav buttons.
  const barPaddingBottom = Math.max(insets.bottom, BAR_BOTTOM_GAP);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSubscription = Keyboard.addListener(showEvent, () => setIsKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setIsKeyboardVisible(false));

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  if (isKeyboardVisible) {
    return null;
  }

  return (
    <AppView style={styles.container} colorName="background">
      <AppView
        row
        style={styles.bar}
        colorName="background"
        borderTopWidth={1}
        borderName="divider"
        px={10}
        pt={2}
        pb={barPaddingBottom}
        gap={4}
      >
        {items.map((item) => {
          const isActive = item.key === activeKey;
          const icon = typeof item.icon === 'function' ? item.icon(isActive) : item.icon;

          // Center "Assistant" tab — brand-filled circular button, inline
          // with the row (never protrudes above the bar, per the handoff).
          if (item.emphasized) {
            return (
              <AppView key={item.key} style={styles.itemSlot}>
                <AppPressableView
                  onPress={item.onPress}
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                  disabled={item.disabled}
                  rounded={999}
                  androidRipple={false}
                  pressedOpacity={0.85}
                  pressedScale={0.96}
                  center
                  style={[
                    styles.emphasized,
                    {
                      // The AI Assistant button gets its own soft indigo accent
                      // (same in both themes) so it reads as "smart/AI" instead
                      // of a hard black disc. Faint top-sheen rim + a gentle
                      // color-tinted shadow keep it modern but modest.
                      backgroundColor: ASSISTANT_ACCENT,
                      borderWidth: 1,
                      borderColor: 'rgba(255, 255, 255, 0.22)',
                      ...(isActive
                        ? {
                            shadowColor: tokens.gray400,
                            shadowOpacity: 0.45,
                            shadowRadius: 14,
                            shadowOffset: { width: 5, height: 5 },
                            elevation: 8,
                          }
                        : null),
                    },
                  ]}
                  hitSlop={10}
                >
                  {/* Clipped to the circle so the gloss sweep never escapes the
                      disc. Separate from the button (which owns the shadow) —
                      overflow:'hidden' on the shadowed view would clip it away. */}
                  <AppView pointerEvents="none" style={styles.emphasizedClip}>
                    <AssistantShine size={EMPHASIZED_SIZE} />
                  </AppView>
                  {icon}
                </AppPressableView>
              </AppView>
            );
          }

          return (
            <AppView key={item.key} style={styles.itemSlot}>
              <AppView
                style={[
                  styles.indicator,
                  {
                    backgroundColor: scheme === 'dark' ? tokens.white : tokens.black,
                    borderColor: scheme === 'dark' ? tokens.white : tokens.black,
                  },
                  !isActive ? styles.indicatorHidden : undefined,
                ]}
              />
              <AppPressableView
                onPress={item.onPress}
                accessibilityLabel={item.label}
                accessibilityRole="button"
                disabled={item.disabled}
                rounded={18}
                androidRipple={false}
                pressedOpacity={0.7}
                pressedScale={1}
                style={styles.item}
                hitSlop={10}
              >
                <AppView style={styles.itemContent}>
                  <AppView style={styles.iconWrap}>
                    {icon ? <TabBarAnimatedIcon icon={icon} isActive={isActive} /> : null}
                    {item.badgeLabel ? (
                      <AppView
                        center
                        rounded={36}
                        style={[
                          styles.badge,
                          {
                            backgroundColor: scheme === 'dark' ? tokens.white : tokens.black,
                          },
                        ]}
                      >
                        <AppText
                          textVariant="bodyXs"
                          weight="bold"
                          style={{ color: scheme === 'dark' ? tokens.black : tokens.white }}
                        >
                          {item.badgeLabel}
                        </AppText>
                      </AppView>
                    ) : null}
                  </AppView>
                </AppView>
              </AppPressableView>
            </AppView>
          );
        })}
      </AppView>
    </AppView>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
  },
  itemSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  indicator: {
    width: 50,
    height: 8,
    borderWidth: 1,
    borderRadius: 36,
    marginBottom: 1,
    borderTopRightRadius: 4,
    borderTopLeftRadius: 4,
  },
  indicatorHidden: {
    opacity: 0,
  },
  item: {
    width: '100%',
    minHeight: 44,
  },
  emphasized: {
    width: EMPHASIZED_SIZE,
    height: EMPHASIZED_SIZE,
  },
  emphasizedClip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    overflow: 'hidden',
  },
  itemContent: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -8,
    right: -16,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
  },
});
