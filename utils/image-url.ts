import { Dimensions, PixelRatio } from 'react-native';

/**
 * Delivery-size rewriting for remote product photos.
 *
 * The catalog's real photos are uploaded to Cloudinary untouched — the parts
 * seeded so far are 600–900 KB PNGs. A 12-row result list therefore pulls
 * ~8 MB over the wire for thumbnails that render at 150 px, which is why the
 * grid "loads slowly" and why a flaky connection drops enough requests to show
 * the no-photo placeholder on a part that HAS a photo.
 *
 * Cloudinary takes transformations in the URL path, so the client can ask for
 * exactly the pixels it will draw:
 *
 *   .../image/upload/v123/mator/products/x.png
 *   .../image/upload/f_auto,q_auto,c_limit,w_480/v123/mator/products/x.png
 *
 *   f_auto  → WebP/AVIF when the device accepts it (PNG → ~1/10 the bytes)
 *   q_auto  → perceptual quality target instead of lossless
 *   c_limit → downscale only; never upscales a small original
 *   w_<n>   → capped at the bucket the layout actually needs
 *
 * Widths are snapped to buckets so every surface rendering at a similar size
 * shares one CDN-cached derivative instead of minting a new one per device.
 */

const CLOUDINARY_UPLOAD_RE = /^(https?:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/i;

/** One transformation component, e.g. `f_auto`, `w_480`, `c_limit`. */
const TRANSFORM_COMPONENT = /^[a-z]{1,3}_[^,/]+$/i;

const WIDTH_BUCKETS = [160, 240, 360, 480, 640, 828, 1080, 1440] as const;

/** Cap the pixel density we request. A 3x hero at 430pt would otherwise ask
 *  for 1290 px of a photo shot at 1000 — all download, no visible gain. */
const MAX_DPR = 2;

/** Widest bucket, used when the caller can't tell us a layout width. */
const FALLBACK_WIDTH = () => Dimensions.get('window').width;

/** True when the first path segment after `/upload/` is already a
 *  transformation list — someone (us, or the backend) sized it already. */
function hasTransformation(rest: string): boolean {
  const first = rest.split('/')[0];
  if (!first || /^v\d+$/i.test(first)) return false;
  return first.split(',').every((part) => TRANSFORM_COMPONENT.test(part));
}

function bucketFor(pixelWidth: number): number {
  return (
    WIDTH_BUCKETS.find((bucket) => bucket >= pixelWidth) ?? WIDTH_BUCKETS[WIDTH_BUCKETS.length - 1]
  );
}

/**
 * Rewrites a remote image URL to the smallest derivative that still fills
 * `layoutWidth` points on this device. Non-Cloudinary URLs, data URIs and
 * already-transformed URLs are returned untouched, so this is safe to apply
 * blanketly at the image component.
 *
 * @param uri         Original image URL (or undefined — passed through).
 * @param layoutWidth Width in POINTS the image will be drawn at. Omit when
 *                    unknown; the window width is used as the upper bound.
 */
export function sizedImageUrl(uri?: string | null, layoutWidth?: number): string | undefined {
  if (!uri) return undefined;
  const match = CLOUDINARY_UPLOAD_RE.exec(uri);
  if (!match) return uri;

  const [, base, rest] = match;
  if (hasTransformation(rest)) return uri;

  const points = layoutWidth && layoutWidth > 0 ? layoutWidth : FALLBACK_WIDTH();
  const dpr = Math.min(PixelRatio.get(), MAX_DPR);
  const width = bucketFor(Math.ceil(points * dpr));

  return `${base}f_auto,q_auto,c_limit,w_${width}/${rest}`;
}

export default sizedImageUrl;
