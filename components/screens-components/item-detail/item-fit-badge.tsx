import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';
import type { CompatibilityColor, CompatibilityResult } from '@/services/compatibility-service';

export type ItemFitBadgeProps = {
  result: CompatibilityResult;
  /** The active garage vehicle this verdict is about. */
  subtitle: string | null;
  onShowAlternatives: () => void;
};

/**
 * Fit verdict, driven by the real backend compatibility check.
 *
 * The verdict carries in a coloured rule down the left edge and in the colour
 * of the sentence itself — green fits, amber unsure, red doesn't — rather than
 * a glyph in a circle. The red state keeps the "show alternatives" CTA.
 */
export function ItemFitBadge({ result, subtitle, onShowAlternatives }: ItemFitBadgeProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  const colorFor = (c: CompatibilityColor) =>
    c === 'green' ? tokens.success : c === 'red' ? tokens.error : tokens.warning;
  const accent = colorFor(result.badge.color);

  return (
    <AppView row gap={13} rounded={18} p={14} style={{ backgroundColor: `${accent}12` }}>
      <AppView rounded={999} style={{ width: 3, alignSelf: 'stretch', backgroundColor: accent }} />
      <AppView flex={1} gap={10}>
        <AppView gap={3}>
          <AppText family="accent" weight="bold" style={{ fontSize: 14.5, color: accent }}>
            {result.badge.text}
          </AppText>
          {subtitle ? (
            <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted }}>
              {subtitle}
            </AppText>
          ) : null}
        </AppView>
        {result.status === 'NOT_COMPATIBLE' ? (
          <AppButton
            title={t('itemDetail.showAlternatives')}
            kind="secondary"
            size="sm"
            fullWidth
            onPress={onShowAlternatives}
          />
        ) : null}
      </AppView>
    </AppView>
  );
}

/**
 * Static "fits everything" line for universal listings (oils under "Другое").
 * No status and no CTA — a quiet green pill, because a compatibility verdict
 * for a part that fits every car would be noise.
 */
export function ItemUniversalFitBadge() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppView
      rounded={999}
      px={12}
      py={7}
      style={{ alignSelf: 'flex-start', backgroundColor: tokens.successSoft }}
    >
      <AppText family="accent" weight="bold" style={{ fontSize: 12.5, color: tokens.success }}>
        {t('itemDetail.universalFitTitle')}
      </AppText>
    </AppView>
  );
}

export type ItemVehicleCtaProps = {
  /** True while the backend fit check is still in flight. */
  checking: boolean;
  /** Active garage vehicle label, when there is one. */
  vehicleLabel: string | null;
  onPress: () => void;
};

/**
 * Fit-first prompt. With no vehicle in the garage there is no fit answer to
 * give, and "will this fit my car?" is the question that stalls the purchase —
 * so instead of rendering nothing, offer the one-tap way to answer it. While a
 * check IS running against a known vehicle, say so rather than leaving a hole
 * where the verdict will appear.
 */
export function ItemVehicleCta({ checking, vehicleLabel, onPress }: ItemVehicleCtaProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  if (checking && vehicleLabel) {
    return (
      <AppView row align="center" gap={9}>
        <WheelLoader size={14} color={tokens.textMuted} />
        <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted }}>
          {t('itemDetail.checkingFit', { vehicle: vehicleLabel })}
        </AppText>
      </AppView>
    );
  }

  if (vehicleLabel) return null;

  return (
    <AppPressableView
      onPress={onPress}
      androidRipple={false}
      pressedOpacity={0.9}
      gap={6}
      rounded={18}
      px={15}
      py={14}
      accessibilityRole="button"
      accessibilityLabel={t('itemDetail.confirmFitTitle')}
      style={{ backgroundColor: tokens.brandSoft }}
    >
      <AppText family="heading" weight="bold" style={{ fontSize: 15, color: tokens.text }}>
        {t('itemDetail.confirmFitTitle')}
      </AppText>
      <AppText family="default" style={{ fontSize: 12.5, lineHeight: 17, color: tokens.textMuted }}>
        {t('itemDetail.confirmFitBody')}
      </AppText>
      <AppText
        family="accent"
        weight="bold"
        style={{ fontSize: 13, color: tokens.text, marginTop: 2 }}
      >
        {`${t('itemDetail.addYourCar')} →`}
      </AppText>
    </AppPressableView>
  );
}

export default ItemFitBadge;
