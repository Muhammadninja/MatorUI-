import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { getAppEnvironment } from '@/config/environment';
import { useThemeContext } from '@/contexts/theme.context';

export function DevelopmentEnvironmentBadge() {
  const insets = useSafeAreaInsets();
  const { tokens } = useThemeContext();
  const env = getAppEnvironment();
  // Development clients always; release builds only when they are staging.
  if (!__DEV__ && env.name !== 'staging') return null;
  let host = 'offline';
  try { host = new URL(env.apiBaseUrl).host; } catch { /* offline build */ }
  const label = `${env.name.toUpperCase()} · ${host}`;
  return (
    <AppView
      pointerEvents="none"
      style={{ position: 'absolute', top: insets.top + 2, right: 12, zIndex: 1000,
        backgroundColor: tokens.backgroundSecondary, borderColor: tokens.border,
        borderWidth: 1, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}
    >
      <AppText accessibilityLabel={`Environment: ${label}`} fontSize={10} weight="semibold"
        style={{ color: tokens.text }}>{label}</AppText>
    </AppView>
  );
}
