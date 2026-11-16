import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { artworkPath, hintCovers, validateCandidateHints } from './vehicle-image-registry.mjs';

/**
 * Image acquisition: where candidate images come from, in priority order.
 *
 *   1. approved registry image (reused by the pipeline before any job exists)
 *   2. an approved publication of the same subject (reused, no job)
 *   3. repository artwork (this module): artwork already in the repository that
 *      the registry links to the vehicle, proposed as a private candidate
 *   4. licensed catalog sources / authorized third-party image APIs: none is
 *      configured; a provider object with the same contract can be added
 *   5. paid generation (vehicle-image-provider.mjs), only when separately enabled
 *
 * Provider contract (`acquire`):
 *   input   { identity, vehicle, subjectKey, signal }
 *   output  list of { bytes, contentType, source } where `source` is
 *           { provider, kind, license, provenance, sourceRef, basis, confidence,
 *             catalogAssetId?, fingerprint }
 *   errors  thrown errors are recorded on the job; `retryable: true` marks a
 *           transient failure the job may retry with backoff
 *
 * Every candidate is private until the approval policy (below) or an
 * administrator publishes it.
 */

export const ARTWORK_PROVIDER_ID = 'repository-artwork';
const COMMERCIAL_IMAGE_LICENSES = new Set([
  'CC0-1.0', 'CC-BY-2.0', 'CC-BY-2.5', 'CC-BY-3.0', 'CC-BY-4.0',
  'CC-BY-SA-2.0', 'CC-BY-SA-2.5', 'CC-BY-SA-3.0', 'CC-BY-SA-4.0',
]);
const COMMERCIAL_LICENSE_URLS = new Map([
  ['CC0-1.0', 'https://creativecommons.org/publicdomain/zero/1.0/'],
  ...['2.0', '2.5', '3.0', '4.0'].flatMap((v) => [
    [`CC-BY-${v}`, `https://creativecommons.org/licenses/by/${v}/`],
    [`CC-BY-SA-${v}`, `https://creativecommons.org/licenses/by-sa/${v}/`],
  ]),
]);
export function hasPublishableRights(candidate) {
  const clean = (value, max) => typeof value === 'string' && value.trim().length > 0 &&
    value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
  return Boolean(candidate && candidate.provider === 'wikimedia-commons' &&
    COMMERCIAL_IMAGE_LICENSES.has(candidate.license) && candidate.licenseUrl === COMMERCIAL_LICENSE_URLS.get(candidate.license) &&
    typeof candidate.sourcePage === 'string' && /^https:\/\/commons\.wikimedia\.org\/wiki\//.test(candidate.sourcePage) &&
    typeof candidate.sourceUrl === 'string' && /^https:\/\/upload\.wikimedia\.org\//.test(candidate.sourceUrl) &&
    clean(candidate.author, 500) && clean(candidate.attribution, 1000) && clean(candidate.licenseEvidence, 1000));
}
const MAX_ARTWORK_BYTES = 8 * 1024 * 1024;
const MAX_ARTWORK_CANDIDATES = 3;

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function sniffContentType(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Registry entries whose artwork may show this identity, strongest basis first:
 *
 *   verified-mapping  an identity-verified entry covers the market-verified
 *                     identity, but its image is not approved yet
 *   hint              an unverified `candidateFor` hint covers the identity
 *
 * Entries marked `artworkQa: "rejected"` (known defects such as fake plate text)
 * and owner-rejected entries are never proposed.
 */
export function artworkEntriesFor(catalog, identity, { effectiveStatus, coversMapping }) {
  const found = [];
  for (const asset of catalog.assets) {
    if (asset.makeId !== identity.makeId) continue;
    if (asset.artworkQa === 'rejected' || effectiveStatus(asset) === 'rejected') continue;
    if (typeof asset.storageRef !== 'string') continue;
    if (identity.marketRegion) {
      if (effectiveStatus(asset) === 'approved') continue;
      const verified = asset.identityVerified && asset.marketRegion === identity.marketRegion &&
        (asset.modelMappings ?? []).some((mapping) => coversMapping(identity, mapping));
      if (verified) found.push({ asset, basis: 'verified-mapping', confidence: 'identity-verified' });
      continue;
    }
    if (identity.identityStatus !== 'unverified') continue;
    if (validateCandidateHints(asset).some((hint) => hintCovers(hint, identity)))
      found.push({ asset, basis: 'hint', confidence: 'unverified-hint' });
  }
  return found.slice(0, MAX_ARTWORK_CANDIDATES);
}

/** Repository artwork provider: free, local, never published without review. */
export function createRepositoryArtworkProvider({ rootDir }) {
  if (!rootDir) throw new Error('repository artwork provider needs a root directory');
  const cache = new Map();
  return {
    id: ARTWORK_PROVIDER_ID,
    kind: 'catalog',
    cost: 'free',
    license: 'owner-supplied',
    autoPublish: false,
    /** Read one registry entry's artwork, verified as PNG/WebP and size-bounded. */
    async read(asset) {
      const file = artworkPath(rootDir, asset.storageRef);
      if (!file) throw Object.assign(new Error('artwork path is outside the artwork directories'), { retryable: false });
      if (cache.has(file)) return cache.get(file);
      const info = await stat(file);
      if (!info.isFile() || info.size === 0 || info.size > MAX_ARTWORK_BYTES)
        throw Object.assign(new Error('artwork file is missing or too large'), { retryable: false });
      const bytes = await readFile(file);
      const contentType = sniffContentType(bytes);
      if (!contentType) throw Object.assign(new Error('artwork is not PNG or WebP'), { retryable: false });
      const result = { bytes, contentType, fingerprint: sha256Hex(bytes) };
      cache.set(file, result);
      return result;
    },
    /** Fingerprint without keeping a failed read around. */
    async fingerprint(asset) {
      try {
        return (await this.read(asset)).fingerprint;
      } catch {
        return null;
      }
    },
  };
}

/**
 * Publication policy. A candidate is published without a person only when every
 * independent requirement holds:
 *
 *   identity  the identity is market- and generation-verified by the registry
 *   rights    the provider's licence permits publication without review
 *   provider  the provider is configured for automatic publication
 *   quality   every technical check passed
 *   switch    publication is enabled at all
 *
 * No provider configured today has `autoPublish`, so every candidate goes to
 * review. The reasons are recorded on the candidate.
 */
export const PUBLISHABLE_LICENSES = new Set(['licensed-for-publication', 'mator-owned']);

export function publicationDecision({ identityVerified, provider, quality, publicationEnabled }) {
  const reasons = [];
  if (!publicationEnabled) reasons.push('publication-disabled');
  if (!identityVerified) reasons.push('identity-unverified');
  if (!provider?.autoPublish) reasons.push('provider-requires-review');
  if (!PUBLISHABLE_LICENSES.has(provider?.license)) reasons.push('licence-requires-review');
  // Explicit failures only; informational checks (framing, identity) never pass by themselves.
  const failed = Object.values(quality ?? {}).filter((value) => ['fail', 'flagged', 'low'].includes(value));
  if (!quality || quality.integrity !== 'pass' || failed.length) reasons.push('quality-requires-review');
  return { autoPublish: reasons.length === 0, reasons };
}
