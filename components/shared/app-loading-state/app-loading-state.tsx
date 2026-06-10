import { ActivityIndicator } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { ColorName } from '@/themes';

export type AppLoadingStateProps = {
  /** Optional label rendered below the spinner. */
  label?: string;
  /** Spinner color token. Defaults to `text`. */
  spinnerColorName?: ColorName;
  /** Label color token. Defaults to `gray400`. */
  labelColorName?: ColorName;
  /** Spinner size. Defaults to `small`. */
  size?: 'small' | 'large';
};

/**
 * Centered full-area loading affordance — spinner plus an optional
 * label. Replaces the per-screen `<AppView center>...</AppView>` +
 * `ActivityIndicator` + caption pattern (garage, cart hydration,
 * order history, etc.).
 */
export function AppLoadingState({
  label,
  spinnerColorName = 'text',
  labelColorName = 'gray400',
  size = 'small',
}: AppLoadingStateProps) {
  const { tokens } = useThemeContext();
  return (
    <AppView flex={1} center gap={12}>
      <ActivityIndicator size={size} color={tokens[spinnerColorName]} />
      {label ? (
        <AppText textVariant="bodySm" colorName={labelColorName}>
          {label}
        </AppText>
      ) : null}
    </AppView>
  );
}

export default AppLoadingState;
