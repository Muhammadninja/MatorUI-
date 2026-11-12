/**
 * Search-screen corner-radius scale.
 *
 * Mixed-radius systems are allowed only when the rule is documented and
 * followed everywhere. The search screen uses exactly six tiers, each
 * tied to a semantic role. Pick from this list — never invent an
 * ad-hoc value at the call site.
 *
 *   PILL        36   interactive elements (CTAs, pill buttons, chips)
 *   SHEET       16   sheet surfaces (long-press preview)
 *   CARD        14   result cards
 *   MEDIA        8   image / media containers (thumbnail)
 *   PLACEHOLDER  4   skeleton shimmer bars
 *   TAG          2   ribbon "price-tag" micro-corner — special case so
 *                    the ribbon reads as a flat strip, not a card
 *
 * Circular elements (e.g. the like button) get their shape from
 * `AppIconButton` itself and don't go through this scale.
 */
export const RADIUS_PILL = 36;
export const RADIUS_SHEET = 16;
export const RADIUS_CARD = 14;
export const RADIUS_MEDIA = 8;
export const RADIUS_PLACEHOLDER = 4;
export const RADIUS_TAG = 2;
