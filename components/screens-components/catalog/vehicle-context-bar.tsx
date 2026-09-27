import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Persistent vehicle-context bar shown atop every catalog view.
 *
 * One card, two states — same anatomy in both (status dot, uppercase eyebrow
 * over a bold line, trailing chevron), so switching states reads as the same
 * control changing its status rather than as two different widgets:
 *
 *   set   — green dot, "Fitting parts for" / `2019 Chevrolet Cobalt LT`.
 *   unset — amber dot, "Fitment not set" / "Select your vehicle".
 *
 * The card matches the app's standard `card` fill used by list rows and
 * section cards, so it sits in the catalog scroll without announcing itself as
 * an alert. Both states route to the Garage.
 */
function VehicleContextBar() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { currentActiveVehicle } = useActiveVehicle();

  const v = currentActiveVehicle?.vehicle;
  const label = v ? [v.year, v.make, v.model, v.trim].filter(Boolean).join(' ') : null;

  const handlePress = () => {
    triggerHaptic('selection');
    router.navigate('/garage');
  };

  return (
    <AppPressableView
      testID="vehicle-fitment-bar"
      onPress={handlePress}
      androidRipple={false}
      pressedOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={
        label
          ? t('catalog.fittingPartsAccessibility', { label })
          : t('catalog.selectVehiclePrompt')
      }
      row
      align="center"
      gap={12}
      px={14}
      py={12}
      rounded={16}
      colorName="card"
      // The icon tile used to give this row its width. A 9px dot does not, so
      // without this the Pressable shrinks to its content and the bar renders
      // as a stub.
      fillContainer
    >
      {/* A dot, nothing more. This was a 36px tinted tile with a car glyph in
       *  it AND a ringed status dot pinned to its corner — a badge on a tile
       *  on a bar, to say one binary thing. The colour says it. */}
      <AppView
        testID="fitment-status-indicator"
        rounded={999}
        style={{
          width: 9,
          height: 9,
          flexShrink: 0,
          backgroundColor: label ? tokens.success : tokens.warning,
        }}
      />

      <AppView flex={1} gap={2}>
        <AppText
          family="accent"
          weight="bold"
          transform="uppercase"
          style={{ fontSize: 9.5, letterSpacing: 1.1, color: tokens.textMuted }}
        >
          {label ? t('catalog.fittingPartsFor') : t('catalog.fitmentNotSet')}
        </AppText>
        <AppText family="heading" weight="bold" style={{ fontSize: 14.5, color: tokens.text }}>
          {label ?? t('catalog.selectVehicleTitle')}
        </AppText>
      </AppView>

      <ChevronRight size={18} strokeWidth={2.2} color={tokens.textMuted} />
    </AppPressableView>
  );
}

export default memo(VehicleContextBar);
