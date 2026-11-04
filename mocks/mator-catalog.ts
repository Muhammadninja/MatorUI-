/** Legacy product-card types and pure formatters. No sample products, account data or catalog fallback. */
export type MatorProduct = {
  id: string;
  title: string;
  oem: string;
  price: number;
  was?: number;
  rating: number;
  reviews: number;
  cat: MatorCategory;
  brand: string;
  /** Placeholder image label (the prototype uses striped placeholders). */
  img: string;
  /** Real product image URL. Optional so the contract is ready before the
   *  backend ships imagery — cards render this when present and fall back
   *  to the striped `img` placeholder when absent. */
  imageUrl?: string;
  featured?: boolean;
};

export type MatorCategory =
  | 'Brakes'
  | 'Filters'
  | 'Ignition'
  | 'Engine'
  | 'Electrical'
  | 'Exterior';

export function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function savePercent(p: MatorProduct): number | null {
  if (!p.was) return null;
  return Math.round((1 - p.price / p.was) * 100);
}

