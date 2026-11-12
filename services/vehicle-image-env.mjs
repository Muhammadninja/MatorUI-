import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

export function isVehicleImageGenerationEnabled(value) {
  return value === 'true';
}

export function isVehicleImageCloudinaryPublicationEnabled(value) {
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
      'VEHICLE_IMAGE_CLOUDINARY_PUBLICATION_ENABLED',
      'VEHICLE_IMAGE_ADMIN_TOKEN', 'VEHICLE_IMAGE_REQUEST_TOKEN', 'VEHICLE_IMAGE_DATA_DIR', 'PORT', 'CLOUDINARY_CLOUD_NAME',
      'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'].includes(match[1])) continue;
    const [, key, raw] = match;
    if (process.env[key]) continue;
    let value = raw;
    if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    else value = value.replace(/\s+#.*$/, '').trim();
    if (value) process.env[key] = value;
  }
}
