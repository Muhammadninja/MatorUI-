import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

export type AddVehicleStepIndicatorProps = {
  total: number;
  current: number;
  label?: string;
};

export function AddVehicleStepIndicator({
  total,
  current,
  label,
}: AddVehicleStepIndicatorProps) {
  return (
    <AppView gap="sm" px={20} pb="xs">
      <AppView row align="center" justify="space-between" gap={10}>
        <AppText
          textVariant="caption"
          family="accent"
          colorName="gray400"
          transform="uppercase"
          numberOfLines={1}
        >
          {`Step ${current} of ${total}`}
        </AppText>
        {label ? (
          <AppText textVariant="bodySemibold" colorName="text" numberOfLines={1}>
            {label}
          </AppText>
        ) : null}
      </AppView>
      <AppView row gap={6}>
        {Array.from({ length: total }).map((_, i) => (
          <AppView
            key={i}
            flex={1}
            rounded={999}
            colorName={i < current ? 'brand' : 'border'}
            style={{ height: 4 }}
          />
        ))}
      </AppView>
    </AppView>
  );
}

export default AddVehicleStepIndicator;
