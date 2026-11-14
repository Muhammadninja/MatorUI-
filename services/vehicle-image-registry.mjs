import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The vehicle image registry (`vehicle-image-catalog.json`) as the pipeline reads
 * it, plus its fingerprint.
 *
 * The Mator backend vendors the same file byte for byte and pins its SHA-256. The
 * pipeline reports the SHA-256 of the bytes it loaded in `/health/ready` and in
 * every internal response, and the backend refuses to apply an answer computed
 * from a different registry. Neither side can silently run another version.
 *
 * Two kinds of mapping live in the registry:
 *
 *   modelMappings   verified identity facts (market, generation, years). Only
 *                   entries with `identityVerified` use them, and only they can
 *                   make an image reusable without review.
 *   candidateFor    unverified hints: "this artwork may show model X". They only
 *                   propose the artwork as a PRIVATE candidate for human review.
 *                   They never verify an identity, never pick a market and never
 *                   publish anything by themselves.
 */
export const REGISTRY_FILE = fileURLToPath(new URL('./vehicle-image-catalog.json', import.meta.url));

export function registryFingerprint(source) {
  return createHash('sha256').update(source).digest('hex');
}

/** Read the registry file once: parsed catalog plus the SHA-256 of its exact bytes. */
export function loadRegistryFile(file = REGISTRY_FILE) {
  const bytes = readFileSync(file);
  const catalog = JSON.parse(bytes.toString('utf8'));
  return { catalog, sha256: registryFingerprint(bytes), version: catalog.version ?? null };
}

/** Fingerprint for an injected catalog object (tests, tools): stable JSON text. */
export function catalogObjectFingerprint(catalog) {
  return registryFingerprint(Buffer.from(JSON.stringify(catalog)));
}

const HINT_FIELDS = new Set(['modelId', 'yearFrom', 'yearTo', 'trimPrefixes', 'note']);

/** Validate the optional unverified hints of one entry; a malformed registry fails loudly. */
export function validateCandidateHints(asset) {
  const hints = asset.candidateFor;
  if (hints === undefined) return [];
  if (!Array.isArray(hints)) throw new Error(`registry entry ${asset.id}: candidateFor must be a list`);
  return hints.map((hint, index) => {
    const where = `registry entry ${asset.id} candidateFor[${index}]`;
    if (!hint || typeof hint !== 'object' || Array.isArray(hint)) throw new Error(`${where} is not an object`);
    if (Object.keys(hint).some((key) => !HINT_FIELDS.has(key))) throw new Error(`${where} has unsupported fields`);
    if (typeof hint.modelId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(hint.modelId))
      throw new Error(`${where} modelId`);
    for (const key of ['yearFrom', 'yearTo']) {
      if (hint[key] !== undefined && (!Number.isInteger(hint[key]) || hint[key] < 1886 || hint[key] > 2200))
        throw new Error(`${where} ${key}`);
    }
    if (hint.yearFrom !== undefined && hint.yearTo !== undefined && hint.yearFrom > hint.yearTo)
      throw new Error(`${where} year range`);
    if (hint.trimPrefixes !== undefined && (!Array.isArray(hint.trimPrefixes) || hint.trimPrefixes.length === 0 ||
      hint.trimPrefixes.some((prefix) => typeof prefix !== 'string' || !prefix)))
      throw new Error(`${where} trimPrefixes`);
    return hint;
  });
}

/** Whether an unverified hint covers an identity: same model, year inside any stated bounds, trim prefix when stated. */
export function hintCovers(hint, identity) {
  if (hint.modelId !== identity.modelId) return false;
  if (hint.yearFrom !== undefined && identity.modelYear < hint.yearFrom) return false;
  if (hint.yearTo !== undefined && identity.modelYear > hint.yearTo) return false;
  if (hint.trimPrefixes?.length)
    return hint.trimPrefixes.some((prefix) => identity.trimId?.startsWith(prefix) ?? false);
  return true;
}

/** Artwork stored in the repository may only be read from these directories. */
const ARTWORK_ROOTS = ['assets/vehicles/', 'assets/cars-2d/'];

/** A registry `storageRef` as a safe path below `rootDir`, or null. */
export function artworkPath(rootDir, storageRef) {
  if (typeof storageRef !== 'string' || !ARTWORK_ROOTS.some((root) => storageRef.startsWith(root))) return null;
  if (storageRef.includes('\0') || storageRef.split('/').some((part) => part === '..' || part === '')) return null;
  const root = path.resolve(rootDir);
  const resolved = path.resolve(root, storageRef);
  return resolved.startsWith(`${root}${path.sep}`) ? resolved : null;
}
