import React from 'react';
import { Check } from 'lucide-react-native';

import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

export type AppCheckboxProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  /** Rendered to the right of the box. Kept as a node so callers can embed
   *  tappable document links inside the label text. */
  children?: React.ReactNode;
  disabled?: boolean;
  accessibilityLabel?: string;
  testID?: string;
};

const BOX = 20;

/**
 * Square checkbox with an optional inline label.
 *
 * Only the box itself toggles — the label area is left inert so that links
 * embedded in a consent sentence stay independently tappable without a stray
 * tap flipping the box.
 */
export function AppCheckbox({
  checked,
  onChange,
  children,
  disabled = false,
  accessibilityLabel,
  testID,
}: AppCheckboxProps) {
  const { tokens } = useThemeContext();

  return (
    <AppView row gap={10} align="flex-start">
      <AppPressableView
        testID={testID}
        androidRipple={false}
        disabled={disabled}
        onPress={() => {
          triggerHaptic('selection');
          onChange(!checked);
        }}
        accessibilityRole="checkbox"
        accessibilityState={{ checked, disabled }}
        accessibilityLabel={accessibilityLabel}
        // Small target by design — pad the touch area out to ~44pt.
        hitSlop={12}
        center
        style={{
          width: BOX,
          height: BOX,
          borderRadius: 6,
          borderWidth: 1.5,
          borderColor: checked ? tokens.brand : tokens.border,
          backgroundColor: checked ? tokens.brand : 'transparent',
          opacity: disabled ? 0.5 : 1,
          marginTop: 1,
        }}
      >
        {checked ? <Check size={14} strokeWidth={3} color={tokens.background} /> : null}
      </AppPressableView>
      {children ? <AppView style={{ flex: 1 }}>{children}</AppView> : null}
    </AppView>
  );
}

export default AppCheckbox;
