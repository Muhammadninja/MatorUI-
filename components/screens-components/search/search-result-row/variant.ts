import { Award, Tag } from 'lucide-react-native';
import type { ComponentType } from 'react';

import { hashCode } from './helpers';
import type { IconTone } from './signal';

export type AccentIcon = ComponentType<{
  size?: number;
  strokeWidth?: number;
  color?: string;
}>;

export type DeliveryKind = 'free' | 'standard';

export type CardVariant = {
  /** Delivery line carries a semantic kind, not a color. The component
   *  (`delivery-row.tsx`) maps kind → theme token so the green/gray
   *  follows the theme instead of being a literal hex baked into the
   *  data layer. */
  delivery: { labelKey: string; kind: DeliveryKind };
  /** Client-side accent-tag fallback. Carries `tone` so the ribbon icon
   *  resolves to the right theme color (value → green, accolade → gold). */
  accentTag: { labelKey: string; Icon: AccentIcon; tone: IconTone } | null;
};

/**
 * Deterministic per-item card variation so every result reads as distinct:
 *  - Search has no delivery quote; never invent a free tier or an ETA.
 *  - About 50% of cards get an accent tag (Lowest price / Bestseller)
 *    for rhythm; the rest stay plain.
 *
 * NOTE: `accentTag` is now the CLIENT-SIDE FALLBACK. The server-driven
 * source of truth is `SearchResult.accentTagKind`. Once the backend
 * reliably emits it on every result, this slot can be removed entirely.
 * See `text/07-search-row-signals-and-api.md`.
 */
export function deriveCardVariant(id: string): CardVariant {
  const h = hashCode(id);

  const delivery: CardVariant['delivery'] = {
    labelKey: 'search.deliveryAtCheckout',
    kind: 'standard',
  };

  const tagOptions: CardVariant['accentTag'][] = [
    { labelKey: 'search.signal.lowestPrice', Icon: Tag, tone: 'value' },
    { labelKey: 'search.signal.bestseller', Icon: Award, tone: 'accolade' },
    null,
    null,
  ];
  const accentTag = tagOptions[(h * 7) % tagOptions.length];

  return { delivery, accentTag };
}
