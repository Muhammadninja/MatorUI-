import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createVehicleImagePipeline } from '../services/vehicle-image-pipeline.mjs';
import { createImageProvider } from '../services/vehicle-image-provider.mjs';
import { createCloudinaryAssetStore } from '../services/vehicle-image-cloudinary-store.mjs';
import { createLocalAssetStore } from '../services/vehicle-image-local-store.mjs';
import { createRepositoryArtworkProvider } from '../services/vehicle-image-acquisition.mjs';
import { createWikimediaCommonsProvider } from '../services/vehicle-image-wikimedia-provider.mjs';
import { createVehicleImageSegmenter } from '../services/vehicle-image-segmenter-client.mjs';
import {
  expectedRegistrySha256,
  isRepositoryArtworkEnabled,
  isWikimediaEnabled,
  isUnverifiedGenerationAllowed,
  isVehicleImageGenerationEnabled,
  isVehicleImagePublicationEnabled,
  loadVehicleImageEnv,
  vehicleImageMaxProviderCallsPerDay,
  vehicleImageStoreKind,
} from '../services/vehicle-image-env.mjs';

await loadVehicleImageEnv();
const adminToken = process.env.VEHICLE_IMAGE_ADMIN_TOKEN;
if (!adminToken || adminToken.length < 32)
  throw new Error('VEHICLE_IMAGE_ADMIN_TOKEN must contain at least 32 characters');
const requestToken = process.env.VEHICLE_IMAGE_REQUEST_TOKEN;
if (!requestToken || requestToken.length < 32)
  throw new Error('VEHICLE_IMAGE_REQUEST_TOKEN must contain at least 32 characters');
const generationEnabled = isVehicleImageGenerationEnabled(
  process.env.VEHICLE_IMAGE_GENERATION_ENABLED,
);
const publicationEnabled = isVehicleImagePublicationEnabled(
  process.env.VEHICLE_IMAGE_PUBLICATION_ENABLED,
);
// Free, local, private: repository artwork only ever becomes a candidate for review.
const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artworkProvider = isRepositoryArtworkEnabled(process.env.VEHICLE_IMAGE_REPOSITORY_ARTWORK_ENABLED)
  ? createRepositoryArtworkProvider({ rootDir: process.env.VEHICLE_IMAGE_ARTWORK_ROOT || repositoryRoot })
  : null;
const photoProvider = isWikimediaEnabled(process.env.VEHICLE_IMAGE_WIKIMEDIA_ENABLED)
  ? createWikimediaCommonsProvider({ userAgent: process.env.VEHICLE_IMAGE_WIKIMEDIA_USER_AGENT || 'MatorVehicleImagePipeline/1.0 (https://mator.uz)' })
  : null;
const photoSegmenter = photoProvider ? createVehicleImageSegmenter() : null;
const storeKind = vehicleImageStoreKind(process.env.VEHICLE_IMAGE_STORE);
const assetStore = !publicationEnabled
  ? null
  : storeKind === 'local'
    ? createLocalAssetStore({
        dir: process.env.VEHICLE_IMAGE_LOCAL_STORE_DIR,
        publicBaseUrl: process.env.VEHICLE_IMAGE_PUBLIC_BASE_URL,
      })
    : createCloudinaryAssetStore();
const pipeline = createVehicleImagePipeline({
  dataDir: path.resolve(process.env.VEHICLE_IMAGE_DATA_DIR ?? '/var/lib/mator-vehicle-images'),
  adminToken,
  requestToken,
  provider: generationEnabled ? createImageProvider() : null,
  generationEnabled,
  artworkProvider,
  photoProvider,
  photoSegmenter,
  allowUnverifiedGeneration: isUnverifiedGenerationAllowed(process.env.VEHICLE_IMAGE_ALLOW_UNVERIFIED_GENERATION),
  assetStore,
  publicationEnabled,
  publicationCandidateAllowlist: (process.env.VEHICLE_IMAGE_PUBLICATION_CANDIDATE_ALLOWLIST || '')
    .split(',').map((value) => value.trim()).filter(Boolean),
  autoRun: generationEnabled || Boolean(artworkProvider) || Boolean(photoProvider),
  maxAttempts: 3,
  maxProviderCallsPerDay: vehicleImageMaxProviderCallsPerDay(
    process.env.VEHICLE_IMAGE_MAX_PROVIDER_CALLS_PER_DAY,
  ),
  jobTimeoutMs: 180_000,
  // Always passed (null when unset) so readiness never claims a compatible deployment unchecked.
  expectedRegistrySha256: expectedRegistrySha256(process.env.VEHICLE_IMAGE_REGISTRY_SHA256),
});
await pipeline.initialize();
const port = Number(process.env.PORT ?? 8047);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT is invalid');
const server = pipeline.server();
server.listen(port, '127.0.0.1', () => {
  console.log(JSON.stringify({
    service: 'vehicle-image-pipeline',
    status: 'listening',
    host: '127.0.0.1',
    port,
    registrySha256: pipeline.registry.sha256,
    registryCheck: pipeline.registryCheck,
    artwork: Boolean(artworkProvider),
    wikimedia: Boolean(photoProvider),
    backgroundRemoval: await photoSegmenter?.ready() ?? false,
    generation: generationEnabled,
    publication: publicationEnabled,
    store: publicationEnabled ? storeKind : null,
  }));
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
