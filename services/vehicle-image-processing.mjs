import sharp from 'sharp';

export const OUTPUT_WIDTH = 1200;
export const OUTPUT_HEIGHT = 600;

export class ImageQualityError extends Error {
  constructor(message, checks = {}) {
    super(message);
    this.name = 'ImageQualityError';
    this.checks = checks;
  }
}

function findAlphaBounds(raw, info) {
  const { width, height, channels } = info;
  if (channels !== 4) return null;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (raw[(y * width + x) * 4 + 3] > 8) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  return right < 0 ? null : { left, top, right, bottom };
}

/** Technical validation only; it cannot verify the vehicle's visual identity. */
export async function processGeneratedImage(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 32) {
    throw new ImageQualityError('provider output is empty or truncated', { integrity: 'fail' });
  }
  let source;
  let metadata;
  try {
    source = sharp(bytes, { failOn: 'error', limitInputPixels: 50_000_000 });
    metadata = await source.metadata();
  } catch {
    throw new ImageQualityError('provider output is not a decodable raster image', {
      integrity: 'fail',
    });
  }
  if (!['png', 'webp'].includes(metadata.format)) {
    throw new ImageQualityError('provider output must be PNG or WebP', { format: 'fail' });
  }
  if (!metadata.width || !metadata.height || metadata.width < 256 || metadata.height < 128) {
    throw new ImageQualityError('provider output dimensions are too small', { dimensions: 'fail' });
  }
  if (!metadata.hasAlpha) {
    throw new ImageQualityError('provider output has no alpha channel', { transparency: 'fail' });
  }

  let rawResult;
  let stats;
  try {
    [rawResult, stats] = await Promise.all([
      sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
      sharp(bytes).stats(),
    ]);
  } catch {
    throw new ImageQualityError('provider output failed image decoding', { integrity: 'fail' });
  }
  const alpha = stats.channels[3];
  if (!alpha || alpha.min === 255 || alpha.max === 0) {
    throw new ImageQualityError('provider output is not meaningfully transparent', {
      transparency: 'fail',
    });
  }
  const alphaBounds = findAlphaBounds(rawResult.data, rawResult.info);
  if (!alphaBounds)
    throw new ImageQualityError('provider output contains no visible subject', {
      integrity: 'fail',
    });
  const { width, height } = rawResult.info;
  const edge = Math.max(2, Math.floor(Math.min(width, height) * 0.003));
  const clipping =
    alphaBounds.left <= edge ||
    alphaBounds.top <= edge ||
    alphaBounds.right >= width - 1 - edge ||
    alphaBounds.bottom >= height - 1 - edge;
  if (clipping) {
    throw new ImageQualityError('opaque pixels touch the source frame; possible vehicle clipping', {
      clipping: 'flagged',
      alphaBounds,
    });
  }

  const output = await sharp(bytes)
    .resize(OUTPUT_WIDTH - 48, OUTPUT_HEIGHT - 48, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
      withoutEnlargement: false,
    })
    .extend({
      top: 24,
      bottom: 24,
      left: 24,
      right: 24,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90, alphaQuality: 100, effort: 4 })
    .toBuffer();
  const outputMetadata = await sharp(output).metadata();
  if (
    outputMetadata.format !== 'webp' ||
    outputMetadata.width !== OUTPUT_WIDTH ||
    outputMetadata.height !== OUTPUT_HEIGHT ||
    !outputMetadata.hasAlpha
  ) {
    throw new ImageQualityError('processed image failed output contract', {
      format: 'fail',
      dimensions: 'fail',
    });
  }
  return {
    bytes: output,
    contentType: 'image/webp',
    width: OUTPUT_WIDTH,
    height: OUTPUT_HEIGHT,
    checks: {
      integrity: 'pass',
      format: 'pass',
      dimensions: 'pass',
      transparency: 'pass',
      clipping: 'edge-check-pass',
      identity: 'unverified-manual-review-required',
    },
  };
}
