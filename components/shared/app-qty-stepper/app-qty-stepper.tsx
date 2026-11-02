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
  /** Control size — `md` (42px) on Item Detail, `sm` (30px) in Cart. */
  size?: 'sm' | 'md';
  disabled?: boolean;
  /** When set, the − / + buttons expose `${testID}-dec` / `${testID}-inc`
   *  testIDs (for E2E). */
  testID?: string;
};

/**
 * `QtyStepper` — bordered − / value / + control from the Mator handoff.
 * Used on Item Detail (`md`, 42px) and in the Cart line items (`sm`, 30px).
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
  const box = size === 'md' ? 42 : 30;
  const iconSize = size === 'md' ? 18 : 15;
  const canDec = !disabled && value > min;
  const canInc = !disabled && (max === undefined || value < max);

  const button = (kind: 'dec' | 'inc', enabled: boolean, onPress: () => void) => (
    <AppPressableView
      center
      rounded={size === 'md' ? 12 : 999}
      onPress={() => {
        if (!enabled) return;
        triggerHaptic('selection');
        onPress();
      }}
      disabled={!enabled}
      androidRipple={false}
      pressedOpacity={0.6}
      borderWidth={1}
      borderName="border"
      accessibilityRole="button"
      testID={testID ? `${testID}-${kind}` : undefined}
      accessibilityLabel={t(kind === 'dec' ? 'common.decreaseQuantity' : 'common.increaseQuantity')}
      style={{ width: box, height: box, opacity: enabled ? 1 : 0.4 }}
    >
      {kind === 'dec' ? (
        <Minus size={iconSize} strokeWidth={2.4} color={tokens.text} />
      ) : (
        <Plus size={iconSize} strokeWidth={2.4} color={tokens.text} />
      )}
    </AppPressableView>
  );

  return (
    <AppView row align="center" gap={size === 'md' ? 14 : 10}>
      {button('dec', canDec, onDecrement)}
      <AppText
        family="heading"
        weight="bold"
        textVariant={size === 'md' ? 'subtitle' : 'body'}
        style={{ minWidth: size === 'md' ? 24 : 18, textAlign: 'center' }}
      >
        {value}
      </AppText>
      {button('inc', canInc, onIncrement)}
    </AppView>
  );
}
