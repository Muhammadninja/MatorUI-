import { createHash } from 'node:crypto';
import { processFramedArtwork, processLicensedPhoto } from './vehicle-image-processing.mjs';
import { vehicleImageCloudinaryPublicIdPrefix } from './vehicle-image-env.mjs';

export function vehicleImageCloudinaryPublicId(prefix, identityKey, version, candidateId) {
  if (typeof identityKey !== 'string' || !identityKey || !Number.isInteger(version) || version < 1 ||
      typeof candidateId !== 'string' || !candidateId) {
    throw new Error('published image version and candidate identity are required');
  }
  const identityHash = createHash('sha256').update(identityKey).digest('hex').slice(0, 32);
  return `${prefix}/${identityHash}/v${version}-${candidateId}`;
}

/** Publishes approved assets only. Credentials are read server-side at construction. */
export function createCloudinaryAssetStore({
  cloudName = process.env.CLOUDINARY_CLOUD_NAME,
  apiKey = process.env.CLOUDINARY_API_KEY,
  apiSecret = process.env.CLOUDINARY_API_SECRET,
  publicIdPrefix = process.env.VEHICLE_IMAGE_CLOUDINARY_PUBLIC_ID_PREFIX,
  environment = process.env.VEHICLE_IMAGE_ENVIRONMENT,
  fetchImpl = fetch,
} = {}) {
  const prefix = vehicleImageCloudinaryPublicIdPrefix(publicIdPrefix, environment);
  const overwrite = environment === 'staging' ? 'false' : 'true';
  if (![cloudName, apiKey, apiSecret].every((value) => typeof value === 'string' && value))
    throw new Error('Cloudinary credentials are required');

  return {
    async publish({ bytes, contentType, identityKey, version, candidateId, kind, rights }) {
      if (!Number.isInteger(version) || version < 1 || typeof candidateId !== 'string' || !candidateId)
        throw new Error('published image version and candidate identity are required');
      if (!Buffer.isBuffer(bytes)) throw new Error('approved cloud asset must be an image buffer');
      const normalized = kind === 'licensed-photo' ? await processLicensedPhoto(bytes) : await processFramedArtwork(bytes);
      const publicId = vehicleImageCloudinaryPublicId(prefix, identityKey, version, candidateId);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const context = kind === 'licensed-photo' && rights ? {
        attribution: rights.attribution, author: rights.author, license: rights.license,
        license_url: rights.licenseUrl, source_page: rights.sourcePage, source_url: rights.sourceUrl,
        source_title: rights.sourceTitle, modifications: rights.modifications,
      } : null;
      const contextValue = context ? Object.entries(context).map(([key, value]) => `${key}=${String(value).replace(/[|=]/g, ' ')}`).join('|') : null;
      const signed = { overwrite, public_id: publicId, timestamp, ...(contextValue ? { context: contextValue } : {}) };
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
      body.append('overwrite', overwrite);
      if (contextValue) body.append('context', contextValue);
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
      // The delivery URL carries Cloudinary's version segment; the thumbnail is a
      // derived 600 px rendition of the same immutable object.
      const thumbnailUrl = result.secure_url.includes('/image/upload/')
        ? result.secure_url.replace('/image/upload/', '/image/upload/c_limit,w_600/')
        : undefined;
      return {
        url: result.secure_url,
        key: publicId,
        sha256: createHash('sha256').update(normalized.bytes).digest('hex'),
        format: 'webp',
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
      };
    },
  };
}
