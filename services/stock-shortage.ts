/**
 * What the server says when an order cannot be supplied: 409 PART_UNAVAILABLE with
 * `details.lines`, one per part. Each says how many were asked for and how many there
 * are, whether the supplier lacks them or other orders hold them for now, and the same
 * part at other sellers. Nothing here changes the cart: the buyer chooses.
 */

export type ShortageCause = 'source_stock' | 'reserved';

export type ShortageAlternative = {
  partId: string;
  title: string;
  sellerName: string;
  priceUzs: number;
  /** Null when the seller does not count this listing. */
  availableQuantity: number | null;
  coversRequested: boolean;
};

export type StockShortageLine = {
  partId: string;
  requestedQuantity: number;
  availableQuantity: number;
  cause: ShortageCause | null;
  sourcingRequested: boolean;
  alternatives: ShortageAlternative[];
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;
const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

function parseAlternative(raw: unknown): ShortageAlternative | null {
  if (!isRecord(raw)) return null;
  const partId = str(raw.part_id);
  const price = num(raw.price_uzs);
  if (!partId || price === null) return null;
  return {
    partId,
    title: str(raw.title) ?? '',
    sellerName: str(raw.seller_name) ?? '',
    priceUzs: price,
    availableQuantity: num(raw.available_quantity),
    coversRequested: raw.covers_requested === true,
  };
}

/** The shortage lines of a refusal, or none when it is not one or the server sent none. */
export function stockShortageLines(code: string | null, details: unknown): StockShortageLine[] {
  if (code !== 'PART_UNAVAILABLE' || !isRecord(details) || !Array.isArray(details.lines)) {
    return [];
  }
  return details.lines.flatMap((raw): StockShortageLine[] => {
    if (!isRecord(raw)) return [];
    const partId = str(raw.part_id);
    const requested = num(raw.requested_quantity);
    if (!partId || requested === null) return [];
    const cause = raw.cause === 'source_stock' || raw.cause === 'reserved' ? raw.cause : null;
    return [
      {
        partId,
        requestedQuantity: requested,
        availableQuantity: num(raw.available_quantity) ?? 0,
        cause,
        sourcingRequested: raw.sourcing_requested === true,
        alternatives: Array.isArray(raw.alternatives)
          ? raw.alternatives
              .map(parseAlternative)
              .filter((a): a is ShortageAlternative => a !== null)
          : [],
      },
    ];
  });
}

/** How many of an alternative the buyer can take: what was asked, at most what it has. */
export function alternativeQuantity(line: StockShortageLine, alt: ShortageAlternative): number {
  const cap = alt.availableQuantity ?? line.requestedQuantity;
  return Math.max(1, Math.min(line.requestedQuantity, cap));
}

export function shortageCauseKey(cause: ShortageCause | null): string {
  return cause === 'reserved' ? 'checkout.stockReserved' : 'checkout.stockSourceShort';
}
