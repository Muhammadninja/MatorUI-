import {
  CHEVROLET_IMAGE_MANIFEST,
  type BodyType,
  type PlaceholderReason,
  type VehicleBody,
  type VehicleImageManifest,
  type VehicleImageSource,
  type VerifiedYearRange,
} from './manifest';
import { plainMakeId, plainModelId } from './catalog-id';
import { BASE_PAINT, PAINT_KEYS, paintForHex, type PaintKey } from './paint';

/** The vehicle fields image resolution may read: backend ids, year and the
 *  stored colour. Nothing else, so business logic can't leak in. */
export type VehicleImageInput = {
  brandId?: string | null;
  modelId?: string | null;
  trimId?: string | null;
  year?: number | null;
  colorHex?: string | null;
};

export type VehicleImageResolution =
  | {
      kind: 'image';
      bodyKey: string;
      bodyType: BodyType;
      paint: PaintKey;
      /** False when the stored colour had no approved image and white is shown. */
      paintMatched: boolean;
      source: VehicleImageSource;
    }
  | {
      kind: 'placeholder';
      reason: PlaceholderReason;
      /** Present when the body is known, so the placeholder can use its silhouette. */
      bodyType?: BodyType;
    };

const placeholder = (reason: PlaceholderReason, bodyType?: BodyType): VehicleImageResolution =>
  bodyType ? { kind: 'placeholder', reason, bodyType } : { kind: 'placeholder', reason };

/** Backend models pointing at each body, for the shared-body rule. */
function bodyReferences(manifest: VehicleImageManifest): Map<string, Set<string>> {
  const refs = new Map<string, Set<string>>();
  const add = (bodyKey: string, modelId: string) => {
    if (!refs.has(bodyKey)) refs.set(bodyKey, new Set());
    refs.get(bodyKey)!.add(modelId);
  };
  for (const [modelId, rule] of Object.entries(manifest.models)) {
    if (rule.kind === 'body') add(rule.bodyKey, modelId);
    if (rule.kind === 'trim-prefix') {
      Object.values(rule.prefixes).forEach((target) =>
        typeof target === 'string' ? add(target, modelId) : target.forEach((r) => add(r.bodyKey, modelId)),
      );
      rule.years?.forEach((range) => add(range.bodyKey, modelId));
    }
  }
  return refs;
}

/** A model may use a body it shares with other models only when it is named in
 *  `sharedBy` (a verified match) or is the one model not listed there. */
function mayUseBody(body: VehicleBody, modelId: string, refs: Map<string, Set<string>>): boolean {
  const users = refs.get(body.key) ?? new Set<string>();
  if (users.size <= 1) return true;
  const shared = new Set(body.sharedBy ?? []);
  if (shared.has(modelId)) return true;
  const owners = [...users].filter((id) => !shared.has(id));
  return owners.length === 1 && owners[0] === modelId;
}

function bodyKeyFor(
  manifest: VehicleImageManifest,
  input: VehicleImageInput,
): { bodyKey: string } | { reason: PlaceholderReason } {
  const rule = manifest.models[input.modelId ?? ''];
  if (!rule) return { reason: 'unknown-model' };
  if (rule.kind === 'placeholder') return { reason: rule.reason };
  if (rule.kind === 'body') return { bodyKey: rule.bodyKey };

  // The trim id must belong to this model's generation, by exact prefix.
  const trimId = input.trimId ?? '';
  const prefixMatches = Object.entries(rule.prefixes).filter(([prefix]) => trimId.startsWith(prefix));
  if (prefixMatches.length > 1) return { reason: 'generation-unverified' };
  if (prefixMatches.length === 1) {
    const target = prefixMatches[0][1];
    // A generation with a mid-cycle facelift: the year picks the exterior.
    return typeof target === 'string' ? { bodyKey: target } : byYear(target, input.year);
  }

  // No (or another) trim: a year decides only within a verified range.
  return byYear(rule.years ?? [], input.year);
}

/** The one verified, sourced range containing `year`; anything else (no year,
 *  no range, a year two ranges claim, a year between ranges) is unresolved. */
function byYear(
  ranges: VerifiedYearRange[],
  year: number | null | undefined,
): { bodyKey: string } | { reason: PlaceholderReason } {
  if (typeof year !== 'number') return { reason: 'generation-unverified' };
  const hits = ranges.filter((r) => r.source.trim() && year >= r.from && year <= r.to);
  return hits.length === 1 ? { bodyKey: hits[0].bodyKey } : { reason: 'generation-unverified' };
}

/**
 * The image a Garage vehicle shows, or why it shows the neutral placeholder.
 * Strict: exact backend ids only, no name matching, no fallback to another
 * model's image. Colour is optional; without an approved image in the stored
 * paint, the body's white image is shown.
 */
export function resolveVehicleImage(
  input: VehicleImageInput,
  manifest: VehicleImageManifest = CHEVROLET_IMAGE_MANIFEST,
): VehicleImageResolution {
  const brandId = plainMakeId(input.brandId);
  if (!brandId || brandId !== manifest.makeId) return placeholder('unsupported-make');
  input = { ...input, brandId, modelId: plainModelId(input.modelId, input.brandId) };

  const target = bodyKeyFor(manifest, input);
  if ('reason' in target) return placeholder(target.reason);

  const body = manifest.bodies.find((b) => b.key === target.bodyKey);
  if (!body) return placeholder('asset-missing');
  if (!body.verified) return placeholder('body-unverified', body.bodyType);
  if (!mayUseBody(body, input.modelId!, bodyReferences(manifest))) {
    return placeholder('shared-body-unverified', body.bodyType);
  }

  const wanted = paintForHex(input.colorHex);
  if (wanted && body.assets[wanted] !== undefined) {
    return { kind: 'image', bodyKey: body.key, bodyType: body.bodyType, paint: wanted, paintMatched: true, source: body.assets[wanted]! };
  }
  const base = body.assets[BASE_PAINT];
  if (base !== undefined) {
    return {
      kind: 'image',
      bodyKey: body.key,
      bodyType: body.bodyType,
      paint: BASE_PAINT,
      paintMatched: wanted === BASE_PAINT,
      source: base,
    };
  }
  return placeholder('asset-missing', body.bodyType);
}

const BODY_KEY = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Integrity problems in a manifest, one message each. Empty = valid. */
export function validateManifest(manifest: VehicleImageManifest): string[] {
  const problems: string[] = [];
  const keys = new Set<string>();
  for (const body of manifest.bodies) {
    if (!BODY_KEY.test(body.key)) problems.push(`body key "${body.key}" is not lowercase kebab-case`);
    if (keys.has(body.key)) problems.push(`body "${body.key}" is listed twice`);
    keys.add(body.key);
    const paints = Object.keys(body.assets);
    if (paints.length && !body.verified) problems.push(`body "${body.key}" has assets but is unverified`);
    if (paints.length && body.assets[BASE_PAINT] === undefined) {
      problems.push(`body "${body.key}" has colour images but no ${BASE_PAINT} base`);
    }
    for (const paint of paints) {
      if (!(PAINT_KEYS as readonly string[]).includes(paint)) problems.push(`body "${body.key}" has unknown paint "${paint}"`);
    }
  }
  const refs = bodyReferences(manifest);
  for (const [bodyKey, users] of refs) {
    if (!keys.has(bodyKey)) problems.push(`body "${bodyKey}" is referenced but not defined`);
    const body = manifest.bodies.find((b) => b.key === bodyKey);
    const shared = new Set(body?.sharedBy ?? []);
    const owners = [...users].filter((id) => !shared.has(id));
    if (users.size > 1 && owners.length !== 1) {
      problems.push(`body "${bodyKey}" is used by ${[...users].join(', ')} without a verified sharedBy`);
    }
  }
  for (const body of manifest.bodies) {
    for (const id of body.sharedBy ?? []) {
      if (!manifest.models[id]) problems.push(`body "${body.key}" is shared with unknown model "${id}"`);
    }
  }
  return problems;
}
