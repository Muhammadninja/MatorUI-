import { useEffect } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

/**
 * Visual overlay drawn on top of the camera preview. Four corner
 * brackets define the scan window; a pulsing line sweeps top-to-bottom
 * inside it to communicate "actively scanning". Everything outside the
 * window is dimmed via a four-edge scrim mask so the user knows
 * exactly where to aim.
 *
 * Sizing: 80% of the narrower screen edge, capped at 320px so it
 * doesn't dominate on tablets. Aspect-ratio is 17:3 because that
 * matches a VIN's printed proportions (17 chars in a single row);
 * helps the user line up the camera even when the barcode is small.
 */

const SCREEN = Dimensions.get('window');
const FRAME_MAX = 320;
const FRAME_WIDTH = Math.min(FRAME_MAX, Math.floor(SCREEN.width * 0.8));
const FRAME_HEIGHT = Math.round(FRAME_WIDTH * (3 / 17) * 2.4); // bias toward taller for code39 strips

export type VinScannerOverlayProps = {
  hint?: string;
};

export function VinScannerOverlay({ hint }: VinScannerOverlayProps) {
  const { tokens } = useThemeContext();

  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = 0;
    sweep.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.cubic) }),
      -1,
      true,
    );
    return () => cancelAnimation(sweep);
  }, [sweep]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sweep.value * (FRAME_HEIGHT - 2) }],
    opacity: 0.6 + 0.4 * (1 - Math.abs(sweep.value * 2 - 1)),
  }));

  return (
    <AppView style={styles.root} pointerEvents="none">
      {/* Top + bottom scrim — full width */}
      <AppView style={[styles.scrim, { backgroundColor: tokens.scrim, flex: 1 }]} />
      <AppView style={styles.middleRow}>
        <AppView style={[styles.scrim, { backgroundColor: tokens.scrim, flex: 1 }]} />
        <AppView style={{ width: FRAME_WIDTH, height: FRAME_HEIGHT }}>
          <Corner position="tl" color={tokens.white} />
          <Corner position="tr" color={tokens.white} />
          <Corner position="bl" color={tokens.white} />
          <Corner position="br" color={tokens.white} />
          <Animated.View
            style={[
              styles.sweepLine,
              { backgroundColor: tokens.white },
              sweepStyle,
            ]}
          />
        </AppView>
        <AppView style={[styles.scrim, { backgroundColor: tokens.scrim, flex: 1 }]} />
      </AppView>
      <AppView style={[styles.scrim, { backgroundColor: tokens.scrim, flex: 1 }]}>
        {hint ? (
          <AppView pt={24} px={24} align="center">
            <AppText
              textVariant="bodySm"
              style={{ color: tokens.white, textAlign: 'center', maxWidth: 280 }}
            >
              {hint}
            </AppText>
          </AppView>
        ) : null}
      </AppView>
    </AppView>
  );
}

type CornerProps = { position: 'tl' | 'tr' | 'bl' | 'br'; color: string };

function Corner({ position, color }: CornerProps) {
  const positional: Record<CornerProps['position'], object> = {
    tl: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
    tr: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
    bl: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
    br: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },
  };
  return (
    <AppView
      style={[
        { position: 'absolute', width: 26, height: 26, borderColor: color },
        positional[position],
      ]}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  scrim: {
    opacity: 0.55,
  },
  middleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sweepLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
    top: 0,
    borderRadius: 1,
  },
});

export default VinScannerOverlay;
