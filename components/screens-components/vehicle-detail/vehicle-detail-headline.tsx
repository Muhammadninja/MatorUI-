import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

export type VehicleDetailHeadlineProps = {
  eyebrow?: string;
  headline: string;
  subline?: string;
};

export function VehicleDetailHeadline({
  eyebrow,
  headline,
  subline,
}: VehicleDetailHeadlineProps) {
  const { t } = useTranslation();
  const resolvedEyebrow = eyebrow ?? t('vehicleDetail.eyebrow');
  return (
    <AppView px={20} gap={6}>
      <AppText
        textVariant="caption"
        family="accent"
        colorName="gray400"
        transform="uppercase"
        numberOfLines={1}
      >
        {resolvedEyebrow}
      </AppText>
      <AppText textVariant="title" family="heading" weight="bold" colorName="text">
        {headline}
      </AppText>
      {subline ? (
        <AppText textVariant="bodySm" colorName="gray400">
          {subline}
        </AppText>
      ) : null}
    </AppView>
  );
}

export default VehicleDetailHeadline;
