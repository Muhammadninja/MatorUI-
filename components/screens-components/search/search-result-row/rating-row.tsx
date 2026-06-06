import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

import { formatCount } from './helpers';
import StarBar from './star-bar';

export default function RatingRow({
  rating,
  reviewCount,
}: {
  rating: number;
  reviewCount: number;
}) {
  const { tokens } = useThemeContext();
  return (
    <AppView row align="center" gap={5}>
      <StarBar rating={rating} />
      <AppText textVariant="bodyXs" style={{ color: tokens.gray400, fontSize: 11 }}>
        {rating.toFixed(1)}
      </AppText>
      <AppText textVariant="bodyXs" style={{ color: tokens.gray400, fontSize: 11 }}>
        ({formatCount(reviewCount)})
      </AppText>
    </AppView>
  );
}
