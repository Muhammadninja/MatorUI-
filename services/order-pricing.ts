/** Confirmed order amounts only. Arithmetic checks never fill missing fields. */
export type OrderPricingInput = {
  currency?: string | null;
  subtotal_uzs?: unknown;
  delivery_uzs?: unknown;
  service_fee_uzs?: unknown;
  discount_uzs?: unknown;
  total_uzs?: unknown;
  items?: readonly { qty?: unknown; price_uzs?: unknown; line_total_uzs?: unknown }[] | null;
};
export type OrderLinePricing = {
  quantity: number | null;
  unitPrice: number | null;
  lineTotal: number | null;
};
export type OrderPricing = {
  subtotal: number | null;
  delivery: number | null;
  serviceFee: number | null;
  discount: number | null;
  total: number | null;
  lines: OrderLinePricing[];
  checks: { totals: boolean | null; items: boolean | null; units: (boolean | null)[] };
  status: 'confirmed' | 'incomplete' | 'inconsistent';
};

/** The API names amounts in UZS; retain at most two decimal places exactly. */
export function confirmedMoney(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  const cents = Math.round(value * 100);
  return Number.isSafeInteger(cents) && Number(value.toFixed(2)) === value ? value : null;
}

export function formatOrderMoney(value: number | null | undefined): string {
  const amount = confirmedMoney(value);
  if (amount === null) return '';
  const [whole, fraction] = (Number.isInteger(amount) ? String(amount) : amount.toFixed(2)).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')}${fraction ? `.${fraction}` : ''} so'm`;
}
const cents = (value: number) => Math.round(value * 100);
function checkedSum(values: number[]): number | null {
  let sum = 0;
  for (const value of values) {
    const next = sum + value;
    if (!Number.isSafeInteger(next)) return null;
    sum = next;
  }
  return sum;
}

export function getOrderPricing(raw: OrderPricingInput): OrderPricing {
  // Missing currency still has the explicit *_uzs field contract; contradictory
  // currency must not be relabeled as som.
  const supported = raw.currency == null || raw.currency === 'UZS';
  const money = (value: unknown) => supported ? confirmedMoney(value) : null;
  const subtotal = money(raw.subtotal_uzs);
  const delivery = money(raw.delivery_uzs);
  const serviceFee = money(raw.service_fee_uzs);
  const discount = money(raw.discount_uzs);
  const total = money(raw.total_uzs);
  const lines = (raw.items ?? []).map((item) => ({
    quantity: typeof item.qty === 'number' && Number.isSafeInteger(item.qty) && item.qty > 0 ? item.qty : null,
    unitPrice: money(item.price_uzs),
    lineTotal: money(item.line_total_uzs),
  }));
  let totals: boolean | null = null;
  if (subtotal !== null && delivery !== null && serviceFee !== null && discount !== null && total !== null) {
    const base = checkedSum([cents(subtotal), cents(delivery), cents(serviceFee)]);
    if (base !== null) {
      const expected = base - cents(discount);
      if (Number.isSafeInteger(expected)) totals = expected === cents(total);
    }
  }
  let items: boolean | null = null;
  if (Array.isArray(raw.items) && subtotal !== null && lines.every((line) => line.lineTotal !== null)) {
    const sum = checkedSum(lines.map((line) => cents(line.lineTotal!)));
    if (sum !== null) items = sum === cents(subtotal);
  }
  const units = lines.map(({ quantity, unitPrice, lineTotal }) => {
    if (quantity === null || unitPrice === null || lineTotal === null) return null;
    const expected = cents(unitPrice) * quantity;
    return Number.isSafeInteger(expected) ? expected === cents(lineTotal) : null;
  });
  const checks = [totals, items, ...units];
  const status = checks.includes(false) ? 'inconsistent' : checks.includes(null) ? 'incomplete' : 'confirmed';
  return { subtotal, delivery, serviceFee, discount, total, lines, checks: { totals, items, units }, status };
}
