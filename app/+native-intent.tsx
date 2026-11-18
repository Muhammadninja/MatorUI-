import { appPathForShareLink } from '@/utils/share-link';

/**
 * Rewrites incoming system links before the router sees them. A product share
 * link (`https://mator.uz/p/<id>`) opens that product's screen; every other link
 * (the `mator://` scheme, payment returns) passes through unchanged.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return appPathForShareLink(path) ?? path;
  } catch {
    return path;
  }
}
