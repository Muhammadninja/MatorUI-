import { Award, BadgePercent, Sparkles, Tag } from 'lucide-react-native';

import type { AccentTagKind } from '@/types/search';

import type { RibbonIcon } from './ribbon';
import type { CardVariant } from './variant';

/**
 * Single-mode ribbon icon color tone. The composite "Mator Pick" star is
 * always gold, so tone only applies when `composite` is false.
 *
 *   value    — savings / cheapest signals (green)
 *   accolade — distinctions / decorations / featured (gold)
 */
export type IconTone = 'value' | 'accolade';

export type PriceSignal = {
  label: string;
  /** One icon for single-signal cards, multiple for the composite "Mator
   *  Pick" ribbon (when a card qualifies for 2+ signal sources). */
  icons: RibbonIcon[];
  /** Single-mode icon tone. Ignored when `composite` is true (composite
   *  always uses the gold star). */
  tone?: IconTone;
  /** Composite ribbons get a "Mator Pick" treatment — single gold
   *  Michelin-star icon and a composite label. */
  composite?: boolean;
};

/**
 * Single source of truth for AccentTagKind → display. When the server
 * starts sending `accentTagKind` on every result, this is the only place
 * the client needs to know how to render each kind.
 */
const ACCENT_KIND_REGISTRY: Record<AccentTagKind, { label: string; Icon: RibbonIcon; tone: IconTone }> = {
  // Tag (not BadgeCheck) — BadgeCheck's interior check disappears when
  // filled at 12px, collapsing into an unrecognisable blob. Tag has a
  // distinctive hole-punch corner that survives the fill, and reads
  // semantically as "price tag = lowest price."
  lowest_price: { label: 'Lowest price', Icon: Tag, tone: 'value' },
  bestseller: { label: 'Bestseller', Icon: Award, tone: 'accolade' },
};

/**
 * Single-ribbon, priority-cascade with composite escalation.
 *
 *   - 0 signals → no ribbon.
 *   - 1 signal  → render its label + icon as normal.
 *   - 2+ signals → render ONE composite "Mator Pick" ribbon, marked by
 *                  a single filled gold Michelin star. Reads as
 *                  "decorated / award-winning" without becoming icon
 *                  soup.
 *
 * Priority (highest → lowest):
 *   1. Cheapest       — derived per-page in the results list. Strongest
 *                       commercial pull.
 *   2. Server badge   — free-text editorial badge ("Top", "New", "Hot
 *                       pick") from the backend.
 *   3. Accent tag     — typed kind ('lowest_price' | 'bestseller')
 *                       from the backend; falls back to client hash-
 *                       derivation while the server is still being
 *                       wired up.
 *
 * Priority controls TWO things:
 *   - which single-signal wins when only one qualifies;
 *   - the order of icons in the composite (Cheapest icon → badge icon →
 *     accent-tag icon).
 */
export function resolvePriceSignal({
  isCheapest,
  badge,
  accentTagKind,
  accentTagFallback,
}: {
  isCheapest?: boolean;
  badge?: string;
  /** Server-supplied accent tag (preferred). */
  accentTagKind?: AccentTagKind;
  /** Client-side hash-derived tag used while the server is being wired
   *  up. Ignored when `accentTagKind` is present. */
  accentTagFallback?: CardVariant['accentTag'];
}): PriceSignal | null {
  const matched: PriceSignal[] = [];

  if (isCheapest) {
    // BadgePercent (not TrendingDown) because single-mode icons are
    // rendered filled — stroke-only arrow icons collapse into an
    // unrecognisable blob when filled. The badge's % glyph has cutouts
    // that survive the fill, so the shape stays readable at 12px.
    matched.push({ label: 'Cheapest', icons: [BadgePercent], tone: 'value' });
  }
  if (badge) {
    matched.push({ label: badge, icons: [Sparkles], tone: 'accolade' });
  }

  // `lowest_price` is the same semantic signal as `isCheapest`; skip
  // the accent when the cheapest flag already fired so the two don't
  // double-count into a composite "Mator Pick".
  const isRedundantLowestPrice = isCheapest && accentTagKind === 'lowest_price';
  const tag = isRedundantLowestPrice
    ? undefined
    : accentTagKind
      ? ACCENT_KIND_REGISTRY[accentTagKind]
      : accentTagFallback;
  if (tag) {
    matched.push({ label: tag.label, icons: [tag.Icon], tone: tag.tone });
  }

  if (matched.length === 0) return null;
  if (matched.length === 1) return matched[0];

  return {
    label: 'Mator Pick',
    icons: matched.flatMap((s) => s.icons),
    composite: true,
  };
}
