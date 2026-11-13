import path from 'node:path';
import { createVehicleImagePipeline } from '../services/vehicle-image-pipeline.mjs';
import { createImageProvider } from '../services/vehicle-image-provider.mjs';
import { createCloudinaryAssetStore } from '../services/vehicle-image-cloudinary-store.mjs';
import {
  isVehicleImageGenerationEnabled,
  isVehicleImagePublicationEnabled,
  loadVehicleImageEnv,
  vehicleImageMaxProviderCallsPerDay,
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
const pipeline = createVehicleImagePipeline({
  dataDir: path.resolve(process.env.VEHICLE_IMAGE_DATA_DIR ?? '/var/lib/mator-vehicle-images'),
  adminToken,
  requestToken,
  provider: generationEnabled ? createImageProvider() : null,
  generationEnabled,
  assetStore: publicationEnabled ? createCloudinaryAssetStore() : null,
  publicationEnabled,
  autoRun: generationEnabled,
  maxAttempts: 3,
  maxProviderCallsPerDay: vehicleImageMaxProviderCallsPerDay(
    process.env.VEHICLE_IMAGE_MAX_PROVIDER_CALLS_PER_DAY,
  ),
  jobTimeoutMs: 180_000,
});
await pipeline.initialize();
const port = Number(process.env.PORT ?? 8047);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('PORT is invalid');
const server = pipeline.server();
server.listen(port, '127.0.0.1', () => {
  console.log(JSON.stringify({ service: 'vehicle-image-pipeline', status: 'listening', host: '127.0.0.1', port }));
});
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
