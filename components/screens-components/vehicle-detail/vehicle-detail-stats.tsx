import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type VehicleDetailStatsProps = {
  mileage: string;
  plate: string;
  color: string;
};

export function VehicleDetailStats({ mileage, plate, color }: VehicleDetailStatsProps) {
  const { tokens } = useThemeContext();

  return (
    <AppView px={20}>
      <AppView
        rounded={24}
        colorName="card"
        borderName="border"
        borderWidth={1}
      >
        <AppView row p={18} gap={14}>
          <Cell label="Mileage" value={mileage} />
          <AppView style={{ width: 1, backgroundColor: tokens.divider }} />
          <Cell label="Plate" value={plate} />
          <AppView style={{ width: 1, backgroundColor: tokens.divider }} />
          <Cell label="Color" value={color} />
        </AppView>
      </AppView>
    </AppView>
  );
}

type CellProps = { label: string; value: string };

function Cell({ label, value }: CellProps) {
  return (
    <AppView flex={1} gap={4}>
      <AppText
        textVariant="caption"
        family="accent"
        colorName="gray400"
        transform="uppercase"
        numberOfLines={1}
      >
        {label}
      </AppText>
      <AppText textVariant="bodySemibold" colorName="text" numberOfLines={1}>
        {value}
      </AppText>
    </AppView>
  );
}

export default VehicleDetailStats;
