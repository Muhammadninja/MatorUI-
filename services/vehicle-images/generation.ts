/**
 * A Garage vehicle's generation as the backend reports it: the `generation` field
 * of `GET/POST/PATCH /v1/garage/vehicles[/:id]`. Present only for a generic catalog
 * model with generation-specific rows (Chevrolet `nexia` → `nexia-1/2/3`), and null
 * once a trim was picked (the trim is the more precise answer).
 *
 *   resolved         `model` is the generation's catalog row: by `year`, or the
 *                    owner's pick (`owner`, with the `options` it was picked from)
 *   choice_required  the year belongs to more than one generation: `options`
 *   unresolved       the year matches none; nothing is inferred
 *
 * The backend decides all of this. The app shows it, and sends back one of the
 * offered option ids (PATCH `variant_model_id`). It changes the picture only:
 * fitment keeps using the vehicle's own model.
 */
export type VehicleGenerationOption = {
  id: string;
  name: string;
  yearFrom: number | null;
  yearTo: number | null;
};

export type VehicleGeneration = {
  status: 'resolved' | 'choice_required' | 'unresolved';
  source: 'year' | 'owner' | null;
  model: { id: string; name: string } | null;
  options: VehicleGenerationOption[];
};

const STATUSES: readonly string[] = ['resolved', 'choice_required', 'unresolved'];

const text = (value: unknown): value is string => typeof value === 'string' && value.trim() !== '';
const year = (value: unknown): number | null => (Number.isInteger(value) ? (value as number) : null);

function parseOption(raw: unknown): VehicleGenerationOption | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!text(r.id) || !text(r.name)) return null;
  return { id: r.id, name: r.name, yearFrom: year(r.year_from), yearTo: year(r.year_to) };
}

/**
 * Validate the backend's `generation`. Missing or malformed → undefined (older
 * backend: the vehicle keeps its existing picture rules). A `resolved` answer
 * without a usable model, or a choice with fewer than two options, is dropped
 * rather than half-shown.
 */
export function parseVehicleGeneration(raw: unknown): VehicleGeneration | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  if (typeof r.status !== 'string' || !STATUSES.includes(r.status)) return undefined;
  const options = Array.isArray(r.options)
    ? r.options.map(parseOption).filter((o): o is VehicleGenerationOption => o !== null)
    : [];
  const m = r.model as Record<string, unknown> | null | undefined;
  const model = m && text(m.id) && text(m.name) ? { id: m.id, name: m.name } : null;
  const source = r.source === 'year' || r.source === 'owner' ? r.source : null;

  if (r.status === 'resolved') {
    return model ? { status: 'resolved', source, model, options } : undefined;
  }
  if (r.status === 'choice_required') {
    return options.length >= 2 ? { status: 'choice_required', source: null, model: null, options } : undefined;
  }
  return { status: 'unresolved', source: null, model: null, options: [] };
}

/** The catalog model the picture is of: the resolved generation's row, else the
 *  vehicle's own model (which, for a generic model, resolves to the placeholder). */
export function pictureModelId(modelId: string | undefined, generation: VehicleGeneration | undefined) {
  return generation?.status === 'resolved' && generation.model ? generation.model.id : modelId;
}

/** "2008–2016", or the one year both ends share; empty when a bound is missing. */
export function optionYears(option: VehicleGenerationOption): string {
  const { yearFrom, yearTo } = option;
  if (yearFrom == null || yearTo == null) return '';
  return yearFrom === yearTo ? String(yearFrom) : `${yearFrom}–${yearTo}`;
}
