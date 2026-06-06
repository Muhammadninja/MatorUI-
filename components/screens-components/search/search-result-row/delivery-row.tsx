import { Truck } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

import type { CardVariant } from './variant';

export default function DeliveryRow({
  delivery,
}: {
  delivery: CardVariant['delivery'];
}) {
  return (
    <AppView row align="center" gap={4} style={{ marginTop: 2 }}>
      <Truck size={14} strokeWidth={2.2} color={delivery.color} />
      <AppText
        textVariant="bodyXs"
        weight="semibold"
        style={{ color: delivery.color, fontSize: 12 }}
        numberOfLines={1}
      >
        {delivery.label}
      </AppText>
    </AppView>
  );
}
