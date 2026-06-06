import { Award, BadgeCheck, Zap } from 'lucide-react-native';
import type { ComponentType } from 'react';

import { hashCode } from './helpers';

export type AccentIcon = ComponentType<{
  size?: number;
  strokeWidth?: number;
  color?: string;
}>;

export type CardVariant = {
  delivery: { label: string; color: string };
  accentTag: { label: string; color: string; Icon: AccentIcon } | null;
};

/**
 * Deterministic per-item card variation so every result reads as distinct:
 *  - Delivery copy rotates Same-day → 1-day → 2-day → Standard.
 *  - About 60% of cards get an accent tag (Lowest price / Bestseller /
 *    Editor's pick) for rhythm; the rest stay plain.
 */
export function deriveCardVariant(id: string): CardVariant {
  const h = hashCode(id);
  const SUCCESS = '#16a34a';
  const NEUTRAL = '#737373';

  const deliveryOptions: { label: string; color: string }[] = [
    { label: 'Free same-day delivery', color: SUCCESS },
    { label: 'Free 1-day delivery', color: SUCCESS },
    { label: 'Free 2-day delivery', color: SUCCESS },
    { label: 'Standard delivery 3-5 days', color: NEUTRAL },
  ];
  const delivery = deliveryOptions[h % deliveryOptions.length];

  const tagOptions: CardVariant['accentTag'][] = [
    { label: 'Lowest price', color: '#16a34a', Icon: BadgeCheck },
    { label: 'Bestseller', color: '#d97706', Icon: Award },
    { label: "Editor's pick", color: '#6d28d9', Icon: Zap },
    null,
    null,
  ];
  const accentTag = tagOptions[(h * 7) % tagOptions.length];

  return { delivery, accentTag };
}
