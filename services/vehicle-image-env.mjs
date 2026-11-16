import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export function isVehicleImageGenerationEnabled(value) {
  return value === 'true';
}

export function isVehicleImagePublicationEnabled(value) {
  return value === 'true';
}

export async function loadVehicleImageEnv() {
  const file = process.env.VEHICLE_IMAGE_ENV_FILE;
  if (!file) return;
  const resolved = path.resolve(file);
  const metadata = await stat(resolved);
  if (!metadata.isFile() || (metadata.mode & 0o077) !== 0)
    throw new Error('vehicle image environment file must be a regular owner-only file');
  const contents = await readFile(resolved, 'utf8');
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || !['OPENAI_API_KEY', 'VEHICLE_IMAGE_MODEL', 'VEHICLE_IMAGE_PROVIDER',
      'VEHICLE_IMAGE_GENERATION_ENABLED',
      'VEHICLE_IMAGE_PUBLICATION_ENABLED',
      'VEHICLE_IMAGE_MAX_PROVIDER_CALLS_PER_DAY',
      'VEHICLE_IMAGE_ADMIN_TOKEN', 'VEHICLE_IMAGE_REQUEST_TOKEN', 'VEHICLE_IMAGE_DATA_DIR', 'PORT', 'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET',
      'VEHICLE_IMAGE_REPOSITORY_ARTWORK_ENABLED', 'VEHICLE_IMAGE_ARTWORK_ROOT',
      'VEHICLE_IMAGE_WIKIMEDIA_ENABLED', 'VEHICLE_IMAGE_WIKIMEDIA_USER_AGENT',
      'VEHICLE_IMAGE_PUBLICATION_CANDIDATE_ALLOWLIST',
      'VEHICLE_IMAGE_ALLOW_UNVERIFIED_GENERATION', 'VEHICLE_IMAGE_STORE',
      'VEHICLE_IMAGE_ENVIRONMENT', 'VEHICLE_IMAGE_CLOUDINARY_PUBLIC_ID_PREFIX',
      'VEHICLE_IMAGE_LOCAL_STORE_DIR', 'VEHICLE_IMAGE_PUBLIC_BASE_URL',
      'VEHICLE_IMAGE_REGISTRY_SHA256', 'VEHICLE_IMAGE_SEGMENTER_SOCKET'].includes(match[1])) continue;
    const [, key, raw] = match;
    if (process.env[key]) continue;
    let value = raw;
    if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '').trim();
    if (value) process.env[key] = value;
  }
}

/**
 * VEHICLE_IMAGE_REGISTRY_SHA256: the registry fingerprint the backend this
 * pipeline serves pins (Backend VEHICLE_IMAGE_CATALOG_SHA256). Unset → null:
 * the pipeline runs but readiness stays 503 'registry_unconfigured'. A value
 * that is not 64 hex characters is passed through so readiness reports
 * 'registry_invalid' instead of guessing.
 */
export function expectedRegistrySha256(value) {
  if (value === undefined || value.trim() === '') return null;
  return value.trim();
}

/** Free repository artwork: on unless explicitly 'false' (it only creates private candidates). */
export function isRepositoryArtworkEnabled(value) {
  return value !== 'false';
}

/** Wikimedia stays opt-in until deployed with explicit owner review policy. */
export function isWikimediaEnabled(value) { return value === 'true'; }

/** Paid generation for unverified identities: only the exact opt-in 'true'. */
export function isUnverifiedGenerationAllowed(value) {
  return value === 'true';
}

/** Where approved images are published: Cloudinary (default) or the local filesystem store. */
export function vehicleImageStoreKind(value) {
  if (value === undefined || value === '' || value === 'cloudinary') return 'cloudinary';
  if (value === 'local') return 'local';
  throw new Error('VEHICLE_IMAGE_STORE must be cloudinary or local');
}

const DEFAULT_VEHICLE_IMAGE_CLOUDINARY_PREFIX = 'mator/vehicle-images';
const STAGING_VEHICLE_IMAGE_CLOUDINARY_PREFIX = 'mator/vehicle-images-staging';

/**
 * Resolve the Cloudinary namespace. Staging must opt into its isolated prefix;
 * production keeps the historical prefix when no setting is supplied.
 */
export function vehicleImageCloudinaryPublicIdPrefix(
  value = process.env.VEHICLE_IMAGE_CLOUDINARY_PUBLIC_ID_PREFIX,
  environment = process.env.VEHICLE_IMAGE_ENVIRONMENT,
) {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error('vehicle image Cloudinary prefix must be a string');
  }
  const prefix = value === undefined || value.trim() === ''
    ? DEFAULT_VEHICLE_IMAGE_CLOUDINARY_PREFIX
    : value.trim();
  const segments = prefix.split('/');
  if (
    prefix.length > 180 ||
    segments.length < 2 ||
    segments.some((segment) => !/^[A-Za-z0-9_-]+$/.test(segment)) ||
    segments[0] !== 'mator' ||
    segments[1] === 'products' ||
    segments[1] === 'avatars' ||
    segments[1] === 'dealers' ||
    segments[1] === 'sourcing'
  ) {
    throw new Error('vehicle image Cloudinary prefix must use a dedicated mator vehicle-image namespace');
  }
  if (environment === 'staging' && prefix !== STAGING_VEHICLE_IMAGE_CLOUDINARY_PREFIX) {
    throw new Error('staging vehicle image publication requires the staging-only Cloudinary prefix');
  }
  return prefix;
}

export function vehicleImageMaxProviderCallsPerDay(value) {
  if (value === undefined || value === '') return 25;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10_000)
    throw new Error('VEHICLE_IMAGE_MAX_PROVIDER_CALLS_PER_DAY must be an integer from 1 to 10000');
  return parsed;
}
