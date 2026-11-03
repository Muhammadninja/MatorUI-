import type { ComponentType } from 'react';

import type { IconTone } from './signal';

export type AccentIcon = ComponentType<{
  size?: number;
  strokeWidth?: number;
  color?: string;
}>;

export type DeliveryKind = 'free' | 'standard';

export type CardVariant = {
  /** Delivery line carries a semantic kind, not a color. */
  delivery: { labelKey: string; kind: DeliveryKind };
  /** No inferred commercial claims when the server supplies no accent. */
  accentTag: { labelKey: string; Icon: AccentIcon; tone: IconTone } | null;
};

/**
 * Search has no delivery quote; never invent a free tier or an ETA.
 * Commercial accents come from SearchResult metadata, never an item-ID hash.
 */
export function deriveCardVariant(_id: string): CardVariant {
  const delivery: CardVariant['delivery'] = {
    labelKey: 'search.deliveryAtCheckout',
    kind: 'standard',
  };

  return { delivery, accentTag: null };
}
