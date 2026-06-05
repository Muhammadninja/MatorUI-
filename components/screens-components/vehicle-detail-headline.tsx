import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

export type VehicleDetailHeadlineProps = {
  eyebrow?: string;
  headline: string;
  subline?: string;
};

export function VehicleDetailHeadline({
  eyebrow = 'In the garage',
  headline,
  subline,
}: VehicleDetailHeadlineProps) {
  return (
    <AppView px={20} gap={6}>
      <AppText
        textVariant="caption"
        family="accent"
        colorName="gray400"
        transform="uppercase"
        numberOfLines={1}
      >
        {eyebrow}
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
