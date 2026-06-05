import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import type { ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeContext } from '@/contexts/theme.context';

export type AppBlurViewProps = {
  /** Height of the visible header content (not including safe area or fade). Default 60. */
  contentHeight?: number;
  /** Height of the fade gradient at the bottom edge. Default 24. */
  fadeHeight?: number;
  /** Blur intensity (expo-blur 0-100). Default 80. */
  intensity?: number;
  /** Children rendered on top of the blur (e.g. a screen header). */
  children?: ReactNode;
};

const FADE_STEPS = [0.9, 0.75, 0.6, 0.45, 0.3, 0.18, 0.08, 0.02];

export function AppBlurView({
  contentHeight = 60,
  fadeHeight = 24,
  intensity = 80,
  children,
}: AppBlurViewProps) {
  const insets = useSafeAreaInsets();
  const { scheme, tokens } = useThemeContext();

  const stripHeight = insets.top + contentHeight + fadeHeight;

  // expo-blur on Android renders a translucent gray fallback when the platform
  // can't do real backdrop blur — that's why the header reads "gray" in dark mode.
  // On Android we render a solid theme-bg fill (still wrapped in MaskedView so the
  // bottom fade gradient still draws) instead.
  const isAndroid = Platform.OS === 'android';

  return (
    <>
      <MaskedView
        pointerEvents="none"
        style={[styles.blurContainer, { height: stripHeight }]}
        maskElement={
          <View style={styles.maskWrapper}>
            <View style={styles.maskSolid} />
            <View style={[styles.maskFade, { height: fadeHeight }]}>
              {FADE_STEPS.map((opacity, i) => (
                <View key={i} style={[styles.fadeBand, { opacity }]} />
              ))}
            </View>
          </View>
        }
      >
        {isAndroid ? (
          <View style={[styles.blurFill, { backgroundColor: tokens.background }]} />
        ) : (
          <BlurView
            tint={scheme === 'dark' ? 'dark' : 'light'}
            intensity={intensity}
            style={styles.blurFill}
          />
        )}
      </MaskedView>

      <View
        pointerEvents="box-none"
        style={[styles.overlay, { paddingTop: insets.top }]}
      >
        {children}
      </View>
    </>
  );
}

/**
 * Compute the paddingTop a screen's ScrollView should use so its first item
 * sits just below the visible header (but content scrolls under the blur).
 *
 * @param contentHeight Header content height (matches AppBlurView's prop)
 * @param peek Amount of content that should appear blurred under the header
 *             before being fully under the fade. Default 30, like ExploreScreen.
 */
export function useBlurHeaderInset(contentHeight = 60, peek = 30): number {
  const insets = useSafeAreaInsets();
  return Math.max(0, insets.top + contentHeight - peek);
}

const styles = StyleSheet.create({
  blurContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  blurFill: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  maskWrapper: {
    flex: 1,
  },
  maskSolid: {
    flex: 1,
    backgroundColor: 'black',
  },
  maskFade: {
    flexDirection: 'column',
  },
  fadeBand: {
    flex: 1,
    backgroundColor: 'black',
  },
});

export default AppBlurView;
