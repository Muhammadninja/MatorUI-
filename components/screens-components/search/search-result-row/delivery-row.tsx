import { Truck } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

import type { CardVariant } from './variant';

export default function DeliveryRow({
  delivery,
}: {
  delivery: CardVariant['delivery'];
}) {
  const { tokens } = useThemeContext();
  // Kind → theme token. Free tiers ride `tokens.success` so the green
  // tracks the active theme (lighter in dark, darker in light); the
  // standard tier rides `tokens.gray400` for a balanced muted gray that
  // also follows the theme.
  const color = delivery.kind === 'free' ? tokens.success : tokens.gray400;
  return (
    <AppView row align="center" gap="xs">
      <Truck size={12} strokeWidth={2} color={color} />
      <AppText
        textVariant="bodyXs"
        weight="semibold"
        style={{ color, fontSize: 10 }}
      >
        {delivery.label}
      </AppText>
    </AppView>
  );
}
