import { createHash } from 'node:crypto';
import { processGeneratedImage } from './vehicle-image-processing.mjs';

/** Publishes approved assets only. Credentials are read server-side at construction. */
export function createCloudinaryAssetStore({
  cloudName = process.env.CLOUDINARY_CLOUD_NAME,
  apiKey = process.env.CLOUDINARY_API_KEY,
  apiSecret = process.env.CLOUDINARY_API_SECRET,
  fetchImpl = fetch,
} = {}) {
  if (![cloudName, apiKey, apiSecret].every((value) => typeof value === 'string' && value))
    throw new Error('Cloudinary credentials are required');

  return {
    async publish({ bytes, contentType, identityKey, version, candidateId }) {
      if (!Number.isInteger(version) || version < 1 || typeof candidateId !== 'string' || !candidateId)
        throw new Error('published image version and candidate identity are required');
      if (!Buffer.isBuffer(bytes)) throw new Error('approved cloud asset must be an image buffer');
      const normalized = await processGeneratedImage(bytes);
      const identityHash = createHash('sha256').update(identityKey).digest('hex').slice(0, 32);
      const publicId = `mator/vehicle-images/${identityHash}/v${version}-${candidateId}`;
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signed = { overwrite: 'true', public_id: publicId, timestamp };
      const signaturePayload = Object.keys(signed)
        .sort()
        .map((key) => `${key}=${signed[key]}`)
        .join('&');
      const signature = createHash('sha1').update(`${signaturePayload}${apiSecret}`).digest('hex');
      const body = new FormData();
      body.append('file', new Blob([normalized.bytes], { type: 'image/webp' }), 'vehicle.webp');
      body.append('api_key', apiKey);
      body.append('timestamp', timestamp);
      body.append('public_id', publicId);
      body.append('overwrite', 'true');
      body.append('signature', signature);
      let response;
      try {
        response = await fetchImpl(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
          method: 'POST',
          body,
        });
      } catch {
        throw new Error('approved image storage transport failed');
      }
      if (!response.ok) {
        throw Object.assign(new Error('approved image storage rejected upload'), {
          status: response.status,
        });
      }
      let result;
      try {
        result = await response.json();
      } catch {
        throw new Error('approved image storage returned invalid metadata');
      }
      if (
        typeof result.secure_url !== 'string' ||
        !result.secure_url.startsWith('https://res.cloudinary.com/') ||
        result.public_id !== publicId
      ) throw new Error('approved image storage returned unexpected asset metadata');
      return { url: result.secure_url, key: publicId };
    },
  };
}
