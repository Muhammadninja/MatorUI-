import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type StatusBarScrimProps = {
  /** Extra height below the safe-area top inset. Defaults to 12. */
  fadeHeight?: number;
  /** Top band opacity. Defaults to 0.35 — enough to read white icons over
   *  white photos without making the area look like a header band. */
  opacity?: number;
};

/**
 * Thin dark fade behind the status bar. Drop it at the top of any screen
 * that places imagery edge-to-edge under the status bar — keeps the wifi /
 * signal / battery icons readable regardless of what's behind them, so
 * `statusBarStyle` can stay `light` without per-image guesswork.
 *
 * Pure JS — no `expo-linear-gradient` needed. Stacks N translucent bands
 * with falling opacity, same trick used in `AppBlurView`'s bottom fade.
 */
const BANDS = [0.95, 0.82, 0.68, 0.54, 0.4, 0.27, 0.16, 0.06];

export default function StatusBarScrim({ fadeHeight = 12, opacity = 0.35 }: StatusBarScrimProps) {
  const insets = useSafeAreaInsets();
  const total = insets.top + fadeHeight;

  return (
    <View pointerEvents="none" style={[styles.container, { height: total }]}>
      {BANDS.map((band, i) => (
        <View
          key={i}
          style={[
            styles.band,
            {
              backgroundColor: `rgba(0,0,0,${band * opacity})`,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    flexDirection: 'column',
  },
  band: {
    flex: 1,
  },
});
