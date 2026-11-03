import { router } from 'expo-router';
import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';
import {
  getBrand,
  getEngine,
  getGeneration,
  getModel,
  getTrim,
} from '@/services/uz-vehicle-catalog';
import { triggerHaptic } from '@/utils/haptics';

export type FitmentNoteProps = {
  /** What the line already says — category, result count, section name. The
   *  vehicle is appended to it after a separator. Omit for a standalone line. */
  lead?: string;
  /** Font size of the whole line. Match the line it joins. Default 13. */
  size?: number;
};

/**
 * The vehicle, folded into a line of text the screen was already showing.
 *
 * This replaces the fitment BAR — a 64px boxed control repeated at the top of
 * every catalog screen. Three redesigns of that box (neutral card, black plate,
 * green plate) all failed for the same reason: it was a box. The information is
 * one short phrase, so it now lives as a tappable span inside the result-count
 * line, costing nothing in height and adding no chrome to the page.
 *
 * Renders "8 parts · for 2019 Cobalt LT", with the car underlined and tapping
 * through to the Garage. With no vehicle set the span becomes "choose a car",
 * so the way IN to picking a vehicle survives the bar's removal — that entry
 * point is what makes the whole fit-check flow reachable.
 *
 * Attention is spent only where there is something to do. A 5px dot leads the
 * line — quiet teal when a car is set (green would claim a verified fit), amber and breathing three times when
 * one isn't — and the unattended span is coloured as a link. Settled state
 * stays silent: a marker that pulses forever is a nag, not a cue.
 */
function FitmentNote({ lead, size = 13 }: FitmentNoteProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { currentActiveVehicle, isHydrating } = useActiveVehicle();

  // Until the persisted vehicle hydrates, show only what the caller gave us —
  // flashing "choose a car" at someone who has a garage is worse than waiting.
  const vehicle = isHydrating ? null : resolveVehicleLabel(currentActiveVehicle);

  const openGarage = () => {
    triggerHaptic('selection');
    router.navigate('/garage');
  };

  // Three slow breaths, then still. Long enough to catch the eye on arrival,
  // short enough that it never becomes something to tune out — and it runs
  // ONLY while no car is set, because that is the only state asking for a tap.
  const pulse = useRef(new Animated.Value(1)).current;
  const needsVehicle = !isHydrating && !vehicle;
  useEffect(() => {
    if (!needsVehicle) {
      pulse.setValue(1);
      return;
    }
    const breath = Animated.sequence([
      Animated.timing(pulse, {
        toValue: 0.3,
        duration: 650,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 1,
        duration: 650,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    const animation = Animated.loop(breath, { iterations: 3 });
    animation.start();
    return () => animation.stop();
  }, [needsVehicle, pulse]);

  const dotColor = vehicle ? tokens.brand : tokens.warning;
  // Set: full-strength text — it states a fact, so it reads as a fact, not as
  // greyed-out chrome. Unset: a real link colour, because it is the one thing
  // on the line worth tapping.
  const linkColor = vehicle ? tokens.text : tokens.brandText;

  return (
    <AppView row align="flex-start" gap={7}>
      {/* The marker, not a container: 5px of colour at the head of the line.
       *  It is the whole of the "look here" — anything larger becomes the box
       *  this component exists to avoid. */}
      {isHydrating ? null : (
        <Animated.View
          style={{
            width: 5,
            height: 5,
            borderRadius: 999,
            backgroundColor: dotColor,
            opacity: pulse,
            // Optically centred on the first line's cap height rather than its
            // box, so the dot sits with the text and not above it.
            marginTop: size * 0.5,
          }}
        />
      )}
      {/* Lead and link are SIBLINGS, not a nested <Text>. Nested text inherits
       *  the parent's muted grey in ways that are hard to override per
       *  platform, which washed the link out — and `textDecorationLine` offers
       *  no control over where the underline sits. A real bottom border does
       *  both: full colour, and an underline that can breathe. The row wraps,
       *  so a long lead still flows onto a second line. */}
      <AppView row align="flex-start" wrap flex={1} columnGap={5} rowGap={2}>
        {lead ? (
          <AppText
            family="default"
            style={{ fontSize: size, lineHeight: size + 6, color: tokens.textMuted }}
          >
            {`${lead} ·`}
          </AppText>
        ) : null}
        {isHydrating ? null : (
          <AppPressableView
            onPress={openGarage}
            androidRipple={false}
            pressedOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={
              vehicle
                ? t('catalog.fittingPartsAccessibility', { label: vehicle })
                : t('catalog.selectVehiclePrompt')
            }
            style={{
              // The underline, 3px clear of the baseline instead of welded to
              // it, in the link's own colour at 55%.
              paddingBottom: 3,
              borderBottomWidth: 1,
              borderBottomColor: `${linkColor}8c`,
            }}
          >
            <AppText
              family="default"
              weight="semibold"
              style={{ fontSize: size, lineHeight: size + 4, color: linkColor }}
            >
              {vehicle ? t('catalog.forVehicle', { vehicle }) : t('catalog.chooseVehicle')}
            </AppText>
          </AppPressableView>
        )}
      </AppView>
    </AppView>
  );
}

/**
 * Best label the active vehicle can give: the garage row (year + make + model),
 * else the persisted catalog fitment ids — which resolve even before the garage
 * list loads, so the line names the car instead of offering "choose a car" to
 * someone who already has one. Trim and engine are dropped; this is one
 * fragment inside a sentence, not a spec sheet.
 */
function resolveVehicleLabel(
  active: ReturnType<typeof useActiveVehicle>['currentActiveVehicle'],
): string | null {
  if (!active) return null;

  const v = active.vehicle;
  if (v) {
    const label = [v.year, v.make, v.model].filter(Boolean).join(' ');
    if (label) return label;
  }

  const { fitment } = active;
  const label = [
    getBrand(fitment.brandId)?.label,
    getModel(fitment.modelId)?.label,
    fitment.generationId ? getGeneration(fitment.generationId)?.label : undefined,
    fitment.trimId ? getTrim(fitment.trimId)?.label : undefined,
    fitment.engineId ? getEngine(fitment.engineId)?.label : undefined,
  ]
    .filter(Boolean)
    .join(' ');

  return label || null;
}

export default memo(FitmentNote);
