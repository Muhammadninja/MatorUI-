/**
 * Canonical Uzbekistan-market vehicle catalogue. Used by:
 *
 *   - the Add-Vehicle wizard (fitment-correct dropdowns + placeholders)
 *   - the parts-search vehicle-context enrichment (generation, engine,
 *     OEM scope so a search for "valve cover gasket" returns parts that
 *     actually fit a Cobalt P2 Premier Turbo, not a generic Cobalt)
 *   - the OEM-number catalogue cross-reference layer (different
 *     generations and trims have completely different OEM numbers, even
 *     for "the same" part on "the same" model)
 *
 * Schema is intentionally split four ways — brand → model → generation
 * → trim → engine — because UZ-market fitment lookups break apart on
 * exactly those four flags. A Cobalt Position 2 Premier Turbo and a
 * Cobalt Position 2 Elegant On-Turbo share a model and a generation
 * but their valve covers, sensors, and front brakes have DIFFERENT OEM
 * numbers. The schema captures that without forcing the UI to know
 * which combinations are compatible.
 */

export type MarketTier = 'uz_top' | 'uz_mid' | 'global';

export type BodyStyle =
  | 'sedan'
  | 'hatchback'
  | 'wagon'
  | 'suv'
  | 'coupe'
  | 'truck'
  | 'van'
  | 'minivan';

export type EngineType = 'na' | 'turbo' | 'hybrid' | 'phev' | 'ev' | 'cng' | 'lpg';

export type TransmissionType = 'manual' | 'automatic' | 'cvt' | 'dct' | 'amt';

export type VehicleBrand = {
  id: string;
  label: string;
  /**
   * Selling-volume tier on the UZ market. The Add-Vehicle wizard pins
   * `uz_top` brands at the top of the picker; `uz_mid` and `global`
   * fall below an "All brands" divider.
   */
  tier: MarketTier;
  /**
   * Local assembler / importer name. Important for OEM-catalogue
   * routing — UzAuto-assembled Chevrolets ship with GM-Uzbekistan
   * part numbers that differ from US/Mexico variants.
   */
  manufacturer?: string;
  /** Optional CDN URL for the brand wordmark / logo. */
  logoUrl?: string;
};

export type VehicleModel = {
  id: string;
  brandId: string;
  label: string;
  bodyStyle: BodyStyle;
  /**
   * Order in which the model appears in the picker for its brand —
   * lower = higher in the list. Defaults to alphabetical when omitted.
   */
  order?: number;
};

export type VehicleGeneration = {
  id: string;
  modelId: string;
  /**
   * Display label as locals would say it — e.g. "Position 2",
   * "Malibu 1", "Nexia 3". NOT the manufacturer's internal codename
   * (J300, J400, etc.) — that lives in `internalCode`.
   */
  label: string;
  yearRange: [number, number];
  /** Manufacturer internal generation code, when public. */
  internalCode?: string;
  /**
   * Whether this generation is still in active production / sale in
   * UZ. Drives the "discontinued" badge in the picker so users don't
   * pick a generation they couldn't realistically own a new copy of.
   */
  active?: boolean;
};

export type VehicleTrim = {
  id: string;
  generationId: string;
  label: string;
  /**
   * Available engines on this trim. A trim can legitimately ship with
   * multiple engine options — e.g. Cobalt Premier sold both Turbo and
   * On-Turbo variants depending on year, and those have different
   * OEM ecosystems.
   */
  engineIds: string[];
};

export type VehicleEngine = {
  id: string;
  label: string;
  type: EngineType;
  /** Displacement in litres (e.g. 1.5). Optional for EV / hybrid. */
  displacement?: number;
  transmissions: TransmissionType[];
  /**
   * Scope key the parts-search backend uses to filter the OEM
   * catalogue. The shape is intentionally opaque to the client —
   * backend decides what each scope key resolves to (a part-family
   * subset, a supplier override list, etc.). Frontend just forwards.
   */
  oemCatalogScope?: string;
};

/**
 * Vehicle-fitment specification — the FULL chain (brand → engine) the
 * user picked. Passed around as a single value object; nullable fields
 * mean "user didn't disambiguate yet" and the parts-search will
 * widen its scope accordingly.
 */
export type VehicleFitment = {
  brandId: string;
  modelId: string;
  generationId?: string;
  trimId?: string;
  engineId?: string;
};

// ── Brands ───────────────────────────────────────────────────────────

export const UZ_BRANDS: VehicleBrand[] = [
  { id: 'chevrolet', label: 'Chevrolet', tier: 'uz_top', manufacturer: 'UzAuto Motors' },
  { id: 'byd', label: 'BYD', tier: 'uz_top', manufacturer: 'BYD Uzbekistan' },
  { id: 'kia', label: 'Kia', tier: 'uz_top' },
  { id: 'chery', label: 'Chery', tier: 'uz_top' },
  { id: 'hyundai', label: 'Hyundai', tier: 'uz_top' },
  { id: 'lada', label: 'Lada', tier: 'uz_top', manufacturer: 'AvtoVAZ' },
  { id: 'toyota', label: 'Toyota', tier: 'uz_mid' },
  { id: 'haval', label: 'Haval', tier: 'uz_mid' },
  { id: 'nissan', label: 'Nissan', tier: 'global' },
];

/** Brand accent color per brand id — used for tile borders / monogram tiles
 *  on Explore's "Shop by vehicle" row and the Make screen. Theme-independent
 *  brand identity (kept here, out of the token-linted component tree). */
const BRAND_COLORS: Record<string, string> = {
  chevrolet: '#CD9834',
  daewoo: '#1C6BBA',
  byd: '#C3002F',
  kia: '#BB162B',
  chery: '#D7263D',
  hyundai: '#002C5E',
  lada: '#1F6FB2',
  toyota: '#EB0A1E',
  haval: '#B01E28',
  nissan: '#C3002F',
  skoda: '#4BA82E',
  volkswagen: '#151F5D',
};

export function brandColor(brandId: string): string {
  return BRAND_COLORS[brandId] ?? '#3949ab';
}

// ── Models ───────────────────────────────────────────────────────────

export const UZ_MODELS: VehicleModel[] = [
  // Chevrolet — the UZ workhorse line-up
  { id: 'cobalt', brandId: 'chevrolet', label: 'Cobalt', bodyStyle: 'sedan', order: 1 },
  { id: 'malibu', brandId: 'chevrolet', label: 'Malibu', bodyStyle: 'sedan', order: 2 },
  { id: 'nexia', brandId: 'chevrolet', label: 'Nexia', bodyStyle: 'sedan', order: 3 },
  { id: 'lacetti', brandId: 'chevrolet', label: 'Lacetti', bodyStyle: 'sedan', order: 4 },
  { id: 'gentra', brandId: 'chevrolet', label: 'Gentra', bodyStyle: 'sedan', order: 5 },
  { id: 'spark', brandId: 'chevrolet', label: 'Spark', bodyStyle: 'hatchback', order: 6 },
  { id: 'tracker', brandId: 'chevrolet', label: 'Tracker', bodyStyle: 'suv', order: 7 },
  { id: 'captiva', brandId: 'chevrolet', label: 'Captiva', bodyStyle: 'suv', order: 8 },
  { id: 'onix', brandId: 'chevrolet', label: 'Onix', bodyStyle: 'sedan', order: 9 },
  { id: 'damas', brandId: 'chevrolet', label: 'Damas', bodyStyle: 'minivan', order: 10 },
  // Daewoo
  { id: 'matiz', brandId: 'daewoo', label: 'Matiz', bodyStyle: 'hatchback' },
  { id: 'tico', brandId: 'daewoo', label: 'Tico', bodyStyle: 'hatchback' },
  // BYD
  { id: 'byd-chazor', brandId: 'byd', label: 'Chazor', bodyStyle: 'suv' },
  { id: 'byd-song-plus', brandId: 'byd', label: 'Song Plus', bodyStyle: 'suv' },
  { id: 'byd-han', brandId: 'byd', label: 'Han', bodyStyle: 'sedan' },
  // Kia
  { id: 'kia-k5', brandId: 'kia', label: 'K5', bodyStyle: 'sedan' },
  { id: 'kia-sportage', brandId: 'kia', label: 'Sportage', bodyStyle: 'suv' },
  { id: 'kia-rio', brandId: 'kia', label: 'Rio', bodyStyle: 'sedan' },
  // Chery
  { id: 'chery-tiggo-7-pro', brandId: 'chery', label: 'Tiggo 7 Pro', bodyStyle: 'suv' },
  { id: 'chery-tiggo-8-pro', brandId: 'chery', label: 'Tiggo 8 Pro', bodyStyle: 'suv' },
  // Hyundai
  { id: 'hyundai-sonata', brandId: 'hyundai', label: 'Sonata', bodyStyle: 'sedan' },
  { id: 'hyundai-tucson', brandId: 'hyundai', label: 'Tucson', bodyStyle: 'suv' },
  { id: 'hyundai-creta', brandId: 'hyundai', label: 'Creta', bodyStyle: 'suv' },
  // Lada
  { id: 'lada-niva', brandId: 'lada', label: 'Niva', bodyStyle: 'suv' },
  { id: 'lada-granta', brandId: 'lada', label: 'Granta', bodyStyle: 'sedan' },
];

// ── Engines ──────────────────────────────────────────────────────────

export const UZ_ENGINES: VehicleEngine[] = [
  // GM family used across Cobalt / Nexia / Spark / Tracker
  {
    id: 'b15d2-na',
    label: '1.5L On-Turbo (B15D2)',
    type: 'na',
    displacement: 1.5,
    transmissions: ['manual', 'automatic'],
    oemCatalogScope: 'gm-uz-b15d2-na',
  },
  {
    id: 'b15d2-turbo',
    label: '1.5L Turbo (B15D2)',
    type: 'turbo',
    displacement: 1.5,
    transmissions: ['cvt', 'automatic'],
    oemCatalogScope: 'gm-uz-b15d2-turbo',
  },
  {
    id: 'b12d2',
    label: '1.2L (B12D2)',
    type: 'na',
    displacement: 1.2,
    transmissions: ['manual', 'automatic'],
    oemCatalogScope: 'gm-uz-b12d2',
  },
  {
    id: 'lcv-1-3',
    label: '1.3L LCV',
    type: 'na',
    displacement: 1.3,
    transmissions: ['manual'],
    oemCatalogScope: 'gm-uz-lcv',
  },
  // Malibu family
  {
    id: 'malibu-1-5t',
    label: '1.5L Turbo (LFV)',
    type: 'turbo',
    displacement: 1.5,
    transmissions: ['automatic'],
    oemCatalogScope: 'gm-malibu-lfv',
  },
  {
    id: 'malibu-2-0t',
    label: '2.0L Turbo (LTG)',
    type: 'turbo',
    displacement: 2.0,
    transmissions: ['automatic'],
    oemCatalogScope: 'gm-malibu-ltg',
  },
  // Lacetti
  {
    id: 'lacetti-1-6',
    label: '1.6L (F16D3)',
    type: 'na',
    displacement: 1.6,
    transmissions: ['manual', 'automatic'],
    oemCatalogScope: 'gm-lacetti-f16d3',
  },
  // BYD EV/PHEV
  {
    id: 'byd-blade-ev',
    label: 'Blade Battery EV',
    type: 'ev',
    transmissions: ['automatic'],
    oemCatalogScope: 'byd-blade-ev',
  },
  {
    id: 'byd-dmi',
    label: 'DM-i PHEV',
    type: 'phev',
    displacement: 1.5,
    transmissions: ['cvt'],
    oemCatalogScope: 'byd-dmi',
  },
];

// ── Generations ──────────────────────────────────────────────────────

export const UZ_GENERATIONS: VehicleGeneration[] = [
  // Chevrolet Cobalt — UZ "Position" naming
  { id: 'cobalt-p1', modelId: 'cobalt', label: 'Position 1', yearRange: [2013, 2015], active: false },
  { id: 'cobalt-p2', modelId: 'cobalt', label: 'Position 2', yearRange: [2016, 2018], active: false },
  { id: 'cobalt-p3', modelId: 'cobalt', label: 'Position 3', yearRange: [2019, 2021], active: false },
  { id: 'cobalt-p4', modelId: 'cobalt', label: 'Position 4', yearRange: [2022, 2099], active: true },

  // Chevrolet Malibu
  { id: 'malibu-1', modelId: 'malibu', label: 'Malibu 1', yearRange: [2012, 2015], active: false },
  {
    id: 'malibu-2',
    modelId: 'malibu',
    label: 'Malibu 2',
    yearRange: [2016, 2099],
    internalCode: 'XL',
    active: true,
  },

  // Chevrolet Nexia
  { id: 'nexia-2', modelId: 'nexia', label: 'Nexia 2', yearRange: [2008, 2016], active: false },
  { id: 'nexia-3', modelId: 'nexia', label: 'Nexia 3', yearRange: [2017, 2099], active: true },

  // Chevrolet Lacetti — single generation in UZ before Gentra replaced it
  { id: 'lacetti-1', modelId: 'lacetti', label: 'Lacetti', yearRange: [2004, 2013], active: false },

  // Chevrolet Gentra — successor to Lacetti, T250-based
  {
    id: 'gentra-1',
    modelId: 'gentra',
    label: 'Gentra',
    yearRange: [2013, 2099],
    internalCode: 'T250',
    active: true,
  },

  // Chevrolet Spark / Tracker / Captiva — single active generation each on UZ market today
  { id: 'spark-m400', modelId: 'spark', label: 'Spark M400', yearRange: [2015, 2099], active: true },
  { id: 'tracker-3', modelId: 'tracker', label: 'Tracker 3', yearRange: [2020, 2099], active: true },
  { id: 'captiva-5', modelId: 'captiva', label: 'Captiva 5', yearRange: [2018, 2099], active: true },
  { id: 'onix-1', modelId: 'onix', label: 'Onix', yearRange: [2020, 2099], active: true },
  { id: 'damas-2', modelId: 'damas', label: 'Damas 2', yearRange: [1996, 2099], active: true },

  // BYD
  { id: 'byd-chazor-1', modelId: 'byd-chazor', label: 'Chazor', yearRange: [2022, 2099], active: true },
  {
    id: 'byd-song-plus-1',
    modelId: 'byd-song-plus',
    label: 'Song Plus',
    yearRange: [2022, 2099],
    active: true,
  },
  { id: 'byd-han-1', modelId: 'byd-han', label: 'Han EV', yearRange: [2021, 2099], active: true },
];

// ── Trims ────────────────────────────────────────────────────────────
//
// `engineIds` is where the "Cobalt Premier Turbo vs Cobalt Premier
// On-Turbo" branching lives — same trim row, two engine options. The
// parts-search routes by (generationId, trimId, engineId) so the
// returned OEM scope is exact.

export const UZ_TRIMS: VehicleTrim[] = [
  // Cobalt P1 / P2 / P3 / P4 — Elegant, Premier, LTZ (post-facelift)
  { id: 'cobalt-p1-elegant', generationId: 'cobalt-p1', label: 'Elegant', engineIds: ['b15d2-na'] },
  { id: 'cobalt-p2-elegant', generationId: 'cobalt-p2', label: 'Elegant', engineIds: ['b15d2-na'] },
  {
    id: 'cobalt-p2-premier',
    generationId: 'cobalt-p2',
    label: 'Premier',
    engineIds: ['b15d2-na', 'b15d2-turbo'],
  },
  { id: 'cobalt-p3-elegant', generationId: 'cobalt-p3', label: 'Elegant', engineIds: ['b15d2-na'] },
  {
    id: 'cobalt-p3-premier',
    generationId: 'cobalt-p3',
    label: 'Premier',
    engineIds: ['b15d2-na', 'b15d2-turbo'],
  },
  { id: 'cobalt-p4-ls', generationId: 'cobalt-p4', label: 'LS', engineIds: ['b15d2-na'] },
  { id: 'cobalt-p4-ltz', generationId: 'cobalt-p4', label: 'LTZ', engineIds: ['b15d2-turbo'] },

  // Malibu 1 — single LT / LTZ split
  { id: 'malibu-1-lt', generationId: 'malibu-1', label: 'LT', engineIds: ['malibu-1-5t'] },
  { id: 'malibu-1-ltz', generationId: 'malibu-1', label: 'LTZ', engineIds: ['malibu-2-0t'] },
  // Malibu 2 — fully refreshed line-up
  { id: 'malibu-2-lt', generationId: 'malibu-2', label: 'LT', engineIds: ['malibu-1-5t'] },
  { id: 'malibu-2-premier', generationId: 'malibu-2', label: 'Premier', engineIds: ['malibu-2-0t'] },

  // Nexia 2 — base / dlx
  { id: 'nexia-2-base', generationId: 'nexia-2', label: 'Base', engineIds: ['b15d2-na'] },
  { id: 'nexia-2-dlx', generationId: 'nexia-2', label: 'DLX', engineIds: ['b15d2-na'] },
  // Nexia 3 — LS / LT
  { id: 'nexia-3-ls', generationId: 'nexia-3', label: 'LS', engineIds: ['b15d2-na'] },
  { id: 'nexia-3-lt', generationId: 'nexia-3', label: 'LT', engineIds: ['b15d2-na'] },

  // Lacetti — single SX trim that dominated UZ sales
  { id: 'lacetti-sx', generationId: 'lacetti-1', label: 'SX', engineIds: ['lacetti-1-6'] },
  // Gentra
  { id: 'gentra-base', generationId: 'gentra-1', label: 'Base', engineIds: ['lacetti-1-6'] },
  { id: 'gentra-elegant', generationId: 'gentra-1', label: 'Elegant', engineIds: ['lacetti-1-6'] },

  // Spark / Tracker / Captiva / Onix / Damas — single trim entries to
  // keep the schema honest (UI can hide trim selection when there's
  // only one).
  { id: 'spark-m400-ls', generationId: 'spark-m400', label: 'LS', engineIds: ['b12d2'] },
  { id: 'tracker-3-premier', generationId: 'tracker-3', label: 'Premier', engineIds: ['b15d2-turbo'] },
  { id: 'captiva-5-premier', generationId: 'captiva-5', label: 'Premier', engineIds: ['b15d2-turbo'] },
  { id: 'onix-1-premier', generationId: 'onix-1', label: 'Premier', engineIds: ['b15d2-turbo'] },
  { id: 'damas-2-base', generationId: 'damas-2', label: 'Base', engineIds: ['lcv-1-3'] },

  // BYD
  { id: 'byd-chazor-pro', generationId: 'byd-chazor-1', label: 'Pro', engineIds: ['byd-dmi'] },
  {
    id: 'byd-song-plus-flagship',
    generationId: 'byd-song-plus-1',
    label: 'Flagship',
    engineIds: ['byd-dmi'],
  },
  { id: 'byd-han-ev', generationId: 'byd-han-1', label: 'EV', engineIds: ['byd-blade-ev'] },
];

// ── Lookups ──────────────────────────────────────────────────────────

const BRAND_INDEX = new Map(UZ_BRANDS.map((b) => [b.id, b]));
const MODEL_INDEX = new Map(UZ_MODELS.map((m) => [m.id, m]));
const GENERATION_INDEX = new Map(UZ_GENERATIONS.map((g) => [g.id, g]));
const TRIM_INDEX = new Map(UZ_TRIMS.map((t) => [t.id, t]));
const ENGINE_INDEX = new Map(UZ_ENGINES.map((e) => [e.id, e]));

export function getBrand(id: string): VehicleBrand | undefined {
  return BRAND_INDEX.get(id);
}

export function getModel(id: string): VehicleModel | undefined {
  return MODEL_INDEX.get(id);
}

export function getGeneration(id: string): VehicleGeneration | undefined {
  return GENERATION_INDEX.get(id);
}

export function getTrim(id: string): VehicleTrim | undefined {
  return TRIM_INDEX.get(id);
}

export function getEngine(id: string): VehicleEngine | undefined {
  return ENGINE_INDEX.get(id);
}

export function getModelsForBrand(brandId: string): VehicleModel[] {
  return UZ_MODELS.filter((m) => m.brandId === brandId).sort(
    (a, b) => (a.order ?? 9999) - (b.order ?? 9999) || a.label.localeCompare(b.label),
  );
}

export function getGenerationsForModel(modelId: string): VehicleGeneration[] {
  return UZ_GENERATIONS.filter((g) => g.modelId === modelId).sort(
    (a, b) => b.yearRange[0] - a.yearRange[0],
  );
}

export function getTrimsForGeneration(generationId: string): VehicleTrim[] {
  return UZ_TRIMS.filter((t) => t.generationId === generationId);
}

export function getEnginesForTrim(trimId: string): VehicleEngine[] {
  const trim = TRIM_INDEX.get(trimId);
  if (!trim) return [];
  return trim.engineIds
    .map((id) => ENGINE_INDEX.get(id))
    .filter((e): e is VehicleEngine => e !== undefined);
}

/**
 * Resolve a free-text `make` + `model` pair (the existing typed-input
 * UI) to fitment ids. Used by the migration path while the wizard
 * still ships free-text fields — once we add pickers, callers can pass
 * ids directly and skip the resolver.
 */
export function resolveFitmentFromText(
  make: string,
  model: string,
): { brandId?: string; modelId?: string } {
  const m = make.trim().toLowerCase();
  const md = model.trim().toLowerCase();
  const brand = UZ_BRANDS.find((b) => b.label.toLowerCase() === m);
  if (!brand) return {};
  const matched = UZ_MODELS.find(
    (mm) => mm.brandId === brand.id && mm.label.toLowerCase() === md,
  );
  return { brandId: brand.id, modelId: matched?.id };
}

/**
 * Build the parts-search vehicle-context payload from a fitment. This
 * is the exact shape the search backend expects on the request — see
 * `types/search.ts:SearchVehicleContext`. Fields are omitted (not
 * nulled) when the user hasn't disambiguated to that depth yet, so the
 * search server widens scope correctly.
 */
export function buildSearchVehicleContext(fitment: VehicleFitment): {
  brand: string;
  model: string;
  vehicle_generation?: string;
  engine_type?: string;
  oem_catalog_scope?: string;
} {
  const brand = getBrand(fitment.brandId);
  const model = getModel(fitment.modelId);
  const generation = fitment.generationId ? getGeneration(fitment.generationId) : undefined;
  const engine = fitment.engineId ? getEngine(fitment.engineId) : undefined;
  return {
    brand: brand?.label ?? fitment.brandId,
    model: model?.label ?? fitment.modelId,
    vehicle_generation: generation?.label,
    engine_type: engine?.label,
    oem_catalog_scope: engine?.oemCatalogScope,
  };
}
