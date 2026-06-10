import { Star } from 'lucide-react-native';

import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export default function StarBar({ rating }: { rating: number }) {
  const { tokens } = useThemeContext();
  return (
    <AppView row align="center" gap={1}>
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = rating >= i + 1;
        const half = !filled && rating >= i + 0.5;
        const color = filled || half ? tokens.rating : tokens.gray200;
        return (
          <Star
            key={i}
            size={12}
            strokeWidth={2}
            color={color}
            fill={filled ? tokens.rating : 'transparent'}
          />
        );
      })}
    </AppView>
  );
}
