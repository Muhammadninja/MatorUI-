import { useTranslation } from 'react-i18next';
import { CarFront } from 'lucide-react-native';

import { RADIUS_PILL, RADIUS_SHEET } from '@/components/screens-components/search/radii';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type GarageEmptyStateProps = {
  onAddVehicle: () => void;
};

export function GarageEmptyState({ onAddVehicle }: GarageEmptyStateProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppView flex={1} px={20} justify="center" align="center">
      <AppView
        rounded={RADIUS_SHEET}
        p="xl"
        gap={20}
        align="center"
        colorName="card"
        borderName="border"
        borderWidth={1}
        style={{ width: '100%', maxWidth: 360 }}
      >
        {/* True circle (radius >> half side) for the icon medallion.
         *  Uses RADIUS_PILL because 72/2=36 happens to match the pill
         *  constant, so the value is grep-able alongside other pills. */}
        <AppView
          center
          rounded={RADIUS_PILL}
          colorName="backgroundSecondary"
          borderName="border"
          borderWidth={1}
          style={{ width: 72, height: 72 }}
        >
          <CarFront size={28} strokeWidth={2} color={tokens.text} />
        </AppView>

        <AppView gap={6} align="center">
          <AppText textVariant="title" family="heading" colorName="text" align="center">
            {t('garage.emptyTitle')}
          </AppText>
          <AppText textVariant="bodySm" colorName="textMuted" align="center">
            {t('garage.emptyBody')}
          </AppText>
        </AppView>

        <AppButton
          title={t('garage.addVehicle')}
          kind="brand"
          size="lg"
          fullWidth
          onPress={onAddVehicle}
        />
      </AppView>
    </AppView>
  );
}

export default GarageEmptyState;
