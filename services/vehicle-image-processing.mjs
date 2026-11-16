import sharp from 'sharp';

export const OUTPUT_WIDTH = 1200;
export const OUTPUT_HEIGHT = 600;

/**
 * The Garage framing every published image uses, the same as the approved
 * bundled images and the app's layout (garage-add-hero.tsx): a 2:1 transparent
 * canvas, the car spanning 81% of the width (9.5%-90.5%), centred, with the
 * tyres on the bottom edge. A tall car is limited by height with a small top
 * margin instead.
 */
export const GARAGE_FRAMING = Object.freeze({ bodyShare: 0.81, topMargin: 12 });

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

/**
 * Technical validation and deterministic normalisation only. It never repaints,
 * retouches or generates pixels, so the car's design, grille, lights and
 * proportions stay exactly as supplied, and it cannot verify the vehicle's
 * visual identity: that needs a person.
 *
 * `allowBottomContact`: artwork that is already in the Garage framing has its
 * tyres on the bottom edge by design. Contact with any other edge still means
 * a possibly clipped car.
 */
async function normalizeVehicleImage(bytes, { allowBottomContact }) {
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
    (!allowBottomContact && alphaBounds.bottom >= height - 1 - edge);
  if (clipping) {
    throw new ImageQualityError('opaque pixels touch the source frame; possible vehicle clipping', {
      clipping: 'flagged',
      alphaBounds,
    });
  }

  const boundsWidth = alphaBounds.right - alphaBounds.left + 1;
  const boundsHeight = alphaBounds.bottom - alphaBounds.top + 1;
  const scale = Math.min(
    (OUTPUT_WIDTH * GARAGE_FRAMING.bodyShare) / boundsWidth,
    (OUTPUT_HEIGHT - GARAGE_FRAMING.topMargin) / boundsHeight,
  );
  const targetWidth = Math.max(1, Math.round(boundsWidth * scale));
  const targetHeight = Math.max(1, Math.round(boundsHeight * scale));
  // Enlarging more than 25% softens detail: allowed, but flagged for the reviewer.
  const resolution = scale <= 1.25 ? 'pass' : 'low';
  const crop = await sharp(bytes)
    .extract({ ...alphaBounds, width: boundsWidth, height: boundsHeight })
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .png()
    .toBuffer();
  const output = await sharp({
    create: {
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: crop,
        left: Math.round((OUTPUT_WIDTH - targetWidth) / 2),
        top: OUTPUT_HEIGHT - targetHeight,
      },
    ])
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
      resolution,
      framing: 'garage-v1',
      identity: 'unverified-manual-review-required',
    },
  };
}

/** Generated images: the car must not touch any edge of the source frame. */
export function processGeneratedImage(bytes) {
  return normalizeVehicleImage(bytes, { allowBottomContact: false });
}

/** Artwork already in the Garage framing (tyres on the bottom edge), and normalised output. */
export function processFramedArtwork(bytes) {
  return normalizeVehicleImage(bytes, { allowBottomContact: true });
}

/** Licensed photographs keep their full opaque frame: resize only, never crop or remove backgrounds. */
export async function processLicensedPhoto(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 32)
    throw new ImageQualityError('source photo is empty or truncated', { integrity: 'fail' });
  let image;
  let metadata;
  try {
    image = sharp(bytes, { failOn: 'error', limitInputPixels: 50_000_000 });
    metadata = await image.metadata();
  } catch {
    throw new ImageQualityError('source photo is not a decodable raster image', { integrity: 'fail' });
  }
  if (!['jpeg', 'png', 'webp'].includes(metadata.format))
    throw new ImageQualityError('licensed photo must be JPEG, PNG or WebP', { format: 'fail' });
  if (!metadata.width || !metadata.height || metadata.width < 512 || metadata.height < 256)
    throw new ImageQualityError('source photo dimensions are too small', { dimensions: 'fail' });
  const output = await image.rotate().resize({ width: 1600, height: 1200, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 88, effort: 4 }).toBuffer();
  const result = await sharp(output).metadata();
  return {
    bytes: output, contentType: 'image/webp', width: result.width, height: result.height,
    checks: { integrity: 'pass', format: 'pass', dimensions: 'pass', transparency: 'not-applicable',
      clipping: 'review-required', resolution: 'pass', framing: 'licensed-photo-preserved',
      identity: 'unverified-manual-review-required' },
  };
}

/**
 * A real segmentation service must provide an alpha cutout. This path validates
 * and frames it using the same Garage contract as other transparent artwork.
 */
export async function processSegmentedPhoto(bytes) {
  return processFramedArtwork(bytes);
}
