/**
 * Garage records reach the app in two id schemes: the live reference catalog's
 * plain ids (`chevrolet`, `cobalt`), and the demo scheme used by the bundled
 * VIN catalog (`services/uz-vin-catalog.ts`) and the local mock server
 * (`make_chevrolet`, `model_cobalt`, `model_chevrolet_cobalt`). Both name the
 * same catalog row, so image and logo lookups compare plain ids.
 *
 * Only those exact shapes are recognised, with a single-word slug; anything
 * else is returned unchanged, so an unfamiliar id stays unmatched instead of
 * being guessed at.
 */
const DEMO_MAKE = /^make_([a-z0-9]+)$/;
const DEMO_MODEL = /^model_(?:([a-z0-9]+)_)?([a-z0-9]+)$/;

/** Demo slugs that name more than one live model: the live catalog has both
 *  `tracker` and `tracker-2`, and the demo `tracker` doesn't say which. */
const AMBIGUOUS_DEMO_MODELS = new Set(['tracker']);

export function plainMakeId(id: string | null | undefined): string {
  const make = (id ?? '').trim();
  return DEMO_MAKE.exec(make)?.[1] ?? make;
}

export function plainModelId(id: string | null | undefined, makeId: string | null | undefined): string {
  const model = (id ?? '').trim();
  const match = DEMO_MODEL.exec(model);
  if (!match) return model;
  const [, make, slug] = match;
  // `model_chevrolet_cobalt` must name the vehicle's own make.
  if (make && make !== plainMakeId(makeId)) return model;
  return AMBIGUOUS_DEMO_MODELS.has(slug) ? '' : slug;
}
