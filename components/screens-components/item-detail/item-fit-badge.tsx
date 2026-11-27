import { Check, CircleAlert, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';
import type { CompatibilityResult } from '@/services/compatibility-service';

export type ItemFitBadgeProps = {
  result: CompatibilityResult;
  /** The active garage vehicle this verdict is about. */
  subtitle: string | null;
  /** Omitted where the search screen is in another tab; the CTA is hidden. */
  onShowAlternatives?: () => void;
};

/**
 * Fit verdict, driven by the real backend compatibility check.
 *
 * The verdict carries in an icon and the colour of the sentence itself — green
 * fits, amber unknown, red doesn't. The red state keeps the "show alternatives"
 * CTA.
 */
export function ItemFitBadge({ result, subtitle, onShowAlternatives }: ItemFitBadgeProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  const { accent, fill, Icon } =
    result.status === 'EXACT_MATCH' || result.status === 'UNIVERSAL'
      ? { accent: tokens.success, fill: tokens.successSoft, Icon: Check }
      : result.status === 'NOT_COMPATIBLE'
        ? { accent: tokens.error, fill: tokens.errorSoft, Icon: X }
        : { accent: tokens.warning, fill: tokens.warningSoft, Icon: CircleAlert };

  return (
    <AppView row gap={12} rounded={16} p={16} style={{ backgroundColor: fill }}>
      <Icon size={20} strokeWidth={2.4} color={accent} />
      <AppView flex={1} gap={10}>
        <AppView gap={3}>
          <AppText family="accent" weight="bold" style={{ fontSize: 14, lineHeight: 20, color: accent }}>
            {t(
              result.status === 'EXACT_MATCH' || result.status === 'UNIVERSAL'
                ? 'itemDetail.fitConfirmed'
                : result.status === 'NOT_COMPATIBLE'
                  ? 'itemDetail.fitNotCompatible'
                  : 'itemDetail.fitUnknown',
            )}
          </AppText>
          {subtitle ? (
            <AppText family="default" style={{ fontSize: 14, lineHeight: 20, color: tokens.textMuted }}>
              {subtitle}
            </AppText>
          ) : null}
        </AppView>
        {result.status === 'NOT_COMPATIBLE' && onShowAlternatives ? (
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
      row
      align="center"
      gap={6}
      rounded={8}
      px={12}
      py={8}
      style={{ alignSelf: 'flex-start', backgroundColor: tokens.successSoft }}
    >
      <Check size={16} strokeWidth={2.6} color={tokens.success} />
      <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.success }}>
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
        <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted }}>
          {t('itemDetail.checkingFit', { vehicle: vehicleLabel })}
        </AppText>
      </AppView>
    );
  }

  if (vehicleLabel)
    return (
      <AppView gap={4}>
        <AppText textVariant="bodySm" weight="semibold">
          {t('itemDetail.fitUnknown')}
        </AppText>
        <AppText textVariant="bodySm" colorName="textMuted">
          {vehicleLabel}
        </AppText>
      </AppView>
    );

  return (
    <AppPressableView
      onPress={onPress}
      androidRipple={false}
      pressedOpacity={0.9}
      gap={6}
      rounded={16}
      p={16}
      accessibilityRole="button"
      accessibilityLabel={t('itemDetail.confirmFitTitle')}
      style={{ backgroundColor: tokens.brandSoft }}
    >
      <AppText family="heading" weight="bold" style={{ fontSize: 15, color: tokens.text }}>
        {t('itemDetail.confirmFitTitle')}
      </AppText>
      <AppText family="default" style={{ fontSize: 13, lineHeight: 19, color: tokens.textMuted }}>
        {t('itemDetail.confirmFitBody')}
      </AppText>
      <AppText
        family="accent"
        weight="bold"
        style={{ fontSize: 14, lineHeight: 20, color: tokens.brandText, marginTop: 2 }}
      >
        {`${t('itemDetail.addYourCar')} →`}
      </AppText>
    </AppPressableView>
  );
}

export default ItemFitBadge;
