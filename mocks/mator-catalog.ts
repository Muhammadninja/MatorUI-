/**
 * Faithful mock fixtures from the Mator design prototype
 * (`design_handoff_mator_app/prototype/Mator.dc.html`). Per the redesign
 * directive, the rebuilt screens render the prototype's own seed data (parts
 * with ratings / was-prices / OEM numbers) rather than the live car catalog,
 * so the app is a faithful demo of the handoff design.
 *
 * Data copied verbatim from the prototype's `products`, `categories`,
 * `addresses`, `cards`, and seed `vehicles` / `cart`.
 */

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

export type MatorVehicle = {
  id: string;
  make: string;
  model: string;
  year: number;
  trim: string;
  vin: string;
  img: string;
  color: string;
  mileage: string;
};

export type MatorAddress = {
  id: string;
  label: string;
  name: string;
  line: string;
  city: string;
  def?: boolean;
};

export type MatorCard = {
  id: string;
  brand: string;
  last: string;
  exp: string;
  def?: boolean;
};

export const MATOR_PRODUCTS: MatorProduct[] = [
  { id: 'p1', title: 'Ceramic Brake Pads — Front', oem: 'GD1234-8Z', price: 64.99, was: 82.0, rating: 4.8, reviews: 214, cat: 'Brakes', brand: 'Bosch QuietCast', img: 'brake pads', featured: true },
  { id: 'p2', title: 'Genuine Oil Filter', oem: '90915-YZZE1', price: 12.49, rating: 4.6, reviews: 530, cat: 'Filters', brand: 'Toyota OEM', img: 'oil filter', featured: true },
  { id: 'p3', title: 'Iridium TT Spark Plug', oem: 'SK20R11', price: 9.99, rating: 4.9, reviews: 1204, cat: 'Ignition', brand: 'Denso', img: 'spark plug', featured: true },
  { id: 'p4', title: 'Cabin Air Filter', oem: '87139-YZZ09', price: 18.0, rating: 4.5, reviews: 88, cat: 'Filters', brand: 'Denso', img: 'cabin filter' },
  { id: 'p5', title: 'Wiper Blade Set 26"/16"', oem: '85222-0E010', price: 27.5, rating: 4.4, reviews: 143, cat: 'Exterior', brand: 'Bosch Icon', img: 'wiper blades' },
  { id: 'p6', title: 'Alternator 130A Remanufactured', oem: '27060-0P260', price: 189.0, was: 249.0, rating: 4.7, reviews: 64, cat: 'Electrical', brand: 'Denso', img: 'alternator', featured: true },
  { id: 'p7', title: 'Serpentine Drive Belt', oem: '90916-A2010', price: 22.75, rating: 4.6, reviews: 97, cat: 'Engine', brand: 'Gates', img: 'drive belt' },
  { id: 'p8', title: 'Brake Rotor — Front Vented', oem: '43512-0E010', price: 78.0, rating: 4.7, reviews: 132, cat: 'Brakes', brand: 'Brembo', img: 'brake rotor' },
  { id: 'p9', title: 'Engine Air Filter', oem: '17801-0H080', price: 21.3, rating: 4.6, reviews: 176, cat: 'Filters', brand: 'K&N', img: 'air filter' },
  { id: 'p10', title: '12V AGM Battery Group 35', oem: 'BCI-35-AGM', price: 214.99, rating: 4.8, reviews: 51, cat: 'Electrical', brand: 'Optima', img: 'battery' },
];

export const MATOR_CATEGORIES: readonly (MatorCategory | 'All')[] = [
  'All',
  'Brakes',
  'Filters',
  'Ignition',
  'Engine',
  'Electrical',
  'Exterior',
] as const;

export const MATOR_VEHICLES: MatorVehicle[] = [
  { id: 'v1', make: 'Toyota', model: 'Camry', year: 2019, trim: 'SE 2.5L', vin: '4T1B11HK1KU', img: 'sedan', color: 'Midnight Black', mileage: '48,200 mi' },
  { id: 'v2', make: 'Honda', model: 'Civic', year: 2021, trim: 'Sport 1.5T', vin: '2HGFC2F58MH', img: 'hatchback', color: 'Sonic Gray', mileage: '19,750 mi' },
];

export const MATOR_ADDRESSES: MatorAddress[] = [
  { id: 'a1', label: 'Home', name: 'Alex Marino', line: '2140 Chestnut St, Apt 6', city: 'Philadelphia, PA 19103', def: true },
  { id: 'a2', label: 'Work', name: 'Alex Marino', line: '801 Market St, Floor 12', city: 'Philadelphia, PA 19107' },
];

export const MATOR_CARDS: MatorCard[] = [
  { id: 'c1', brand: 'Visa', last: '4821', exp: '08/27', def: true },
  { id: 'c2', brand: 'Mastercard', last: '9037', exp: '11/26' },
];

/** Default seed cart from the prototype: p1 ×1, p3 ×4. */
export const MATOR_SEED_CART: { id: string; qty: number }[] = [
  { id: 'p1', qty: 1 },
  { id: 'p3', qty: 4 },
];

/** Format a numeric USD amount the way the prototype's `money()` does. */
export function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export function productById(id: string): MatorProduct | undefined {
  return MATOR_PRODUCTS.find((p) => p.id === id);
}

export function featuredProducts(): MatorProduct[] {
  return MATOR_PRODUCTS.filter((p) => p.featured);
}

export function productsByCategory(cat: MatorCategory | 'All'): MatorProduct[] {
  return cat === 'All' ? MATOR_PRODUCTS : MATOR_PRODUCTS.filter((p) => p.cat === cat);
}

/** Percentage saved vs the struck-through `was` price, rounded (for SAVE pills). */
export function savePercent(p: MatorProduct): number | null {
  if (!p.was) return null;
  return Math.round((1 - p.price / p.was) * 100);
}

// ---- v2 Explore home (AutoZone-style category browser) ----

/** A colorful "Shop by category" tile. `color` is the accent (the one
 *  intentional exception to the monochrome system). */
export type MatorCatTile = {
  name: string;
  count: number;
  color: string;
};

/** The 12 category tiles for the Explore grid (verbatim from the prototype). */
export const MATOR_CAT_TILES: MatorCatTile[] = [
  { name: 'Brakes', count: 128, color: '#db4437' },
  { name: 'Batteries', count: 42, color: '#0f9d58' },
  { name: 'Filters', count: 96, color: '#4285f4' },
  { name: 'Ignition', count: 74, color: '#f4b400' },
  { name: 'Engine', count: 210, color: '#7c4dff' },
  { name: 'Electrical', count: 118, color: '#f59e0b' },
  { name: 'Oil & Fluids', count: 65, color: '#00acc1' },
  { name: 'Belts & Hoses', count: 53, color: '#8e24aa' },
  { name: 'Wipers', count: 31, color: '#039be5' },
  { name: 'Lighting', count: 88, color: '#fb8c00' },
  { name: 'Suspension', count: 77, color: '#e91e8c' },
  { name: 'Exterior', count: 49, color: '#3949ab' },
];

/** A "Shop by vehicle" make tile. `body` picks the car silhouette glyph. */
export type MatorMake = {
  name: string;
  color: string;
  body: 'sedan' | 'suv' | 'truck' | 'hatchback';
  models: string[];
};

/** The makes for the "Shop by vehicle" row. Uses the brand logos shipped in
 *  `assets/brands/` (see `brand-logo.tsx`) — the popular makes on mator.uz.
 *  `color` is each brand's accent (tile border/tint); `body` picks the car
 *  silhouette used for the per-model rows on the Make screen. */
export const MATOR_MAKES: MatorMake[] = [
  { name: 'Chevrolet', color: '#CD9834', body: 'sedan', models: ['Cobalt', 'Nexia', 'Malibu', 'Tracker', 'Onix', 'Spark'] },
  { name: 'Hyundai', color: '#002C5E', body: 'suv', models: ['Sonata', 'Elantra', 'Tucson', 'Santa Fe', 'Accent'] },
  { name: 'Kia', color: '#BB162B', body: 'suv', models: ['K5', 'Sportage', 'Sorento', 'Cerato', 'Seltos'] },
  { name: 'Skoda', color: '#4BA82E', body: 'hatchback', models: ['Octavia', 'Rapid', 'Superb', 'Kodiaq', 'Fabia'] },
  { name: 'Volkswagen', color: '#151F5D', body: 'sedan', models: ['Polo', 'Passat', 'Tiguan', 'Jetta', 'Golf'] },
];

/**
 * Map a category-tile name to the Category screen's route params, mirroring
 * the prototype's `catRoute`: tiles that don't have their own product bucket
 * fall back to the nearest real category (or "All").
 */
export function categoryRouteFor(name: string): { cat: MatorCategory | 'All'; label: string } {
  const known: MatorCategory[] = ['Brakes', 'Filters', 'Ignition', 'Engine', 'Electrical', 'Exterior'];
  if ((known as string[]).includes(name)) return { cat: name as MatorCategory, label: name };
  const fallback: Record<string, MatorCategory | 'All'> = {
    Batteries: 'Electrical',
    'Oil & Fluids': 'Filters',
    'Belts & Hoses': 'Engine',
    Wipers: 'Exterior',
  };
  return { cat: fallback[name] ?? 'All', label: name };
}

/** Look up a make tile by name (falls back to the first make). */
export function makeByName(name: string | undefined): MatorMake {
  return MATOR_MAKES.find((m) => m.name === name) ?? MATOR_MAKES[0];
}

// ---- MATOR Certified (sponsored / sellable placements) ----
//
// The Explore "MATOR Certified" row is a MONETIZABLE placement slot — it holds
// more than dealers: certified product categories ("Certified Batteries"),
// promoted storefronts, and sold ad units. Each entry is a generic placement
// with a `target` that says where a tap goes. Hardcoded seed for now; this maps
// 1:1 onto a future `GET /v1/placements` (or `/promotions`) endpoint.

/** Where tapping a certified placement routes. */
export type CertifiedTarget =
  // The premium "MATOR Certified" catalogue view (catalog-parts-screen): a
  // curated cross-system collection, filtered by part QUALITY (all OEM / all
  // GM) — NOT by a car system/category. `query` optionally scopes it (e.g. a
  // "Certified Batteries" collection) while keeping the premium catalogue UI.
  | { kind: 'catalogue'; label: string; certified?: 'oem' | 'gm'; query?: string }
  | { kind: 'category'; id: string; label: string } // a catalog category (backend category id)
  | { kind: 'dealer'; id: string; label: string } // a verified storefront/dealer
  | { kind: 'search'; query: string } // a pre-filled catalog search
  | { kind: 'url'; href: string }; // an external / sponsor link

/** One card in the MATOR Certified row. */
export type MatorCertifiedPlacement = {
  id: string;
  /** Primary line, e.g. "Certified Batteries", "AutoPro Parts". */
  title: string;
  /** Secondary line, e.g. "18k+ orders · 12y" or "Genuine · 2-year warranty". */
  subtitle?: string;
  /** Badge chips under the banner. Defaults to the standard certified badges. */
  badges?: string[];
  /** Banner visual: a letter monogram OR an image, over an accent color. */
  visual: { monogram?: string; imageUrl?: string; color: string };
  /** Where a tap goes. */
  target: CertifiedTarget;
  /** Set when this slot is a sold/sponsored placement (for a "Sponsored" tag). */
  sponsor?: { name: string; sponsored: boolean };
};

/** Seed certified placements — premium cross-system catalogues (all OEM / all
 *  GM / a certified collection) plus verified dealers. All open the premium
 *  "MATOR Certified" catalogue view, never a plain car-system listing. */
export const MATOR_CERTIFIED: MatorCertifiedPlacement[] = [
  {
    id: 'c_oem',
    title: 'Certified OEM Parts',
    subtitle: 'Genuine OEM · guaranteed fit',
    visual: { monogram: 'O', color: '#2A6FDB' },
    target: { kind: 'catalogue', label: 'MATOR Certified · OEM', certified: 'oem' },
  },
  {
    id: 'c_gm',
    title: 'Certified GM Parts',
    subtitle: 'Chevrolet · Ravon · Daewoo',
    visual: { monogram: 'G', color: '#D97757' },
    target: { kind: 'catalogue', label: 'MATOR Certified · GM', certified: 'gm' },
  },
  {
    id: 'c_batteries',
    title: 'Certified Batteries',
    subtitle: 'Genuine · 2-year warranty',
    visual: { monogram: 'B', color: '#0f9d58' },
    target: { kind: 'catalogue', label: 'MATOR Certified Batteries', query: 'battery' },
  },
  { id: 'd1', title: 'AutoPro Parts', subtitle: '18k+ orders · 12y', visual: { monogram: 'A', color: '#1F8A5B' }, target: { kind: 'dealer', id: 'd1', label: 'AutoPro Parts' } },
  { id: 'd2', title: 'Prime Motors Supply', subtitle: '9.4k+ orders · 8y', visual: { monogram: 'P', color: '#7c4dff' }, target: { kind: 'dealer', id: 'd2', label: 'Prime Motors Supply' } },
];

/** Default certified badges when a placement doesn't override them. */
export const DEFAULT_CERTIFIED_BADGES = ['MATOR CERTIFIED', 'LOWEST PRICE'] as const;

