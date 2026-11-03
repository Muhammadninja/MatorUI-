import { Minus, Plus } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

export type QtyStepperProps = {
  value: number;
  onIncrement: () => void;
  onDecrement: () => void;
  /** Lower bound; the − button disables at this value. Default 1. */
  min?: number;
  /** Upper bound; the + button disables at this value. */
  max?: number;
  /** Control size — `md` (48px) on Item Detail, `sm` (36px) in Cart. */
  size?: 'sm' | 'md';
  disabled?: boolean;
  /** When set, the − / + buttons expose `${testID}-dec` / `${testID}-inc`
   *  testIDs (for E2E). */
  testID?: string;
};

/**
 * `QtyStepper` — one bordered − / value / + control. Used on Item Detail (`md`,
 * 48px tall) and in the Cart line items (`sm`, 36px tall with 48px touch areas).
 */
export default function AppQtyStepper({
  value,
  onIncrement,
  onDecrement,
  min = 1,
  max,
  size = 'md',
  disabled = false,
  testID,
}: QtyStepperProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  // One bordered control. `sm` draws slimmer than it responds: hitSlop brings
  // each button's touch area to 48 × 48 without inflating a cart row.
  const buttonWidth = size === 'md' ? 48 : 40;
  const controlHeight = size === 'md' ? 48 : 36;
  const iconSize = size === 'md' ? 18 : 16;
  const canDec = !disabled && value > min;
  const canInc = !disabled && (max === undefined || value < max);

  const button = (kind: 'dec' | 'inc', enabled: boolean, onPress: () => void) => (
    <AppPressableView
      center
      onPress={() => {
        if (!enabled) return;
        triggerHaptic('selection');
        onPress();
      }}
      disabled={!enabled}
      androidRipple={false}
      pressedOpacity={0.6}
      hitSlop={{
        top: (48 - controlHeight) / 2,
        bottom: (48 - controlHeight) / 2,
        left: (48 - buttonWidth) / 2,
        right: (48 - buttonWidth) / 2,
      }}
      accessibilityRole="button"
      testID={testID ? `${testID}-${kind}` : undefined}
      accessibilityLabel={t(kind === 'dec' ? 'common.decreaseQuantity' : 'common.increaseQuantity')}
      style={{ width: buttonWidth, height: controlHeight, opacity: enabled ? 1 : 0.4 }}
    >
      {kind === 'dec' ? (
        <Minus size={iconSize} strokeWidth={2.4} color={tokens.text} />
      ) : (
        <Plus size={iconSize} strokeWidth={2.4} color={tokens.text} />
      )}
    </AppPressableView>
  );

  return (
    <AppView row align="center" rounded={12} colorName="card" borderWidth={1} borderName="controlBorder">
      {button('dec', canDec, onDecrement)}
      <AppText
        weight="semibold"
        textVariant="body"
        style={{ minWidth: 24, textAlign: 'center', fontVariant: ['tabular-nums'] }}
      >
        {value}
      </AppText>
      {button('inc', canInc, onIncrement)}
    </AppView>
  );
}
