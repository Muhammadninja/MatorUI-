import { router } from 'expo-router';
import { CarFront, ChevronRight } from 'lucide-react-native';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { AppIconBox } from '@/components/shared/app-icon-box';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Persistent vehicle-context bar shown atop every catalog view.
 *
 * One card, two states — same anatomy in both (car icon box with a status dot,
 * uppercase eyebrow over a bold line, trailing chevron), so switching states
 * reads as the same control changing its status rather than as two different
 * widgets:
 *
 *   set   — green dot, "Fitting parts for" / `2019 Chevrolet Cobalt LT`.
 *   unset — amber dot, "Fitment not set" / "Select your vehicle".
 *
 * The card matches the app's standard `card` + 1px border surface used by list
 * rows and section cards, so it sits in the catalog scroll without announcing
 * itself as an alert. Both states route to the Garage.
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
      rounded={14}
      colorName="card"
      borderWidth={1}
      borderName="border"
    >
      <AppView>
        <AppIconBox
          Icon={CarFront}
          size={36}
          iconSize={19}
          strokeWidth={1.9}
          rounded={11}
          colorName={label ? 'text' : 'textMuted'}
        />
        {/* Status dot, ringed in the card colour so it reads as attached to
            the icon: green when parts are being filtered, amber when nothing
            is scoping them yet. */}
        <AppView
          testID="fitment-status-indicator"
          rounded={999}
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: 12,
            height: 12,
            backgroundColor: label ? tokens.success : tokens.warning,
            borderWidth: 2.5,
            borderColor: tokens.card,
          }}
        />
      </AppView>

      <AppView flex={1} gap={1}>
        <AppText
          family="accent"
          weight="medium"
          numberOfLines={1}
          style={{ fontSize: 10, letterSpacing: 0.7, textTransform: 'uppercase', color: tokens.textMuted }}
        >
          {label ? t('catalog.fittingPartsFor') : t('catalog.fitmentNotSet')}
        </AppText>
        <AppText family="accent" weight="bold" numberOfLines={1} style={{ fontSize: 13.5, color: tokens.text }}>
          {label ?? t('catalog.selectVehicleTitle')}
        </AppText>
      </AppView>

      <ChevronRight size={18} strokeWidth={2.2} color={tokens.textMuted} />
    </AppPressableView>
  );
}

export default memo(VehicleContextBar);
