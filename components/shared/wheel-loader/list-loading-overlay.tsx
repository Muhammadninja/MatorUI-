import { BlurView } from 'expo-blur';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import WheelLoader from '@/components/shared/wheel-loader/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';

export type ListLoadingOverlayProps = {
  /** When false the overlay renders nothing. */
  visible: boolean;
  /** Copy under the wheel, e.g. "Finding parts that fit…". */
  label: string;
};

/**
 * `ListLoadingOverlay` — a full-area translucent, blurred overlay with a
 * centered ~46px spinning [[WheelLoader]] and a label. Shown over Category /
 * Make while the (simulated) fetch resolves, per the loader handoff.
 */
export default function ListLoadingOverlay({ visible, label }: ListLoadingOverlayProps) {
  const { tokens, scheme } = useThemeContext();
  if (!visible) return null;
  const dark = scheme === 'dark';

  return (
    <AppView
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 }}
      center
      pointerEvents="auto"
    >
      <BlurView
        intensity={dark ? 30 : 45}
        tint={dark ? 'dark' : 'light'}
        style={StyleSheet.absoluteFill}
      />
      <AppView
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: `${tokens.background}b3` }}
      />
      <AppView center gap={16}>
        <WheelLoader size={46} color={tokens.text} />
        <AppText family="accent" weight="semibold" style={{ fontSize: 14, color: tokens.textMuted }}>
          {label}
        </AppText>
      </AppView>
    </AppView>
  );
}
