import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { processFramedArtwork } from './vehicle-image-processing.mjs';

/**
 * Filesystem store for approved images: an isolated or self-hosted alternative to
 * Cloudinary with the same `publish` contract.
 *
 * Files are content-addressed and written once (`wx`): an approved image is never
 * overwritten, a new version gets a new name, and rollback only moves the active
 * version pointer. Each publication has a full 1200x600 WebP and a 600x300
 * thumbnail. `serve` returns a file for `GET /assets/<path>`; names are immutable,
 * so they can be cached for a year.
 */
const FILE_NAME = /^[0-9a-f]{32}\/v[1-9][0-9]{0,5}-[0-9a-f]{16}(?:-600)?\.webp$/;

export function createLocalAssetStore({ dir, publicBaseUrl, allowHttp = false }) {
  if (!dir) throw new Error('local asset store needs a directory');
  let base;
  try {
    base = new URL(publicBaseUrl);
  } catch {
    throw new Error('local asset store needs a valid public base URL');
  }
  if (base.protocol !== 'https:' && !(allowHttp && base.protocol === 'http:'))
    throw new Error('local asset store public base URL must use https');
  if (base.username || base.password || base.search || base.hash)
    throw new Error('local asset store public base URL must not carry credentials, a query or a fragment');
  const root = path.resolve(dir);
  const prefix = base.toString().replace(/\/+$/, '');

  async function writeOnce(file, bytes) {
    try {
      await writeFile(file, bytes, { mode: 0o644, flag: 'wx' });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      // Same name means same content hash: an upload retry. Anything else is refused.
      const existing = await readFile(file);
      if (!existing.equals(bytes)) throw new Error('refusing to overwrite a published image');
    }
  }

  return {
    async publish({ bytes, identityKey, version, candidateId }) {
      if (!Number.isInteger(version) || version < 1 || typeof candidateId !== 'string' || !candidateId)
        throw new Error('published image version and candidate identity are required');
      if (!Buffer.isBuffer(bytes)) throw new Error('approved asset must be an image buffer');
      const normalized = await processFramedArtwork(bytes);
      const sha256 = createHash('sha256').update(normalized.bytes).digest('hex');
      const identityHash = createHash('sha256').update(identityKey).digest('hex').slice(0, 32);
      const name = `v${version}-${sha256.slice(0, 16)}`;
      const thumbnail = await sharp(normalized.bytes)
        .resize(600, 300, { fit: 'inside' })
        .webp({ quality: 88, alphaQuality: 100, effort: 4 })
        .toBuffer();
      await mkdir(path.join(root, identityHash), { recursive: true, mode: 0o755 });
      await writeOnce(path.join(root, identityHash, `${name}.webp`), normalized.bytes);
      await writeOnce(path.join(root, identityHash, `${name}-600.webp`), thumbnail);
      return {
        url: `${prefix}/${identityHash}/${name}.webp`,
        thumbnailUrl: `${prefix}/${identityHash}/${name}-600.webp`,
        key: `${identityHash}/${name}.webp`,
        sha256,
      };
    },
    /** The bytes for an immutable published path, or null. Never follows anything outside the store. */
    async serve(relativePath) {
      if (typeof relativePath !== 'string' || !FILE_NAME.test(relativePath)) return null;
      try {
        return { bytes: await readFile(path.join(root, relativePath)), contentType: 'image/webp' };
      } catch {
        return null;
      }
    },
  };
}
