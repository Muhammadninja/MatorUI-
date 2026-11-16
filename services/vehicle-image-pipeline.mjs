import { createServer } from 'node:http';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { processFramedArtwork, processGeneratedImage, processSegmentedPhoto } from './vehicle-image-processing.mjs';
import { catalogObjectFingerprint, loadRegistryFile } from './vehicle-image-registry.mjs';
import { artworkEntriesFor, hasPublishableRights, publicationDecision, sha256Hex } from './vehicle-image-acquisition.mjs';

const REGISTRY = loadRegistryFile();
const VEHICLE_IMAGE_CATALOG = REGISTRY.catalog;

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ACTIVE_JOB_STATES = new Set(['queued', 'running', 'awaiting_approval']);
const ADMIN_ONLY_TERMINAL_JOB_STATES = new Set(['failed', 'rejected']);
const CANONICAL_IDENTITY_VERSION = 'mator-vehicle-image-v1';
const MARKET_IDENTITY_VERSION = 'mator-vehicle-image-v2';
/**
 * A catalog-valid identity whose market and generation the registry does not
 * verify. It may enter candidate acquisition, but nothing for it is published
 * without an administrator confirming the identity.
 */
const UNVERIFIED_IDENTITY_VERSION = 'mator-vehicle-image-unverified-v1';
/** Clients that send this contract version get the full status vocabulary. */
export const PIPELINE_CONTRACT_VERSION = 2;
/** Contract versions the internal routes answer; anything else is refused. */
export const SUPPORTED_CONTRACT_VERSIONS = Object.freeze([2]);
const CONTRACT_HEADER = 'x-mator-vehicle-image-contract';
const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * The contract version a request asks for, or an error code. Only a plain
 * decimal header naming a supported version passes; a missing, repeated,
 * malformed or unknown version is refused (HTTP 428, which the backend treats
 * as retryable, so an older or newer client never marks a vehicle as failed).
 */
export function requestedContract(headers) {
  const raw = headers?.[CONTRACT_HEADER];
  if (raw === undefined) return { error: 'contract_header_required' };
  if (typeof raw !== 'string' || !/^[0-9]{1,3}$/.test(raw.trim())) return { error: 'contract_header_invalid' };
  const version = Number(raw.trim());
  if (!SUPPORTED_CONTRACT_VERSIONS.includes(version)) return { error: 'contract_unsupported' };
  return { version };
}

/**
 * Compare the registry the pipeline loaded with the fingerprint the deployment
 * says the backend pins (VEHICLE_IMAGE_REGISTRY_SHA256).
 *
 *   undefined  no check requested (library use, unit tests): 'not_enforced'
 *   null / ''  the deployment did not configure it:          'unconfigured'
 *   not hex64  malformed configuration:                       'invalid'
 *   other sha  the deployment expects another registry:      'mismatch'
 *
 * Only 'ok' and 'not_enforced' let readiness say "ready".
 */
export function registryHandshake(loadedSha256, expected) {
  if (expected === undefined) return 'not_enforced';
  if (expected === null || expected === '') return 'unconfigured';
  if (typeof expected !== 'string' || !SHA256_HEX.test(expected.trim().toLowerCase())) return 'invalid';
  return expected.trim().toLowerCase() === loadedSha256 ? 'ok' : 'mismatch';
}
const TRANSPORT_DIAGNOSTIC_FIELDS = [
  'errorName',
  'errorCode',
  'errorErrno',
  'errorSyscall',
  'causeName',
  'causeCode',
  'causeErrno',
  'causeSyscall',
];

function sanitizeTransportDiagnostics(value) {
  if (!value || typeof value !== 'object') return undefined;
  const result = {};
  for (const field of TRANSPORT_DIAGNOSTIC_FIELDS) {
    const entry = value[field];
    if (field.endsWith('Errno')) {
      if (Number.isInteger(entry)) result[field] = entry;
    } else if (typeof entry === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(entry)) {
      result[field] = entry;
    }
  }
  return Object.keys(result).length ? result : undefined;
}

/** Who made an admin decision, as the backend admin proxy reports it. Display data only. */
export function sanitizeActor(actor) {
  if (!actor || typeof actor !== 'object' || Array.isArray(actor)) return null;
  const text = (value, max) =>
    typeof value === 'string' && value.trim() && !/[\u0000-\u001f\u007f]/.test(value) ? value.trim().slice(0, max) : null;
  const result = { id: text(actor.id, 64), email: text(actor.email, 255), name: text(actor.name, 120) };
  return result.id || result.email || result.name ? result : null;
}

/**
 * The reviewer's statement that the picture shows exactly this vehicle (make,
 * model, generation, body and market) with a reference to what they checked.
 * Required to publish anything for an unverified identity.
 */
export function validateConfirmation(input, required) {
  if (input == null) {
    if (required)
      throw Object.assign(new Error('identity confirmation is required for an unverified identity'), { status: 409 });
    return null;
  }
  if (typeof input !== 'object' || Array.isArray(input) || input.confirmed !== true)
    throw Object.assign(new Error('identityConfirmation.confirmed must be true'), { status: 400 });
  const reference = typeof input.reference === 'string' ? input.reference.trim() : '';
  if (reference.length < 4 || reference.length > 500 || /[\u0000-\u001f\u007f]/.test(reference))
    throw Object.assign(new Error('identityConfirmation.reference must say what was checked (4-500 characters)'), { status: 400 });
  return { confirmed: true, reference };
}

export function validateReason(input) {
  if (input == null || input === '') return null;
  if (typeof input !== 'string' || input.length > 500 || /[\u0000-\u0008\u000b-\u001f\u007f]/.test(input))
    throw Object.assign(new Error('reason must be text up to 500 characters'), { status: 400 });
  return input.trim() || null;
}

function normalize(value) {
  return String(value ?? '')
    .trim()
    .toLocaleLowerCase('en-US')
    .replace(/\s+/g, ' ');
}

export function vehicleIdentityKey(vehicle) {
  return [
    vehicle.manufacturer ?? vehicle.make,
    vehicle.model,
    vehicle.year,
    vehicle.generation ?? '',
    vehicle.facelift ?? '',
    vehicle.bodyStyle ?? '',
    vehicle.trim ?? '',
    vehicle.exteriorColor ?? '',
    vehicle.marketRegion ?? '',
  ]
    .map(normalize)
    .join('|');
}

function canonicalTextId(value, name, maxLength = 64) {
  if (typeof value !== 'string') throw new Error(`${name} must be text`);
  const normalized = value.trim();
  if (
    !normalized || normalized.length > maxLength ||
    /[\u0000-\u001f\u007f]/.test(normalized)
  ) throw new Error(`${name} is invalid`);
  return normalized;
}

function canonicalCatalogId(value, name) {
  const normalized = canonicalTextId(value, name);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(normalized))
    throw new Error(`${name} must be a canonical catalog ID`);
  return normalized;
}

function optionalCanonicalTextId(value, name, maxLength = 64) {
  if (value === null) return null;
  if (maxLength !== 64) return canonicalTextId(value, name, maxLength);
  return canonicalCatalogId(value, name);
}

export function validateCanonicalVehicleIdentity(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('canonical identity is required');
  const legacyFields = ['makeId', 'modelId', 'modelYear', 'generationId', 'faceliftId', 'bodyType', 'trimId'];
  const marketFields = [...legacyFields, 'marketRegion'];
  const unverifiedFields = [...legacyFields, 'identityStatus'];
  const hasMarket = Object.hasOwn(value, 'marketRegion');
  const unverified = Object.hasOwn(value, 'identityStatus');
  if (hasMarket && unverified)
    throw new Error('canonical identity cannot carry both a verified market and an unverified status');
  const requiredFields = hasMarket ? marketFields : unverified ? unverifiedFields : legacyFields;
  if (Object.keys(value).some((field) => !requiredFields.includes(field)))
    throw new Error('canonical identity contains unsupported fields');
  if (requiredFields.some((field) => !Object.hasOwn(value, field)))
    throw new Error('canonical identity must include every ordered identity field');
  if (!Number.isInteger(value.modelYear) || value.modelYear < 1886 || value.modelYear > 2200)
    throw new Error('modelYear must be a valid model year');
  const identity = {
    makeId: canonicalCatalogId(value.makeId, 'makeId'),
    modelId: canonicalCatalogId(value.modelId, 'modelId'),
    modelYear: value.modelYear,
    generationId: optionalCanonicalTextId(value.generationId, 'generationId'),
    faceliftId: optionalCanonicalTextId(value.faceliftId, 'faceliftId'),
    bodyType: value.bodyType === null ? null : canonicalTextId(value.bodyType, 'bodyType', 60),
    trimId: optionalCanonicalTextId(value.trimId, 'trimId'),
  };
  if (hasMarket) {
    if (typeof value.marketRegion !== 'string' || !/^[A-Z]{2}$/.test(value.marketRegion))
      throw new Error('marketRegion must be a two-letter uppercase region code');
    identity.marketRegion = value.marketRegion;
  }
  if (unverified) {
    if (value.identityStatus !== 'unverified') throw new Error('identityStatus must be unverified');
    identity.identityStatus = 'unverified';
  }
  return identity;
}

export function canonicalVehicleIdentityTuple(identity) {
  const value = validateCanonicalVehicleIdentity(identity);
  return [
    value.marketRegion
      ? MARKET_IDENTITY_VERSION
      : value.identityStatus
        ? UNVERIFIED_IDENTITY_VERSION
        : CANONICAL_IDENTITY_VERSION,
    value.makeId,
    value.modelId,
    value.modelYear,
    value.generationId,
    value.faceliftId,
    value.bodyType,
    value.trimId,
    ...(value.marketRegion ? [value.marketRegion] : []),
  ];
}

export function canonicalVehicleIdentityKey(identity) {
  return createHash('sha256')
    .update(JSON.stringify(canonicalVehicleIdentityTuple(identity)))
    .digest('hex');
}

function validateVehicle(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('vehicle is required');
  const manufacturer = String(value.manufacturer ?? value.make ?? '').trim();
  const model = String(value.model ?? '').trim();
  const year = Number(value.year);
  if (!manufacturer || !model || !Number.isInteger(year) || year < 1886 || year > 2200) {
    throw new Error('manufacturer, model and valid model year are required');
  }
  const optionalText = (key) => {
    if (value[key] == null || value[key] === '') return null;
    if (typeof value[key] !== 'string') throw new Error(`${key} must be text`);
    return value[key].trim() || null;
  };
  return {
    manufacturer,
    make: manufacturer,
    model,
    year,
    generation: optionalText('generation'),
    facelift: optionalText('facelift'),
    bodyStyle: optionalText('bodyStyle'),
    trim: optionalText('trim'),
    exteriorColor: optionalText('exteriorColor'),
  };
}

function validateCanonicalDisplay(value, identity) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('vehicle display facts are required');
  const allowedFields = ['manufacturer', 'model', 'generation', 'facelift', 'trim', 'marketRegion'];
  if (Object.keys(value).some((field) => !allowedFields.includes(field)))
    throw new Error('vehicle display contains unsupported fields');
  const manufacturer = canonicalTextId(value.manufacturer, 'vehicle.manufacturer', 120);
  const model = canonicalTextId(value.model, 'vehicle.model', 120);
  const optionalLabel = (field) => {
    if (value[field] == null) return null;
    return canonicalTextId(value[field], `vehicle.${field}`, 120);
  };
  const generation = optionalLabel('generation');
  const facelift = optionalLabel('facelift');
  const trim = optionalLabel('trim');
  const marketRegion = optionalLabel('marketRegion');
  for (const [id, label, field] of [
    [identity.generationId, generation, 'generation'],
    [identity.faceliftId, facelift, 'facelift'],
    [identity.trimId, trim, 'trim'],
    [identity.marketRegion ?? null, marketRegion, 'marketRegion'],
  ]) {
    if ((id === null) !== (label === null))
      throw new Error(`vehicle.${field} must be supplied only with its canonical ID`);
  }
  return {
    manufacturer,
    make: manufacturer,
    model,
    year: identity.modelYear,
    generation,
    facelift,
    bodyStyle: identity.bodyType,
    trim,
    marketRegion,
    exteriorColor: null,
  };
}

function defaultImageValidator(bytes) {
  return processGeneratedImage(bytes);
}

export function createVehicleImagePipeline({
  dataDir,
  adminToken,
  requestToken = null,
  provider = null,
  generationEnabled = false,
  publicationEnabled = false,
  publicationCandidateAllowlist = [],
  autoRun = false,
  imageValidator = defaultImageValidator,
  /** Validator for artwork already in the Garage framing (repository artwork, uploads). */
  framedImageValidator = processFramedArtwork,
  assetStore = null,
  maxAttempts = 3,
  jobTimeoutMs = 120_000,
  retryDelayMs = 250,
  maxProviderCallsPerDay = 25,
  catalog = VEHICLE_IMAGE_CATALOG,
  /** Free repository-artwork provider (vehicle-image-acquisition.mjs); null = off. */
  artworkProvider = null,
  /** Wikimedia or equivalent explicitly licensed photo source; always review-only. */
  photoProvider = null,
  /** Required to turn any licensed street photo into a private transparent cutout. */
  photoSegmenter = null,
  /** Paid generation for unverified identities stays off unless explicitly allowed. */
  allowUnverifiedGeneration = false,
  /**
   * The registry SHA-256 the backend pins (VEHICLE_IMAGE_REGISTRY_SHA256). The
   * server script always passes it (null when unset); undefined skips the check.
   */
  expectedRegistrySha256 = undefined,
} = {}) {
  if (!dataDir) throw new Error('dataDir is required');
  if (!adminToken || adminToken.length < 16)
    throw new Error('adminToken must be at least 16 characters');
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10)
    throw new Error('maxAttempts must be between 1 and 10');
  if (!Number.isInteger(maxProviderCallsPerDay) || maxProviderCallsPerDay < 1 || maxProviderCallsPerDay > 10_000)
    throw new Error('maxProviderCallsPerDay must be between 1 and 10000');
  if (!catalog || !Array.isArray(catalog.assets)) throw new Error('vehicle image catalog is invalid');
  const dbPath = path.join(dataDir, 'metadata.json');
  const privateDir = path.join(dataDir, 'private');
  const emptyDb = () => ({
    requests: [], candidates: [], published: [], jobs: [], identityLinks: [], catalogDecisions: {},
    providerCallLedger: {}, subjects: {}, scopes: [], rejectedFingerprints: {}, decisions: [], counters: {},
  });
  let db = emptyDb();
  let writeQueue = Promise.resolve();
  let workerPromise = null;
  let initialized = false;
  const generationAvailable = Boolean(provider && generationEnabled);
  let backgroundRemovalReady = false;
  const acquisitionAvailable = generationAvailable || Boolean(artworkProvider) || Boolean(photoProvider);
  const registry = {
    version: catalog.version ?? null,
    sha256: catalog === VEHICLE_IMAGE_CATALOG ? REGISTRY.sha256 : catalogObjectFingerprint(catalog),
  };
  const registryCheck = registryHandshake(registry.sha256, expectedRegistrySha256);
  const allowedPublicationCandidates = new Set(publicationCandidateAllowlist);
  const registryCompatible = registryCheck === 'ok' || registryCheck === 'not_enforced';
  const publishInProgress = new Set();
  const identityLinkInProgress = new Set();

  function count(name, by = 1) {
    db.counters[name] = (db.counters[name] ?? 0) + by;
  }

  async function initialize() {
    await mkdir(privateDir, { recursive: true, mode: 0o700 });
    try {
      db = JSON.parse(await readFile(dbPath, 'utf8'));
      db.jobs ??= [];
      db.identityLinks ??= [];
      db.catalogDecisions ??= {};
      db.providerCallLedger ??= {};
      db.subjects ??= {};
      db.scopes ??= [];
      db.rejectedFingerprints ??= {};
      db.decisions ??= [];
      db.counters ??= {};
      const remap = new Map();
      for (const request of db.requests) {
        request.vehicle = validateVehicle(request.vehicle);
        if (request.canonicalIdentity) {
          request.canonicalIdentity = validateCanonicalVehicleIdentity(request.canonicalIdentity);
          if (canonicalVehicleIdentityKey(request.canonicalIdentity) !== request.identityKey)
            throw new Error('persisted canonical identity key does not match its tuple');
          if (request.activeVersion) request.status = 'approved';
          continue;
        }
        const oldKey = request.identityKey;
        request.identityKey = vehicleIdentityKey(request.vehicle);
        remap.set(oldKey, request.identityKey);
        if (request.activeVersion) request.status = 'approved';
      }
      for (const item of db.published)
        item.identityKey = remap.get(item.identityKey) ?? item.identityKey;
      for (const link of db.identityLinks) {
        link.identity = validateCanonicalVehicleIdentity(link.identity);
        if (canonicalVehicleIdentityKey(link.identity) !== link.identityKey)
          throw new Error('persisted identity link key does not match its tuple');
        link.legacyIdentityKey = remap.get(link.legacyIdentityKey) ?? link.legacyIdentityKey;
      }
      for (const request of db.requests) {
        if (request.canonicalIdentity && !request.subjectKey) request.subjectKey = `identity:${request.identityKey}`;
      }
      for (const job of db.jobs) {
        if (job.status === 'running') {
          if (job.phase === 'artwork') {
            // Repository artwork is free, local and has no side effect: run it again.
            job.status = 'queued';
            delete job.phase;
          } else {
            // A paid provider may have completed a billable call: never repeat it automatically.
            job.status = 'failed';
            job.lastError = 'interrupted-provider-outcome-unknown';
            job.completedAt = new Date().toISOString();
          }
        }
        const request = db.requests.find((item) => item.id === job.requestId);
        if (job.status !== 'queued' || !request?.canonicalIdentity) continue;
        if (!identityAcquirable(request.canonicalIdentity)) {
          job.status = 'cancelled';
          job.completedAt = new Date().toISOString();
          request.identityReviewRequired = true;
          continue;
        }
        if (!acquisitionPlan(request).eligible) {
          job.status = 'cancelled';
          job.completedAt = new Date().toISOString();
          request.generationDisabled = true;
        }
      }
      await persist();
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await persist();
    }
    if (photoProvider && photoSegmenter?.ready) {
      try { backgroundRemovalReady = await photoSegmenter.ready(); } catch { backgroundRemovalReady = false; }
      const checkSegmenter = async () => {
        try { backgroundRemovalReady = await photoSegmenter.ready(); } catch { backgroundRemovalReady = false; }
      };
      const timer = setInterval(() => void checkSegmenter(), 15_000);
      timer.unref?.();
    }
    if (acquisitionAvailable && autoRun) queueMicrotask(() => void runQueuedJobs());
    initialized = true;
  }

  function persist() {
    writeQueue = writeQueue.then(async () => {
      const temp = `${dbPath}.${randomUUID()}.tmp`;
      await writeFile(temp, JSON.stringify(db, null, 2), { mode: 0o600 });
      await rename(temp, dbPath);
    });
    return writeQueue;
  }

  function requireAdmin(authorized) {
    if (!authorized)
      throw Object.assign(new Error('administrator authorization required'), { status: 403 });
  }

  function isAuthorized(header, expectedToken = adminToken) {
    if (typeof header !== 'string' || !header.startsWith('Bearer ')) return false;
    const supplied = Buffer.from(header.slice(7));
    const expected = Buffer.from(expectedToken);
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }

  function requireRequestService(header) {
    if (!requestToken || !isAuthorized(header, requestToken))
      throw Object.assign(new Error('service authorization required'), { status: 403 });
  }

  function activeJob(identityKey) {
    return db.jobs.find(
      (job) => job.identityKey === identityKey && ACTIVE_JOB_STATES.has(job.status),
    );
  }

  function latestJob(identityKey) {
    return [...db.jobs].reverse().find((job) => job.identityKey === identityKey) ?? null;
  }

  function effectiveCatalogStatus(asset) {
    return db.catalogDecisions[asset.id]?.status ?? asset.approvalStatus;
  }

  function identityMatchesCatalogMapping(identity, mapping) {
    if (identity.modelId !== mapping.modelId) return false;
    if (identity.modelYear < mapping.yearFrom || identity.modelYear > mapping.yearTo) return false;
    if (mapping.generationId && identity.generationId !== mapping.generationId) return false;
    if (mapping.faceliftId && identity.faceliftId !== mapping.faceliftId) return false;
    if (mapping.trimPrefixes?.length && !mapping.trimPrefixes.some((prefix) => identity.trimId?.startsWith(prefix))) return false;
    return true;
  }

  function matchingCatalogAssets(identity, { approvedOnly = true } = {}) {
    if (!identity.marketRegion) return [];
    return catalog.assets.filter((asset) => {
      if (asset.makeId !== identity.makeId || asset.marketRegion !== identity.marketRegion) return false;
      if (approvedOnly && effectiveCatalogStatus(asset) !== 'approved') return false;
      if (!asset.identityVerified || !asset.assetKey) return false;
      return asset.modelMappings?.some((mapping) => identityMatchesCatalogMapping(identity, mapping)) ?? false;
    });
  }

  function approvedCatalogAsset(identity) {
    const matches = matchingCatalogAssets(identity);
    return matches.length === 1 ? matches[0] : null;
  }

  function generationIdentityIsVerified(identity) {
    if (!identity.marketRegion) return false;
    if (identity.generationId) return true;
    return matchingCatalogAssets(identity, { approvedOnly: false }).some((asset) =>
      effectiveCatalogStatus(asset) !== 'rejected' && asset.generationVerified === true,
    );
  }

  function catalogAssetResponse(asset) {
    return asset ? { url: asset.assetUrl ?? null, version: 1, catalogAssetKey: asset.assetKey } : null;
  }

  /**
   * Identities acquisition may work on: market- and generation-verified ones, and
   * explicitly unverified ones (review only). A market that is claimed but not
   * verified by the registry stays in identity review, as before.
   */
  function identityAcquirable(identity) {
    return identity.identityStatus === 'unverified' || generationIdentityIsVerified(identity);
  }

  function scopeCovers(scope, identity) {
    return scope.status === 'active' &&
      scope.makeId === identity.makeId && scope.modelId === identity.modelId &&
      scope.trimId === identity.trimId && scope.bodyType === identity.bodyType &&
      scope.generationId === identity.generationId && scope.faceliftId === identity.faceliftId &&
      scope.marketRegion === (identity.marketRegion ?? null) &&
      scope.identityStatus === (identity.identityStatus ?? null) &&
      identity.modelYear >= scope.yearFrom && identity.modelYear <= scope.yearTo;
  }

  /**
   * The image subject: what the picture shows, shared by every identity that
   * shows the same car, so one job and one publication serve all of them.
   *
   *   catalog:<entry>  exactly one identity- and generation-verified registry
   *                    entry covers the market-verified identity (all its years)
   *   scope:<id>       an administrator approved an image for a year range that
   *                    covers the identity (same make, model, trim, body, market)
   *   identity:<key>   otherwise the identity alone; years are never merged
   *                    without verified facts or an administrator's decision
   */
  function subjectKeyFor(identity, identityKey) {
    if (identity.marketRegion) {
      const entries = matchingCatalogAssets(identity, { approvedOnly: false })
        .filter((asset) => asset.generationVerified === true && effectiveCatalogStatus(asset) !== 'rejected');
      if (entries.length === 1) return `catalog:${entries[0].id}`;
    }
    const scopes = db.scopes.filter((scope) => scopeCovers(scope, identity));
    if (scopes.length === 1) return `scope:${scopes[0].id}`;
    return `identity:${identityKey}`;
  }

  /** Point a canonical request at its subject; the first request of a subject holds its work. */
  function attachToSubject(request) {
    request.subjectKey = subjectKeyFor(request.canonicalIdentity, request.identityKey);
    const subject = db.subjects[request.subjectKey];
    if (!subject || !db.requests.some((item) => item.id === subject.primaryRequestId)) {
      db.subjects[request.subjectKey] = { primaryRequestId: request.id, createdAt: new Date().toISOString() };
    }
  }

  /** The request that holds a request's jobs, candidates and publications. */
  function primaryFor(request) {
    const subject = request?.subjectKey ? db.subjects[request.subjectKey] : null;
    return (subject && db.requests.find((item) => item.id === subject.primaryRequestId)) ?? request;
  }

  function hasPendingCandidate(request) {
    return db.candidates.some((candidate) => candidate.requestId === request.id && candidate.status === 'pending');
  }

  function rejectedFor(subjectKey) {
    return new Set(db.rejectedFingerprints[subjectKey] ?? []);
  }

  /** What acquisition could do for a request right now, with no side effects. */
  function acquisitionPlan(request) {
    const identity = request?.canonicalIdentity;
    if (!identity || !identityAcquirable(identity)) return { eligible: false, artwork: [], photos: Boolean(photoProvider), generation: false };
    const rejected = rejectedFor(request.subjectKey);
    const artwork = artworkProvider
      ? artworkEntriesFor(catalog, identity, {
          effectiveStatus: effectiveCatalogStatus,
          coversMapping: identityMatchesCatalogMapping,
        }).filter(({ asset }) => !rejected.has(`artwork:${asset.id}`))
      : [];
    const generation = generationAvailable &&
      (identity.identityStatus === 'unverified' ? allowUnverifiedGeneration : generationIdentityIsVerified(identity));
    return { eligible: artwork.length > 0 || Boolean(photoProvider) || generation, artwork, photos: Boolean(photoProvider), generation };
  }

  /** Status vocabulary for contract-2 clients (the backend since the acquisition release). */
  function contractStatus(request, primary, asset, job) {
    if (asset) return 'approved';
    if (request.identityReviewRequired) return 'needs_review';
    if (job && (job.status === 'queued' || job.status === 'running')) return job.status;
    if (hasPendingCandidate(primary)) return 'awaiting_approval';
    if (job && ADMIN_ONLY_TERMINAL_JOB_STATES.has(job.status)) return job.status;
    return 'awaiting_source';
  }

  function listCatalogAssets(authorized) {
    requireAdmin(authorized);
    return catalog.assets.map((asset) => ({
      ...asset,
      approvalStatus: effectiveCatalogStatus(asset),
      decision: db.catalogDecisions[asset.id] ?? null,
    }));
  }

  async function decideCatalogAsset(id, decision, approvalReference, authorized) {
    requireAdmin(authorized);
    const asset = catalog.assets.find((entry) => entry.id === id);
    if (!asset) throw Object.assign(new Error('catalog asset not found'), { status: 404 });
    if (!['approve', 'reject'].includes(decision)) throw new Error('decision must be approve or reject');
    if (typeof approvalReference !== 'string' || approvalReference.trim().length < 4 || approvalReference.length > 240)
      throw new Error('approvalReference is required');
    if (decision === 'approve' && (!asset.identityVerified || !asset.generationVerified || !asset.assetKey || !asset.marketRegion || !asset.modelMappings?.length || typeof asset.assetUrl !== 'string' || !asset.assetUrl.startsWith('https://')))
      throw Object.assign(new Error('verified identity and HTTPS asset location are required for approval'), { status: 409 });
    db.catalogDecisions[id] = {
      status: decision === 'approve' ? 'approved' : 'rejected',
      approvalReference: approvalReference.trim(),
      decidedAt: new Date().toISOString(),
    };
    await persist();
    return { id, approvalStatus: db.catalogDecisions[id].status };
  }

  function createJob(request, forceRegenerate = false) {
    const job = {
      id: randomUUID(),
      requestId: request.id,
      identityKey: request.identityKey,
      status: 'queued',
      attempts: 0,
      maxAttempts,
      forceRegenerate,
      createdAt: new Date().toISOString(),
    };
    db.jobs.push(job);
    return job;
  }

  async function submitRequest(input, referenceImages = []) {
    const vehicle = validateVehicle(input);
    const identityKey = vehicleIdentityKey(vehicle);
    let request = db.requests.find((item) => item.identityKey === identityKey);
    const duplicate = Boolean(request);
    if (!request) {
      request = {
        id: randomUUID(),
        vehicle,
        identityKey,
        status: 'pending',
        createdAt: new Date().toISOString(),
      };
      if (!Array.isArray(referenceImages) || referenceImages.length > 10)
        throw new Error('referenceImages must contain at most 10 images');
      request.referenceAssets = [];
      let totalBytes = 0;
      for (const reference of referenceImages) {
        const bytes = Buffer.from(String(reference.data ?? ''), 'base64');
        const type = reference.contentType;
        const validSignature =
          type === 'image/png'
            ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : type === 'image/jpeg'
              ? bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217
              : type === 'image/webp' &&
                bytes.subarray(0, 4).toString() === 'RIFF' &&
                bytes.subarray(8, 12).toString() === 'WEBP';
        totalBytes += bytes.length;
        if (!validSignature || bytes.length === 0 || totalBytes > 12 * 1024 * 1024)
          throw new Error(
            'reference images must be valid PNG, JPEG or WebP and total at most 12 MB',
          );
        const id = randomUUID();
        await writeFile(path.join(privateDir, id), bytes, { mode: 0o600, flag: 'wx' });
        request.referenceAssets.push({ id, contentType: type });
      }
      db.requests.push(request);
    }
    const reusableAsset = resolve(identityKey);
    const previousJob = latestJob(identityKey);
    let job = null;
    if (
      !reusableAsset && !activeJob(identityKey) &&
      !ADMIN_ONLY_TERMINAL_JOB_STATES.has(previousJob?.status)
    ) job = createJob(request);
    await persist();
    if (job && autoRun && (generationAvailable || artworkProvider || photoProvider)) queueMicrotask(() => void runQueuedJobs());
    return {
      request,
      duplicate,
      reused: Boolean(reusableAsset),
      asset: reusableAsset,
      job,
      activeJob: activeJob(identityKey) ?? job,
      previousJob: !job && !reusableAsset ? previousJob : null,
    };
  }

  async function submitCanonicalRequest(input) {
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new Error('canonical request body is required');
    if (Object.keys(input).some((field) => !['identity', 'vehicle'].includes(field)))
      throw new Error('canonical request contains unsupported fields');
    const identity = validateCanonicalVehicleIdentity(input.identity);
    const identityKey = canonicalVehicleIdentityKey(identity);
    const vehicle = validateCanonicalDisplay(input.vehicle, identity);
    count('requestsReceived');
    const catalogAsset = approvedCatalogAsset(identity);
    if (catalogAsset) {
      count('catalogReuses');
      await persist();
      return {
        request: null,
        duplicate: false,
        reused: true,
        asset: catalogAssetResponse(catalogAsset),
        job: null,
        activeJob: null,
        previousJob: null,
        identityKey,
        subjectKey: `catalog:${catalogAsset.id}`,
      };
    }
    let request = db.requests.find(
      (item) => item.identityKey === identityKey && item.canonicalIdentity,
    );
    const duplicate = Boolean(request);
    if (!request) {
      request = {
        id: randomUUID(),
        vehicle,
        canonicalIdentity: identity,
        identityKey,
        status: 'pending',
        createdAt: new Date().toISOString(),
        referenceAssets: [],
      };
      db.requests.push(request);
    }
    // Re-evaluated on every request: a newer scope or registry entry applies to waiting requests too.
    attachToSubject(request);
    const primary = primaryFor(request);
    const reusableAsset = resolve(primary.identityKey);
    const previousJob = latestJob(primary.identityKey);
    const acquirable = identityAcquirable(identity);
    const rejectedCatalogAsset = matchingCatalogAssets(identity, { approvedOnly: false })
      .some((asset) => effectiveCatalogStatus(asset) === 'rejected');
    if (!acquirable || rejectedCatalogAsset) {
      request.identityReviewRequired = true;
      for (const queued of db.jobs) {
        if (queued.identityKey === identityKey && queued.status === 'queued') {
          queued.status = 'cancelled';
          queued.completedAt = new Date().toISOString();
        }
      }
    }
    const plan = acquirable && !rejectedCatalogAsset ? acquisitionPlan(primary) : { eligible: false };
    if (acquirable && !rejectedCatalogAsset) {
      if (plan.eligible) delete request.generationDisabled;
      else request.generationDisabled = true;
    }
    let job = null;
    if (
      plan.eligible && primary === request &&
      !reusableAsset && !activeJob(identityKey) && !hasPendingCandidate(request) &&
      !ADMIN_ONLY_TERMINAL_JOB_STATES.has(previousJob?.status)
    ) job = createJob(request);
    if (reusableAsset) count('publicationReuses');
    else if (!job && (duplicate || primary !== request || activeJob(primary.identityKey))) count('requestsDeduplicated');
    await persist();
    if (job && acquisitionAvailable && autoRun) queueMicrotask(() => void runQueuedJobs());
    return {
      request,
      duplicate,
      reused: Boolean(reusableAsset),
      asset: reusableAsset,
      job,
      activeJob: activeJob(primary.identityKey) ?? job,
      previousJob: !job && !reusableAsset ? previousJob : null,
      identityKey,
      subjectKey: request.subjectKey,
    };
  }

  function listPending(authorized) {
    requireAdmin(authorized);
    return db.requests
      .filter(
        (request) =>
          request.status !== 'rejected' &&
          (request.identityReviewRequired || request.status === 'pending' ||
            activeJob(request.identityKey) ||
            db.candidates.some(
              (candidate) => candidate.requestId === request.id && candidate.status === 'pending',
            )),
      )
      .map((request) => ({
        ...request,
        job:
          [...db.jobs]
            .reverse()
            .find(
              (job) =>
                job.requestId === request.id &&
                ['queued', 'running', 'failed', 'awaiting_approval', 'rejected', 'cancelled'].includes(
                  job.status,
                ),
            ) ?? null,
        candidates: db.candidates
          .filter((candidate) => candidate.requestId === request.id)
          .map(
            ({
              id,
              status,
              createdAt,
              source,
              provider,
              license,
              licenseName,
              licenseUrl,
              licenseEvidence,
              author,
              attribution,
              sourceUrl,
              sourcePage,
              sourceTitle,
              modifications,
              sourceWidth,
              sourceHeight,
              provenance,
              sourceRef,
              kind,
              quality,
              identityReviewRequired,
              model,
              providerLatencyMs,
              processingLatencyMs,
              providerUsage,
              estimatedCostUsd,
            }) => ({
              id,
              status,
              createdAt,
              source,
              provider,
              license,
              licenseName,
              licenseUrl,
              licenseEvidence,
              author,
              attribution,
              sourceUrl,
              sourcePage,
              sourceTitle,
              modifications,
              sourceWidth,
              sourceHeight,
              provenance,
              sourceRef,
              kind,
              quality,
              identityReviewRequired,
              model,
              providerLatencyMs,
              processingLatencyMs,
              providerUsage,
              estimatedCostUsd,
            }),
          ),
      }));
  }

  async function saveCandidate(requestId, bytes, contentType, metadata = {}) {
    const request = db.requests.find((item) => item.id === requestId);
    if (!request || request.status === 'rejected')
      throw Object.assign(new Error('request not found'), { status: 404 });
    const originalBytes = Buffer.isBuffer(metadata.originalBytes) ? metadata.originalBytes : null;
    if (originalBytes) {
      if (originalBytes.length < 32 || originalBytes.length > 8 * 1024 * 1024 ||
          !['image/jpeg', 'image/png', 'image/webp'].includes(metadata.originalContentType))
        throw new Error('source original image does not meet the private archive contract');
    }
    const id = randomUUID();
    await writeFile(path.join(privateDir, id), bytes, { mode: 0o600, flag: 'wx' });
    if (originalBytes) {
      await writeFile(path.join(privateDir, `${id}.original`), originalBytes, { mode: 0o600, flag: 'wx' });
    }
    const unverifiedIdentity = request.canonicalIdentity?.identityStatus === 'unverified';
    const candidate = {
      id,
      requestId,
      subjectKey: request.subjectKey,
      contentType,
      originalAvailable: Boolean(originalBytes),
      originalContentType: originalBytes ? metadata.originalContentType : undefined,
      size: bytes.length,
      contentSha256: sha256Hex(bytes),
      status: 'pending',
      source: metadata.source ?? 'manual',
      provider: metadata.provider,
      model: metadata.model,
      kind: metadata.kind,
      license: metadata.license,
      licenseName: metadata.licenseName,
      licenseUrl: metadata.licenseUrl,
      licenseEvidence: metadata.licenseEvidence,
      author: metadata.author,
      attribution: metadata.attribution,
      sourceUrl: metadata.sourceUrl,
      sourcePage: metadata.sourcePage,
      sourceTitle: metadata.sourceTitle,
      modifications: metadata.modifications,
      sourceWidth: metadata.sourceWidth,
      sourceHeight: metadata.sourceHeight,
      provenance: metadata.provenance,
      catalogAssetId: metadata.catalogAssetId,
      sourceRef: metadata.sourceRef,
      sourceFingerprint: metadata.sourceFingerprint,
      basis: metadata.basis,
      confidence: metadata.confidence,
      uploadedBy: metadata.uploadedBy,
      width: metadata.width,
      height: metadata.height,
      quality: metadata.quality,
      identityReviewRequired:
        metadata.source === 'generated' || metadata.source === 'licensed-photo' || unverifiedIdentity || metadata.basis === 'hint' ? true : undefined,
      providerLatencyMs: metadata.providerLatencyMs,
      providerRequestId: metadata.providerRequestId,
      providerUsage: metadata.providerUsage,
      estimatedCostUsd: metadata.estimatedCostUsd,
      processingLatencyMs: metadata.processingLatencyMs,
      createdAt: new Date().toISOString(),
    };
    db.candidates.push(candidate);
    await persist();
    return candidate;
  }

  async function uploadCandidate(requestId, { contentType, bytes, uploadedBy }, authorized) {
    requireAdmin(authorized);
    if (!IMAGE_TYPES.has(contentType))
      throw Object.assign(new Error('only JPEG, PNG and WebP images are accepted'), {
        status: 415,
      });
    if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_IMAGE_BYTES)
      throw Object.assign(new Error('image must be between 1 byte and 8 MB'), { status: 413 });
    const signatures = {
      'image/png': bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
      'image/jpeg':
        bytes[0] === 255 && bytes[1] === 216 && bytes.at(-2) === 255 && bytes.at(-1) === 217,
      'image/webp':
        bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP',
    };
    if (!signatures[contentType])
      throw Object.assign(new Error('image content does not match its declared type'), {
        status: 415,
      });
    // Decode and check it now (format, size, transparency, clipping): a file that
    // cannot become a Garage image is refused at upload, not at approval.
    let checks;
    try {
      checks = (await framedImageValidator(bytes)).checks;
    } catch (error) {
      throw Object.assign(new Error(error?.name === 'ImageQualityError' ? error.message : 'image could not be processed'), {
        status: 422,
      });
    }
    // An upload belongs to the request that holds its subject's work, so the
    // published image serves every identity of that subject.
    const request = db.requests.find((item) => item.id === requestId);
    const target = request?.canonicalIdentity ? primaryFor(request) : request;
    if (target?.subjectKey && rejectedFor(target.subjectKey).has(sha256Hex(bytes)))
      throw Object.assign(new Error('this image was rejected for this vehicle before'), { status: 409 });
    const candidate = await saveCandidate(target?.id ?? requestId, bytes, contentType, {
      source: 'manual',
      provider: 'manual-upload',
      license: 'owner-supplied',
      quality: checks,
      uploadedBy: uploadedBy ? sanitizeActor(uploadedBy) : undefined,
    });
    count('candidatesCreated');
    return candidate;
  }

  /** Propose each eligible repository artwork once as a private candidate. */
  async function runArtwork(job, request, entries) {
    const created = [];
    const rejected = rejectedFor(request.subjectKey);
    job.artworkResults = [];
    for (const { asset, basis, confidence } of entries) {
      let source;
      try {
        source = await artworkProvider.read(asset);
      } catch {
        job.artworkResults.push({ catalogAssetId: asset.id, outcome: 'unreadable' });
        count('providerFailures');
        continue;
      }
      const proposed = db.candidates.some(
        (candidate) => candidate.requestId === request.id && candidate.sourceFingerprint === source.fingerprint,
      );
      if (rejected.has(source.fingerprint) || proposed) {
        job.artworkResults.push({ catalogAssetId: asset.id, outcome: rejected.has(source.fingerprint) ? 'rejected-before' : 'already-proposed' });
        continue;
      }
      const startedAt = Date.now();
      let processed;
      try {
        processed = await framedImageValidator(source.bytes);
      } catch (error) {
        job.artworkResults.push({
          catalogAssetId: asset.id,
          outcome: error?.name === 'ImageQualityError' ? `quality:${error.message}` : 'processing-failed',
        });
        continue;
      }
      const candidate = await saveCandidate(request.id, processed.bytes, processed.contentType, {
        source: 'repository-artwork',
        provider: artworkProvider.id,
        license: artworkProvider.license,
        provenance: asset.provenance,
        catalogAssetId: asset.id,
        sourceRef: asset.storageRef,
        sourceFingerprint: source.fingerprint,
        basis,
        confidence,
        width: processed.width,
        height: processed.height,
        quality: processed.checks,
        processingLatencyMs: Date.now() - startedAt,
      });
      created.push(candidate);
      job.artworkResults.push({ catalogAssetId: asset.id, outcome: 'candidate', candidateId: candidate.id });
    }
    return created;
  }

  async function runLicensedPhotos(job, request) {
    if (!photoProvider) return [];
    if (!photoSegmenter?.removeBackground || !backgroundRemovalReady)
      throw Object.assign(new Error('background segmentation service is not ready'), { retryable: true });
    const day = new Date().toISOString().slice(0, 10);
    if ((db.providerCallLedger[day] ?? 0) >= maxProviderCallsPerDay) return [];
    db.providerCallLedger[day] = (db.providerCallLedger[day] ?? 0) + 1;
    await persist();
      const photos = await photoProvider.acquire({ identity: request.canonicalIdentity, vehicle: request.vehicle,
        subjectKey: request.subjectKey, signal: AbortSignal.timeout(jobTimeoutMs) });
    const created = [];
    for (const item of (photos ?? []).slice(0, 3)) {
      const source = item?.source;
      if (!Buffer.isBuffer(item?.bytes) || !source || source.provider !== photoProvider.id || !hasPublishableRights(source)) continue;
      const fingerprint = source.sourceFingerprint || sha256Hex(item.bytes);
      if (rejectedFor(request.subjectKey).has(fingerprint) || db.candidates.some((candidate) => candidate.requestId === request.id && candidate.sourceFingerprint === fingerprint)) continue;
      const cutout = await photoSegmenter.removeBackground(item.bytes);
      const processed = await processSegmentedPhoto(cutout);
      const candidate = await saveCandidate(request.id, processed.bytes, processed.contentType, {
        source: 'licensed-photo', provider: source.provider, kind: 'licensed-photo', license: source.license,
        licenseName: source.licenseName, licenseUrl: source.licenseUrl, licenseEvidence: source.licenseEvidence,
        author: source.author, attribution: source.attribution, sourceUrl: source.sourceUrl,
        sourceTitle: source.title, modifications: source.modifications,
        sourcePage: source.sourcePage, provenance: source.provenance, sourceRef: source.sourcePage,
        originalBytes: item.bytes, originalContentType: item.contentType,
        sourceWidth: source.width, sourceHeight: source.height,
        sourceFingerprint: fingerprint, basis: source.basis, confidence: source.confidence,
        width: processed.width, height: processed.height,
        modifications: 'Background removed with U2Net; low-confidence matte pixels removed; framed and converted to transparent WebP',
        quality: { ...processed.checks, backgroundRemoval: 'pass', segmentationModel: 'u2net' },
      });
      created.push(candidate);
      job.photoResults ??= [];
      job.photoResults.push({ outcome: 'candidate', candidateId: candidate.id, sourcePage: source.sourcePage });
    }
    return created;
  }

  /** Record the publication decision on a new candidate and publish when policy allows it. */
  async function applyPublicationPolicy(candidate, request, candidateProvider) {
    const decision = publicationDecision({
      identityVerified: Boolean(request.canonicalIdentity) && request.canonicalIdentity.identityStatus !== 'unverified' &&
        generationIdentityIsVerified(request.canonicalIdentity),
      provider: candidateProvider,
      quality: candidate.quality,
      publicationEnabled,
    });
    candidate.policy = decision;
    await persist();
    if (decision.autoPublish) {
      await decideCandidate(candidate.id, 'approve', true, {
        actor: { id: 'policy', email: null, name: 'automatic publication policy' },
        automatic: true,
      });
    }
  }

  async function runJob(job) {
    const request = db.requests.find((item) => item.id === job.requestId);
    if (!request || activeJob(job.identityKey) !== job) return;
    if (!request.canonicalIdentity && !provider) return;
    if (request.canonicalIdentity && !identityAcquirable(request.canonicalIdentity)) {
      request.identityReviewRequired = true;
      job.status = 'cancelled';
      job.completedAt = new Date().toISOString();
      await persist();
      return;
    }
    const plan = request.canonicalIdentity
      ? acquisitionPlan(request)
      : { eligible: true, artwork: [], photos: false, generation: true };
    if (!plan.eligible) {
      job.status = 'cancelled';
      job.completedAt = new Date().toISOString();
      request.generationDisabled = true;
      await persist();
      return;
    }
    job.status = 'running';
    job.startedAt = new Date().toISOString();
    if (plan.artwork.length) {
      job.phase = 'artwork';
      await persist();
      const created = await runArtwork(job, request, plan.artwork);
      delete job.phase;
      if (created.length) {
        job.status = 'awaiting_approval';
        job.resultCandidateId = created[0].id;
        job.provider = artworkProvider.id;
        job.completedAt = new Date().toISOString();
        count('candidatesCreated', created.length);
        await persist();
        for (const candidate of created) await applyPublicationPolicy(candidate, request, artworkProvider);
        return;
      }
    }
    if (plan.photos) {
      job.phase = 'licensed-photo-source';
      await persist();
      let created = [];
      try { created = await runLicensedPhotos(job, request); }
      catch (error) { job.photoSourceError = error?.retryable ? 'provider-temporary-failure' : 'provider-failure'; }
      delete job.phase;
      if (created.length) {
        job.status = 'awaiting_approval'; job.resultCandidateId = created[0].id;
        job.provider = photoProvider.id; job.completedAt = new Date().toISOString();
        count('candidatesCreated', created.length); await persist();
        for (const candidate of created) await applyPublicationPolicy(candidate, request, photoProvider);
        return;
      }
    }
    if (!plan.generation) {
      job.status = 'no_source';
      job.lastError = 'no-candidate-source';
      job.completedAt = new Date().toISOString();
      count('jobsWithoutSource');
      await persist();
      return;
    }
    job.phase = 'generation';
    await persist();
    let lastFailure = 'provider failure';
    while (job.attempts < maxAttempts) {
      const day = new Date().toISOString().slice(0, 10);
      const usedToday = db.providerCallLedger[day] ?? 0;
      if (usedToday >= maxProviderCallsPerDay) {
        job.status = 'failed';
        job.completedAt = new Date().toISOString();
        job.lastError = 'daily-provider-call-limit';
        await persist();
        return;
      }
      db.providerCallLedger[day] = usedToday + 1;
      job.attempts += 1;
      delete job.transportDiagnostics;
      delete job.providerHttpStatus;
      delete job.providerErrorCode;
      const controller = new AbortController();
      let timer;
      let generated;
      try {
        await persist();
        const referenceImages = await Promise.all(
          (request.referenceAssets ?? []).map(async (asset) => ({
            bytes: await readFile(path.join(privateDir, asset.id)),
            contentType: asset.contentType,
          })),
        );
        const operation = provider.generate({
          vehicle: request.vehicle,
          referenceImages,
          signal: controller.signal,
        });
        const timeout = new Promise((_, reject) => {
          timer = setTimeout(() => {
            controller.abort();
            reject(new Error('provider timeout'));
          }, jobTimeoutMs);
        });
        generated = await Promise.race([operation, timeout]);
        clearTimeout(timer);
        if (!generated || !Buffer.isBuffer(generated.bytes))
          throw new Error('provider returned invalid image data');
        const processingStartedAt = Date.now();
        const processed = await imageValidator(generated.bytes);
        const processingLatencyMs = Date.now() - processingStartedAt;
        const candidate = await saveCandidate(request.id, processed.bytes, processed.contentType, {
          source: 'generated',
          provider: generated.provider ?? provider.name ?? 'custom',
          model: generated.model,
          width: processed.width,
          height: processed.height,
          quality: processed.checks,
          providerLatencyMs: generated.providerLatencyMs,
          providerRequestId: generated.providerRequestId,
          providerUsage: generated.providerUsage,
          estimatedCostUsd: generated.estimatedCostUsd,
          processingLatencyMs,
        });
        job.status = 'awaiting_approval';
        job.resultCandidateId = candidate.id;
        job.providerLatencyMs = generated.providerLatencyMs;
        job.providerRequestId = generated.providerRequestId;
        job.providerUsage = generated.providerUsage;
        job.estimatedCostUsd = generated.estimatedCostUsd;
        job.processingLatencyMs = processingLatencyMs;
        job.completedAt = new Date().toISOString();
        job.provider = candidate.provider;
        delete job.phase;
        delete job.lastError;
        delete job.transportDiagnostics;
        count('candidatesCreated');
        await persist();
        await applyPublicationPolicy(candidate, request, provider);
        return;
      } catch (error) {
        clearTimeout(timer);
        lastFailure = controller.signal.aborted
          ? 'provider timeout'
          : error?.name === 'ImageQualityError'
            ? `quality:${error.message}`
            : error?.message === 'provider timeout'
              ? 'provider timeout'
              : error?.message === 'image provider request timed out'
                ? 'provider timeout'
                : 'provider failure';
        job.lastError = lastFailure;
        if (generated) {
          job.providerLatencyMs = generated.providerLatencyMs;
          job.providerRequestId = generated.providerRequestId;
          job.providerUsage = generated.providerUsage;
          job.estimatedCostUsd = generated.estimatedCostUsd;
        }
        if (Number.isFinite(error?.providerLatencyMs))
          job.providerLatencyMs = error.providerLatencyMs;
        if (error?.providerRequestId) job.providerRequestId = error.providerRequestId;
        if (Number.isInteger(error?.providerHttpStatus))
          job.providerHttpStatus = error.providerHttpStatus;
        if (typeof error?.providerErrorCode === 'string')
          job.providerErrorCode = error.providerErrorCode;
        const diagnostics = sanitizeTransportDiagnostics(error?.transportDiagnostics);
        if (diagnostics) job.transportDiagnostics = diagnostics;
        job.lastQualityFailure = error?.name === 'ImageQualityError' ? error.message : undefined;
        await persist();
        if (job.attempts < maxAttempts && retryDelayMs > 0)
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelayMs * 2 ** (job.attempts - 1)),
          );
      }
    }
    job.status = 'failed';
    job.completedAt = new Date().toISOString();
    job.lastError = lastFailure;
    // Dead letter: retries are exhausted; only an administrator restarts it.
    job.deadLetter = true;
    delete job.phase;
    count('providerFailures');
    count('jobsFailed');
    await persist();
  }

  async function runQueuedJobs() {
    if (!acquisitionAvailable) return false;
    if (workerPromise) return workerPromise;
    // Each queued job is taken at most once per pass, and only when something can
    // run it (free-form legacy requests need the generation provider), so a job
    // that runJob leaves queued can never spin the loop.
    const runnable = (job) => {
      const request = db.requests.find((item) => item.id === job.requestId);
      return Boolean(request) && (Boolean(request.canonicalIdentity) || generationAvailable);
    };
    workerPromise = (async () => {
      const taken = new Set();
      while (true) {
        const job = db.jobs.find((item) => item.status === 'queued' && !taken.has(item.id) && runnable(item));
        if (!job) return;
        taken.add(job.id);
        await runJob(job);
      }
    })().finally(() => {
      workerPromise = null;
    });
    await workerPromise;
    return true;
  }

  async function regenerateRequest(requestId, authorized) {
    requireAdmin(authorized);
    const request = db.requests.find((item) => item.id === requestId);
    if (!request) throw Object.assign(new Error('request not found'), { status: 404 });
    if (!generationAvailable)
      throw Object.assign(new Error('image generation is disabled'), { status: 503 });
    if (request.activeVersion || resolve(request.identityKey))
      throw Object.assign(new Error('an approved image already exists for this identity'), { status: 409 });
    if (request.canonicalIdentity && !generationIdentityIsVerified(request.canonicalIdentity))
      throw Object.assign(new Error('canonical identity requires review before generation'), { status: 409 });
    if (activeJob(request.identityKey))
      throw Object.assign(new Error('generation is already active'), { status: 409 });
    const job = createJob(request, true);
    await persist();
    if (autoRun && (generationAvailable || artworkProvider || photoProvider)) queueMicrotask(() => void runQueuedJobs());
    return job;
  }

  /** An approval may name the years its image applies to: one subject for all of them. */
  function validateScope(input, request) {
    const identity = request.canonicalIdentity;
    if (!identity) throw Object.assign(new Error('a scope needs a canonical identity'), { status: 400 });
    if (request.subjectKey?.startsWith('catalog:'))
      throw Object.assign(new Error('verified registry years already define this subject'), { status: 400 });
    const { yearFrom, yearTo } = input ?? {};
    if (!Number.isInteger(yearFrom) || !Number.isInteger(yearTo) || yearFrom > identity.modelYear ||
      yearTo < identity.modelYear || yearTo - yearFrom > 30)
      throw Object.assign(new Error('scope must be whole years around the vehicle year, at most 30 years'), { status: 400 });
    const scope = {
      makeId: identity.makeId,
      modelId: identity.modelId,
      trimId: identity.trimId,
      bodyType: identity.bodyType,
      generationId: identity.generationId,
      faceliftId: identity.faceliftId,
      marketRegion: identity.marketRegion ?? null,
      identityStatus: identity.identityStatus ?? null,
      yearFrom,
      yearTo,
    };
    const overlap = db.scopes.some((other) => other.status === 'active' &&
      ['makeId', 'modelId', 'trimId', 'bodyType', 'generationId', 'faceliftId', 'marketRegion', 'identityStatus']
        .every((field) => other[field] === scope[field]) &&
      other.yearFrom <= yearTo && yearFrom <= other.yearTo);
    if (overlap) throw Object.assign(new Error('another approved scope already covers some of these years'), { status: 409 });
    return scope;
  }

  /** Create an approved scope and move every waiting request it covers onto it. */
  function createScope(scope, request, candidate, actor) {
    const id = randomUUID();
    const record = { id, status: 'active', ...scope, primaryRequestId: request.id, candidateId: candidate.id,
      createdBy: actor, createdAt: new Date().toISOString() };
    db.scopes.push(record);
    db.subjects[`scope:${id}`] = { primaryRequestId: request.id, createdAt: record.createdAt };
    request.subjectKey = `scope:${id}`;
    for (const other of db.requests) {
      if (other === request || !other.canonicalIdentity || !scopeCovers(record, other.canonicalIdentity)) continue;
      other.subjectKey = `scope:${id}`;
      for (const job of db.jobs) {
        if (job.requestId === other.id && job.status === 'queued') {
          job.status = 'cancelled';
          job.completedAt = record.createdAt;
          job.lastError = 'superseded-by-scope';
        }
      }
      for (const pending of db.candidates) {
        if (pending.requestId === other.id && pending.status === 'pending') pending.status = 'superseded';
      }
    }
    return record;
  }

  /**
   * Administrator retry of acquisition (free providers first, paid generation
   * only where it is allowed). Unlike `regenerateRequest` it does not need the
   * generation provider; it never runs for an identity still in review.
   */
  async function retryAcquisition(requestId, authorized, options = {}) {
    requireAdmin(authorized);
    const request = db.requests.find((item) => item.id === requestId && item.canonicalIdentity);
    if (!request) throw Object.assign(new Error('request not found'), { status: 404 });
    const primary = primaryFor(request);
    if (resolve(primary.identityKey))
      throw Object.assign(new Error('an approved image already exists for this identity'), { status: 409 });
    if (activeJob(primary.identityKey) || hasPendingCandidate(primary))
      throw Object.assign(new Error('acquisition is already active'), { status: 409 });
    if (!identityAcquirable(primary.canonicalIdentity) || primary.identityReviewRequired)
      throw Object.assign(new Error('canonical identity requires review before acquisition'), { status: 409 });
    const plan = acquisitionPlan(primary);
    if (!plan.eligible)
      throw Object.assign(new Error('no candidate source is available for this identity'), { status: 409 });
    delete primary.generationDisabled;
    delete request.generationDisabled;
    const job = createJob(primary, true);
    db.decisions.push({
      at: job.createdAt, action: 'retry', requestId: primary.id, identityKey: primary.identityKey,
      subjectKey: primary.subjectKey ?? null, actor: sanitizeActor(options.actor),
    });
    count('retries');
    await persist();
    if (autoRun) queueMicrotask(() => void runQueuedJobs());
    return job;
  }

  const candidateSummary = (candidate) => ({
    id: candidate.id,
    status: candidate.status,
    createdAt: candidate.createdAt,
    decidedAt: candidate.decidedAt,
    source: candidate.source,
    provider: candidate.provider,
    model: candidate.model,
    license: candidate.license,
    licenseName: candidate.licenseName,
    licenseUrl: candidate.licenseUrl,
    licenseEvidence: candidate.licenseEvidence,
    author: candidate.author,
    attribution: candidate.attribution,
    sourceUrl: candidate.sourceUrl,
    sourcePage: candidate.sourcePage,
    sourceTitle: candidate.sourceTitle,
    modifications: candidate.modifications,
    sourceWidth: candidate.sourceWidth,
    sourceHeight: candidate.sourceHeight,
    provenance: candidate.provenance,
    sourceRef: candidate.sourceRef,
    kind: candidate.kind,
    catalogAssetId: candidate.catalogAssetId,
    basis: candidate.basis,
    confidence: candidate.confidence,
    quality: candidate.quality,
    policy: candidate.policy,
    identityReviewRequired: candidate.identityReviewRequired,
    width: candidate.width,
    height: candidate.height,
    size: candidate.size,
    contentSha256: candidate.contentSha256,
    originalAvailable: candidate.originalAvailable === true,
    imageQualityConfirmation: candidate.imageQualityConfirmation,
    rejectionReason: candidate.rejectionReason,
    decidedBy: candidate.decidedBy,
    uploadedBy: candidate.uploadedBy,
    processingLatencyMs: candidate.processingLatencyMs,
    providerLatencyMs: candidate.providerLatencyMs,
    estimatedCostUsd: candidate.estimatedCostUsd,
  });

  const jobSummary = (job) => job && ({
    id: job.id,
    status: job.status,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    provider: job.provider,
    lastError: job.lastError,
    deadLetter: job.deadLetter === true,
    createdAt: job.createdAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    artworkResults: job.artworkResults,
    photoResults: job.photoResults,
    photoSourceError: job.photoSourceError,
    providerHttpStatus: job.providerHttpStatus,
    providerErrorCode: job.providerErrorCode,
    transportDiagnostics: job.transportDiagnostics,
  });

  /** Canonical work by subject, for the administrator review queue. */
  function reviewQueue(authorized) {
    requireAdmin(authorized);
    const canonical = db.requests.filter((request) => request.canonicalIdentity);
    return canonical
      .filter((request) => primaryFor(request) === request)
      .map((request) => {
        const job = latestJob(request.identityKey);
        const asset = resolve(request.identityKey);
        const members = canonical.filter((other) => other !== request && primaryFor(other) === request);
        return {
          requestId: request.id,
          identityKey: request.identityKey,
          subjectKey: request.subjectKey ?? null,
          identity: request.canonicalIdentity,
          vehicle: {
            manufacturer: request.vehicle.manufacturer,
            model: request.vehicle.model,
            year: request.vehicle.year,
            generation: request.vehicle.generation,
            facelift: request.vehicle.facelift,
            trim: request.vehicle.trim,
            marketRegion: request.vehicle.marketRegion,
            bodyStyle: request.vehicle.bodyStyle,
          },
          verification: request.canonicalIdentity.identityStatus === 'unverified' ? 'unverified' : 'verified',
          status: contractStatus(request, request, asset, job),
          identityReviewRequired: request.identityReviewRequired === true,
          job: jobSummary(job),
          candidates: db.candidates
            .filter((candidate) => candidate.requestId === request.id && candidate.status !== 'superseded')
            .map(candidateSummary),
          members: members.map((other) => ({ identityKey: other.identityKey, year: other.canonicalIdentity.modelYear })),
          publication: asset ? { version: asset.version, url: asset.url, identityConfirmed: asset.identityConfirmed } : null,
          createdAt: request.createdAt,
        };
      });
  }

  /** Everything recorded about one request's subject: jobs, candidates, publications, decisions. */
  function requestHistory(requestId, authorized) {
    requireAdmin(authorized);
    const request = db.requests.find((item) => item.id === requestId);
    if (!request) throw Object.assign(new Error('request not found'), { status: 404 });
    const primary = primaryFor(request);
    const ids = new Set([request.id, primary.id]);
    return {
      requestId: request.id,
      primaryRequestId: primary.id,
      identityKey: request.identityKey,
      subjectKey: request.subjectKey ?? null,
      identity: request.canonicalIdentity ?? null,
      jobs: db.jobs.filter((job) => ids.has(job.requestId)).map(jobSummary),
      candidates: db.candidates.filter((candidate) => ids.has(candidate.requestId)).map(candidateSummary),
      publications: db.published
        .filter((item) => item.identityKey === primary.identityKey)
        .map(({ version, publicUrl, thumbnailUrl, contentSha256, identityConfirmed, confirmation, decidedBy, createdAt, candidateId }) =>
          ({ version, url: publicUrl ?? null, thumbnailUrl, contentSha256, identityConfirmed, confirmation, decidedBy, createdAt, candidateId,
            active: primary.activeVersion === version })),
      decisions: db.decisions.filter((entry) => ids.has(entry.requestId) ||
        (entry.subjectKey && entry.subjectKey === request.subjectKey)),
      scopes: db.scopes.filter((scope) => ids.has(scope.primaryRequestId)),
    };
  }

  /** Operational counters for the backend status report (no secrets, no image data). */
  function metrics(authorized) {
    requireAdmin(authorized);
    const tally = (items, key) => items.reduce((acc, item) => {
      acc[item[key]] = (acc[item[key]] ?? 0) + 1;
      return acc;
    }, {});
    const canonical = db.requests.filter((request) => request.canonicalIdentity);
    const statuses = canonical.reduce((acc, request) => {
      const primary = primaryFor(request);
      const status = contractStatus(request, primary, resolve(primary.identityKey), latestJob(primary.identityKey));
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});
    const average = (values) => {
      const numbers = values.filter((value) => Number.isFinite(value));
      return numbers.length ? Math.round(numbers.reduce((a, b) => a + b, 0) / numbers.length) : null;
    };
    const today = new Date().toISOString().slice(0, 10);
    return {
      registry,
      capabilities: { artwork: Boolean(artworkProvider), wikimedia: Boolean(photoProvider), backgroundRemoval: backgroundRemovalReady, generation: generationAvailable, publication: publicationEnabled },
      requests: { canonical: canonical.length, byStatus: statuses },
      subjects: canonical.filter((request) => primaryFor(request) === request).length,
      activeScopes: db.scopes.filter((scope) => scope.status === 'active').length,
      jobs: tally(db.jobs, 'status'),
      deadLetters: db.jobs.filter((job) => job.deadLetter === true && job.status === 'failed').length,
      candidates: tally(db.candidates, 'status'),
      reviewQueue: db.candidates.filter((candidate) => candidate.status === 'pending').length,
      providerCallsToday: db.providerCallLedger[today] ?? 0,
      providerCallLimitPerDay: maxProviderCallsPerDay,
      latencyMs: {
        processingAverage: average(db.candidates.map((candidate) => candidate.processingLatencyMs)),
        providerAverage: average(db.candidates.map((candidate) => candidate.providerLatencyMs)),
      },
      counters: { ...db.counters },
    };
  }

  async function decideCandidate(candidateId, decision, authorized, options = {}) {
    requireAdmin(authorized);
    if (!['approve', 'reject'].includes(decision))
      throw new Error('decision must be approve or reject');
    const candidate = db.candidates.find(
      (item) => item.id === candidateId && item.status === 'pending',
    );
    if (!candidate) throw Object.assign(new Error('pending candidate not found'), { status: 404 });
    if (decision === 'approve' && !publicationEnabled)
      throw Object.assign(new Error('image publication is disabled'), { status: 503 });
    const request = db.requests.find((item) => item.id === candidate.requestId);
    if (!request) throw Object.assign(new Error('request not found'), { status: 404 });
    const actor = sanitizeActor(options.actor);
    const unverified = request.canonicalIdentity?.identityStatus === 'unverified';
    // An unverified identity is published only once a person states it is the right car.
    const confirmation = validateConfirmation(options.identityConfirmation,
      decision === 'approve' && (unverified || candidate.identityReviewRequired === true));
    const scope = decision === 'approve' && options.scope != null ? validateScope(options.scope, request) : null;
    const reason = decision === 'reject' ? validateReason(options.reason) : null;
    // Rights are checked by the person who approves: every source (Commons photo,
    // repository artwork, manual upload, generation) needs their rights
    // confirmation below. Commons provenance is still filtered at acquisition.
    if (decision === 'approve' && candidate.kind === 'licensed-photo' &&
        (candidate.quality?.backgroundRemoval !== 'pass' || candidate.quality?.resolution === 'low' ||
         candidate.quality?.clipping !== 'edge-check-pass'))
      throw Object.assign(new Error('licensed photo failed background removal or image quality checks'), { status: 409 });
    if (decision === 'approve' && candidate.kind === 'licensed-photo' &&
        (!options.imageQualityConfirmation || options.imageQualityConfirmation.confirmed !== true ||
         typeof options.imageQualityConfirmation.reference !== 'string' || options.imageQualityConfirmation.reference.trim().length < 4))
      throw Object.assign(new Error('image quality confirmation is required for a licensed photo'), { status: 409 });
    if (decision === 'approve' && allowedPublicationCandidates.size && !allowedPublicationCandidates.has(candidate.id))
      throw Object.assign(new Error('candidate is outside the controlled publication allowlist'), { status: 403 });
    if (decision === 'approve' && (!options.rightsConfirmation || options.rightsConfirmation.confirmed !== true ||
        typeof options.rightsConfirmation.reference !== 'string' || options.rightsConfirmation.reference.trim().length < 4))
      throw Object.assign(new Error('rights confirmation and evidence reference are required'), { status: 409 });
    if (decision === 'approve' && publishInProgress.has(request.identityKey))
      throw Object.assign(new Error('candidate approval is already in progress'), { status: 409 });
    if (decision === 'approve') publishInProgress.add(request.identityKey);
    try {
      let publishedAsset = null;
      if (decision === 'approve' && assetStore) {
        const prior = db.published.filter((item) => item.identityKey === request.identityKey);
        const version = Math.max(0, ...prior.map((item) => item.version)) + 1;
        const bytes = await readFile(path.join(privateDir, candidate.id));
        publishedAsset = await assetStore.publish({
          bytes,
          contentType: candidate.contentType,
          identityKey: request.identityKey,
          version,
          candidateId,
          kind: candidate.kind,
          rights: hasPublishableRights(candidate) ? candidate : undefined,
        });
      }
    candidate.status = decision === 'approve' ? 'approved' : 'rejected';
    candidate.decidedAt = new Date().toISOString();
    candidate.decidedBy = actor;
    if (decision === 'approve') candidate.rightsConfirmation = {
      confirmed: true, reference: options.rightsConfirmation.reference.trim(),
    };
    if (decision === 'approve' && candidate.kind === 'licensed-photo') candidate.imageQualityConfirmation = {
      confirmed: true, reference: options.imageQualityConfirmation.reference.trim(),
    };
    if (decision === 'approve') {
      const prior = db.published.filter((item) => item.identityKey === request.identityKey);
      const version = Math.max(0, ...prior.map((item) => item.version)) + 1;
      candidate.version = version;
      db.published.push({
        identityKey: request.identityKey,
        subjectKey: request.subjectKey,
        candidateId,
        version,
        publicUrl: publishedAsset?.url,
        storageKey: publishedAsset?.key,
        thumbnailUrl: publishedAsset?.thumbnailUrl,
        contentSha256: publishedAsset?.sha256 ?? candidate.contentSha256,
        identityConfirmed: !(unverified || candidate.identityReviewRequired === true) || Boolean(confirmation),
        license: candidate.license,
        licenseName: candidate.licenseName,
        licenseUrl: candidate.licenseUrl,
        author: candidate.author,
        attribution: candidate.attribution,
        sourceTitle: candidate.sourceTitle,
        modifications: candidate.modifications,
        sourceUrl: candidate.sourceUrl,
        sourcePage: candidate.sourcePage,
        confirmation: confirmation ?? undefined,
        decidedBy: actor,
        createdAt: candidate.decidedAt,
      });
      request.status = 'approved';
      request.activeVersion = version;
      const job = db.jobs.find((item) => item.resultCandidateId === candidate.id);
      if (job) job.status = 'approved';
      for (const waiting of db.jobs) {
        if (
          waiting.requestId === request.id &&
          waiting.id !== job?.id &&
          waiting.status === 'queued'
        ) {
          waiting.status = 'cancelled';
          waiting.completedAt = new Date().toISOString();
        }
      }
      for (const other of db.candidates) {
        if (other.requestId === request.id && other.status === 'pending') other.status = 'superseded';
      }
      if (scope) createScope(scope, request, candidate, actor);
    } else {
      candidate.rejectionReason = reason;
      // Never propose the same picture for this subject again.
      const rejected = rejectedFor(request.subjectKey);
      for (const mark of [candidate.contentSha256, candidate.sourceFingerprint,
        candidate.catalogAssetId ? `artwork:${candidate.catalogAssetId}` : null]) {
        if (mark) rejected.add(mark);
      }
      if (request.subjectKey) db.rejectedFingerprints[request.subjectKey] = [...rejected];
      const job = db.jobs.find((item) =>
        item.requestId === request.id && item.status === 'awaiting_approval');
      const stillPending = db.candidates.find((item) => item.requestId === request.id && item.status === 'pending');
      if (job && stillPending) job.resultCandidateId = stillPending.id;
      else if (job) job.status = 'rejected';
      if (!request.activeVersion) request.status = 'pending';
    }
    db.decisions.push({
      at: candidate.decidedAt,
      action: decision,
      candidateId,
      requestId: request.id,
      identityKey: request.identityKey,
      subjectKey: request.subjectKey ?? null,
      actor,
      automatic: options.automatic === true,
      reason,
      confirmation,
      scope,
    });
    count(decision === 'approve' ? 'approvals' : 'rejections');
    await persist();
    return candidate;
    } finally {
      publishInProgress.delete(request.identityKey);
    }
  }

  function resolve(vehicle) {
    const key =
      typeof vehicle === 'string' ? vehicle : vehicleIdentityKey(validateVehicle(vehicle));
    const request = db.requests.find((item) => item.identityKey === key && item.activeVersion);
    const published = request && db.published.find(
      (item) => item.identityKey === key && item.version === request.activeVersion,
    );
    return request
      ? {
          identityKey: key,
          version: request.activeVersion,
          url: published?.publicUrl ?? `/published/${encodeURIComponent(key)}/v${request.activeVersion}`,
          // Market-verified identities, legacy free-form requests and every approval that
          // carried an explicit identity confirmation count as confirmed.
          identityConfirmed: published?.identityConfirmed ?? request.canonicalIdentity?.identityStatus !== 'unverified',
          ...(published?.license ? { license: published.license } : {}),
          ...(published?.licenseUrl ? { licenseUrl: published.licenseUrl } : {}),
          ...(published?.author ? { author: published.author } : {}),
          ...(published?.attribution ? { attribution: published.attribution } : {}),
          ...(published?.sourceTitle ? { sourceTitle: published.sourceTitle } : {}),
          ...(published?.modifications ? { modifications: published.modifications } : {}),
          ...(published?.sourcePage ? { sourcePage: published.sourcePage } : {}),
          ...(published?.thumbnailUrl ? { thumbnailUrl: published.thumbnailUrl } : {}),
        }
      : null;
  }

  /**
   * Status of one canonical identity. Contract-1 clients (backends before the
   * acquisition release) keep the original vocabulary; contract-2 clients also get
   * `awaiting_source`, the subject key, the registry fingerprint and whether a
   * person confirmed the identity of the published image.
   */
  function resolveCanonicalStatus(identityInput, { contract = 1 } = {}) {
    const identity = validateCanonicalVehicleIdentity(identityInput);
    const identityKey = canonicalVehicleIdentityKey(identity);
    const v2 = contract >= PIPELINE_CONTRACT_VERSION;
    const extra = (subjectKey) => (v2 ? { subjectKey, registry } : {});
    const catalogAsset = approvedCatalogAsset(identity);
    if (catalogAsset) {
      return {
        identityKey,
        identity,
        status: 'approved',
        requestId: null,
        jobId: null,
        asset: catalogAssetResponse(catalogAsset),
        ...extra(`catalog:${catalogAsset.id}`),
      };
    }
    const rejectedCatalogAsset = matchingCatalogAssets(identity, { approvedOnly: false })
      .some((asset) => effectiveCatalogStatus(asset) === 'rejected');
    if (rejectedCatalogAsset) {
      return { identityKey, identity, status: 'needs_review', requestId: null, jobId: null, asset: null, ...extra(null) };
    }
    const request = db.requests.find(
      (item) => item.identityKey === identityKey && item.canonicalIdentity,
    );
    if (!request) {
      return { identityKey, identity, status: 'not_found', requestId: null, jobId: null, asset: null, ...extra(null) };
    }
    const primary = primaryFor(request);
    const asset = resolve(primary.identityKey);
    const job = latestJob(primary.identityKey);
    // An unverified identity is only ever answered as approved with an image a
    // person confirmed for it. Anything else (legacy data, a subject shared by
    // mistake) goes back to review instead of being shown.
    if (v2 && asset && identity.identityStatus === 'unverified' && asset.identityConfirmed !== true) {
      return {
        identityKey, identity, status: 'needs_review', requestId: request.id,
        jobId: job?.id ?? null, asset: null, ...extra(request.subjectKey ?? null),
      };
    }
    const status = v2
      ? contractStatus(request, primary, asset, job)
      : asset
        ? 'approved'
        : request.identityReviewRequired || request.generationDisabled
          ? 'needs_review'
          : ACTIVE_JOB_STATES.has(job?.status)
            ? job.status
            : ADMIN_ONLY_TERMINAL_JOB_STATES.has(job?.status)
              ? job.status
              : 'pending';
    return {
      identityKey,
      identity,
      status,
      requestId: request.id,
      jobId: job?.id ?? null,
      asset: asset
        ? {
            url: asset.url,
            version: asset.version,
            ...(v2 ? { identityConfirmed: asset.identityConfirmed === true } : {}),
            ...(v2 && asset.thumbnailUrl ? { thumbnailUrl: asset.thumbnailUrl } : {}),
            ...(v2 && asset.license ? { license: asset.license } : {}),
            ...(v2 && asset.licenseUrl ? { licenseUrl: asset.licenseUrl } : {}),
            ...(v2 && asset.author ? { author: asset.author } : {}),
            ...(v2 && asset.attribution ? { attribution: asset.attribution } : {}),
            ...(v2 && asset.sourcePage ? { sourcePage: asset.sourcePage } : {}),
            ...(v2 && asset.sourceTitle ? { sourceTitle: asset.sourceTitle } : {}),
            ...(v2 && asset.modifications ? { modifications: asset.modifications } : {}),
          }
        : null,
      ...extra(request.subjectKey ?? null),
    };
  }

  async function linkLegacyIdentity(input, authorized) {
    requireAdmin(authorized);
    if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some((field) => !['legacyIdentityKey', 'identity', 'vehicle'].includes(field)))
      throw new Error('legacy identity link body is invalid');
    const { legacyIdentityKey, identity: identityInput, vehicle: displayInput } = input;
    const legacyKey = canonicalTextId(legacyIdentityKey, 'legacyIdentityKey', 512);
    const identity = validateCanonicalVehicleIdentity(identityInput);
    const identityKey = canonicalVehicleIdentityKey(identity);
    const vehicle = validateCanonicalDisplay(displayInput, identity);
    if (identityLinkInProgress.has(identityKey))
      throw Object.assign(new Error('canonical identity link is already in progress'), { status: 409 });
    identityLinkInProgress.add(identityKey);
    try {
      const existingLink = db.identityLinks.find((item) => item.identityKey === identityKey);
      if (existingLink) {
        if (existingLink.legacyIdentityKey !== legacyKey)
          throw Object.assign(new Error('canonical identity is already linked to another legacy identity'), { status: 409 });
        return { duplicate: true, identityLink: existingLink, asset: resolve(identityKey) };
      }
      const linkedLegacy = db.identityLinks.find((item) => item.legacyIdentityKey === legacyKey);
      if (linkedLegacy)
        throw Object.assign(new Error('legacy identity is already linked to another canonical identity'), { status: 409 });
      const legacyRequest = db.requests.find(
        (item) => !item.canonicalIdentity && item.identityKey === legacyKey,
      );
      if (!legacyRequest || !legacyRequest.activeVersion)
        throw Object.assign(new Error('approved legacy identity not found'), { status: 404 });
      if (
        normalize(legacyRequest.vehicle.manufacturer) !== normalize(vehicle.manufacturer) ||
        normalize(legacyRequest.vehicle.model) !== normalize(vehicle.model) ||
        legacyRequest.vehicle.year !== vehicle.year
      ) throw Object.assign(new Error('legacy and canonical vehicle facts do not match'), { status: 409 });

      const sourceVersions = db.published
        .filter((item) => item.identityKey === legacyKey)
        .sort((a, b) => a.version - b.version);
      if (!sourceVersions.some((item) => item.version === legacyRequest.activeVersion))
        throw Object.assign(new Error('active legacy publication is missing'), { status: 409 });
      for (const version of sourceVersions) {
        if (!db.candidates.some((item) => item.id === version.candidateId && item.status === 'approved'))
          throw Object.assign(new Error('legacy publication history contains an unapproved candidate'), { status: 409 });
      }

      const existingCanonical = db.requests.find(
        (item) => item.identityKey === identityKey && item.canonicalIdentity,
      );
      if (db.published.some((item) => item.identityKey === identityKey) || activeJob(identityKey))
        throw Object.assign(new Error('canonical identity already has publication or active generation history'), { status: 409 });
      if (existingCanonical && (
        normalize(existingCanonical.vehicle.manufacturer) !== normalize(vehicle.manufacturer) ||
        normalize(existingCanonical.vehicle.model) !== normalize(vehicle.model) ||
        existingCanonical.vehicle.year !== vehicle.year
      )) throw Object.assign(new Error('canonical request display facts do not match'), { status: 409 });

      const now = new Date().toISOString();
      const request = existingCanonical ?? {
        id: randomUUID(),
        vehicle,
        canonicalIdentity: identity,
        identityKey,
        status: 'approved',
        createdAt: now,
        referenceAssets: [],
      };
      const previousRequest = existingCanonical
        ? { status: existingCanonical.status, activeVersion: existingCanonical.activeVersion, legacyIdentityKey: existingCanonical.legacyIdentityKey }
        : null;
      const identityLink = {
        identityKey,
        identity,
        legacyIdentityKey: legacyKey,
        linkedAt: now,
        linkedBy: 'admin',
        linkedVersions: sourceVersions.map((item) => item.version),
      };
      if (!existingCanonical) db.requests.push(request);
      request.status = 'approved';
      request.activeVersion = legacyRequest.activeVersion;
      request.legacyIdentityKey = legacyKey;
      db.identityLinks.push(identityLink);
      const linkedVersions = sourceVersions.map((item) => ({
        ...item,
        identityKey,
        linkedFromIdentityKey: legacyKey,
        linkedAt: now,
      }));
      db.published.push(...linkedVersions);
      try {
        await persist();
      } catch (error) {
        db.published = db.published.filter(
          (item) => !(item.identityKey === identityKey && item.linkedAt === now),
        );
        db.identityLinks = db.identityLinks.filter((item) => item !== identityLink);
        if (existingCanonical) Object.assign(existingCanonical, previousRequest);
        else db.requests = db.requests.filter((item) => item.id !== request.id);
        throw error;
      }
      return { duplicate: false, identityLink, asset: resolve(identityKey) };
    } finally {
      identityLinkInProgress.delete(identityKey);
    }
  }

  async function rollback(vehicle, version, authorized) {
    requireAdmin(authorized);
    const key =
      typeof vehicle === 'string' ? vehicle : vehicleIdentityKey(validateVehicle(vehicle));
    const published = db.published.find(
      (item) => item.identityKey === key && item.version === Number(version),
    );
    const request = db.requests.find((item) => item.identityKey === key);
    if (!published || !request)
      throw Object.assign(new Error('published version not found'), { status: 404 });
    request.activeVersion = published.version;
    request.status = 'approved';
    await persist();
    return resolve(key);
  }

  async function readCandidate(candidateId, authorized) {
    requireAdmin(authorized);
    const candidate = db.candidates.find((item) => item.id === candidateId);
    if (!candidate) return null;
    return {
      bytes: await readFile(path.join(privateDir, candidate.id)),
      contentType: candidate.contentType,
    };
  }

  async function readCandidateOriginal(candidateId, authorized) {
    requireAdmin(authorized);
    const candidate = db.candidates.find((item) => item.id === candidateId);
    if (!candidate?.originalAvailable) return null;
    return {
      bytes: await readFile(path.join(privateDir, `${candidate.id}.original`)),
      contentType: candidate.originalContentType,
    };
  }

  async function readPublished(identityKey, version) {
    const item = db.published.find(
      (entry) => entry.identityKey === identityKey && entry.version === Number(version),
    );
    if (!item) return null;
    const candidate = db.candidates.find(
      (entry) => entry.id === item.candidateId && entry.status === 'approved',
    );
    if (!candidate) return null;
    return {
      bytes: await readFile(path.join(privateDir, candidate.id)),
      contentType: candidate.contentType,
    };
  }

  function server() {
    return createServer(async (req, res) => {
      const send = (status, body, type = 'application/json') => {
        res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
        res.end(type === 'application/json' ? JSON.stringify(body) : body);
      };
      const isAdmin = isAuthorized(req.headers.authorization);
      /** Internal routes: service token first, then the contract and the registry handshake. */
      const internalGate = () => {
        requireRequestService(req.headers.authorization);
        const asked = requestedContract(req.headers);
        if (asked.error)
          throw Object.assign(new Error(asked.error), { status: 428, supportedContracts: SUPPORTED_CONTRACT_VERSIONS });
        if (!registryCompatible)
          throw Object.assign(new Error(`registry_${registryCheck}`), { status: 503 });
        return asked.version;
      };
      try {
        const url = new URL(req.url, 'http://localhost');
        if (req.method === 'GET' && (url.pathname === '/health/live' || url.pathname === '/health/ready')) {
          const live = url.pathname.endsWith('/live');
          if (live) return send(200, { status: 'live' });
          // Ready means: initialised AND serving the registry the deployment pins.
          const ready = initialized && registryCompatible && (!photoProvider || backgroundRemovalReady);
          return send(ready ? 200 : 503, {
            status: !initialized ? 'starting' : !registryCompatible ? `registry_${registryCheck}` : ready ? 'ready' : 'background_removal_unavailable',
            registry: { version: registry.version, sha256: registry.sha256, check: registryCheck },
            contract: PIPELINE_CONTRACT_VERSION,
            supportedContracts: SUPPORTED_CONTRACT_VERSIONS,
            capabilities: { artwork: Boolean(artworkProvider), wikimedia: Boolean(photoProvider), backgroundRemoval: backgroundRemovalReady, generation: generationAvailable, publication: publicationEnabled },
          });
        }
        if (req.method === 'GET' && url.pathname.startsWith('/assets/') && assetStore?.serve) {
          const file = await assetStore.serve(url.pathname.slice('/assets/'.length));
          if (!file) return send(404, { error: 'image not found' });
          res.writeHead(200, {
            'content-type': file.contentType,
            'cache-control': 'public, max-age=31536000, immutable',
            'x-content-type-options': 'nosniff',
          });
          return res.end(file.bytes);
        }
        if (req.method === 'POST' && url.pathname === '/requests') {
          requireAdmin(isAdmin);
          const body = await readJson(req);
          return send(201, await submitRequest(body.vehicle, body.referenceImages ?? []));
        }
        if (req.method === 'POST' && url.pathname === '/internal/v1/vehicle-images/requests') {
          const contract = internalGate();
          const body = await readJson(req);
          const result = await submitCanonicalRequest(body);
          const status = resolveCanonicalStatus(body.identity, { contract });
          return send(status.status === 'approved' ? 200 : 202, {
            ...status,
            duplicate: result.duplicate,
            reused: result.reused,
            deduplicated: result.duplicate || result.reused || Boolean(result.activeJob && !result.job),
          });
        }
        if (req.method === 'POST' && url.pathname === '/internal/v1/vehicle-images/resolve') {
          const contract = internalGate();
          const body = await readJson(req);
          return send(200, resolveCanonicalStatus(body.identity, { contract }));
        }
        if (req.method === 'GET' && url.pathname === '/admin/requests')
          return send(200, listPending(isAdmin));
        if (req.method === 'GET' && url.pathname === '/admin/review-queue')
          return send(200, reviewQueue(isAdmin));
        if (req.method === 'GET' && url.pathname === '/admin/metrics')
          return send(200, metrics(isAdmin));
        const historyMatch = /^\/admin\/requests\/([^/]+)\/history$/.exec(url.pathname);
        if (req.method === 'GET' && historyMatch)
          return send(200, requestHistory(decodeURIComponent(historyMatch[1]), isAdmin));
        const retryMatch = /^\/admin\/requests\/([^/]+)\/retry$/.exec(url.pathname);
        if (req.method === 'POST' && retryMatch) {
          requireAdmin(isAdmin);
          const body = await readOptionalJson(req);
          return send(202, await retryAcquisition(decodeURIComponent(retryMatch[1]), true, { actor: body.actor }));
        }
        if (req.method === 'POST' && url.pathname === '/admin/jobs/process') {
          requireAdmin(isAdmin);
          await runQueuedJobs();
          return send(200, { ok: true });
        }
        if (req.method === 'GET' && url.pathname === '/admin/catalog-assets')
          return send(200, listCatalogAssets(isAdmin));
        const catalogDecisionMatch = /^\/admin\/catalog-assets\/([^/]+)\/decision$/.exec(url.pathname);
        if (req.method === 'POST' && catalogDecisionMatch) {
          requireAdmin(isAdmin);
          const body = await readJson(req);
          return send(200, await decideCatalogAsset(
            decodeURIComponent(catalogDecisionMatch[1]),
            body.decision,
            body.approvalReference,
            true,
          ));
        }
        const regenMatch = /^\/admin\/requests\/([^/]+)\/regenerate$/.exec(url.pathname);
        if (req.method === 'POST' && regenMatch)
          return send(202, await regenerateRequest(decodeURIComponent(regenMatch[1]), isAdmin));
        const candidateMatch = /^\/admin\/requests\/([^/]+)\/candidates$/.exec(url.pathname);
        if (req.method === 'POST' && candidateMatch) {
          requireAdmin(isAdmin);
          const body = await readJson(req);
          if (typeof body.data !== 'string' || typeof body.contentType !== 'string')
            throw Object.assign(new Error('contentType and base64 data are required'), { status: 400 });
          return send(
            201,
            await uploadCandidate(
              decodeURIComponent(candidateMatch[1]),
              { contentType: body.contentType, bytes: Buffer.from(body.data, 'base64'), uploadedBy: body.actor },
              true,
            ),
          );
        }
        const previewMatch = /^\/admin\/candidates\/([^/]+)\/preview$/.exec(url.pathname);
        if (req.method === 'GET' && previewMatch) {
          requireAdmin(isAdmin);
          const asset = await readCandidate(decodeURIComponent(previewMatch[1]), true);
          return asset
            ? send(200, asset.bytes, asset.contentType)
            : send(404, { error: 'candidate not found' });
        }
        const originalMatch = /^\/admin\/candidates\/([^/]+)\/original$/.exec(url.pathname);
        if (req.method === 'GET' && originalMatch) {
          requireAdmin(isAdmin);
          const asset = await readCandidateOriginal(decodeURIComponent(originalMatch[1]), true);
          return asset
            ? send(200, asset.bytes, asset.contentType)
            : send(404, { error: 'candidate original not found' });
        }
        const decisionMatch = /^\/admin\/candidates\/([^/]+)\/(approve|reject)$/.exec(url.pathname);
        if (req.method === 'POST' && decisionMatch) {
          requireAdmin(isAdmin);
          const body = await readOptionalJson(req);
          return send(
            200,
            await decideCandidate(decodeURIComponent(decisionMatch[1]), decisionMatch[2], true, {
              actor: body.actor,
              identityConfirmation: body.identityConfirmation,
              rightsConfirmation: body.rightsConfirmation,
              imageQualityConfirmation: body.imageQualityConfirmation,
              scope: body.scope,
              reason: body.reason,
            }),
          );
        }
        if (req.method === 'POST' && url.pathname === '/admin/rollback') {
          requireAdmin(isAdmin);
          const body = await readJson(req);
          return send(200, await rollback(body.identityKey, body.version, true));
        }
        if (req.method === 'POST' && url.pathname === '/admin/identity-links') {
          requireAdmin(isAdmin);
          const body = await readJson(req);
          return send(200, await linkLegacyIdentity(body, true));
        }
        if (req.method === 'GET' && url.pathname === '/resolve') {
          const result = resolve(url.searchParams.get('identityKey'));
          return result ? send(200, result) : send(404, { error: 'no approved image' });
        }
        const publishedMatch = /^\/published\/([^/]+)\/v(\d+)$/.exec(url.pathname);
        if (req.method === 'GET' && publishedMatch) {
          const asset = await readPublished(
            decodeURIComponent(publishedMatch[1]),
            publishedMatch[2],
          );
          return asset
            ? send(200, asset.bytes, asset.contentType)
            : send(404, { error: 'image not found' });
        }
        return send(404, { error: 'not found' });
      } catch (error) {
        return send(error.status ?? 400, {
          error: error.message,
          ...(error.supportedContracts ? { supportedContracts: error.supportedContracts } : {}),
        });
      }
    });
  }

  return {
    initialize,
    submitRequest,
    submitCanonicalRequest,
    resolveCanonicalStatus,
    linkLegacyIdentity,
    listPending,
    listCatalogAssets,
    decideCatalogAsset,
    uploadCandidate,
    decideCandidate,
    resolve,
    rollback,
    readCandidate,
    readCandidateOriginal,
    readPublished,
    regenerateRequest,
    retryAcquisition,
    reviewQueue,
    requestHistory,
    metrics,
    runQueuedJobs,
    registry,
    registryCheck,
    health: () => ({ live: true, ready: initialized && registryCompatible && (!photoProvider || backgroundRemovalReady),
      registryCheck, backgroundRemoval: backgroundRemovalReady }),
    server,
  };
}

/** A JSON body that may be empty (decisions sent without details). */
async function readOptionalJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw Object.assign(new Error('request body too large'), { status: 413 });
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
    throw Object.assign(new Error('request body must be a JSON object'), { status: 400 });
  return parsed;
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_IMAGE_BYTES * 2.5)
      throw Object.assign(new Error('request body too large'), { status: 413 });
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
