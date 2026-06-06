import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export default function PriceBlock({
  priceLabel,
  price,
}: {
  priceLabel: string;
  price: string;
}) {
  const { tokens } = useThemeContext();
  return (
    <AppView gap={2} style={{ marginTop: 2 }}>
      <AppText textVariant="bodyXs" style={{ color: tokens.gray400, fontSize: 12 }}>
        {priceLabel}
      </AppText>
      <AppText
        family="heading"
        weight="bold"
        style={{ fontSize: 22, lineHeight: 26, color: tokens.text }}
      >
        {price}
      </AppText>
    </AppView>
  );
}
