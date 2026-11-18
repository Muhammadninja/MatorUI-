/**
 * Product share links: `https://mator.uz/p/<part id>`.
 *
 * The production app claims this path on both platforms (iOS `applinks:mator.uz`,
 * Android verified `intentFilters` in app.json), so a tap opens the product
 * screen. mator.uz serves the matching apple-app-site-association and
 * assetlinks.json, plus a /p/<id> page with the link preview that sends anyone
 * without the app to the store (mator-admin repo).
 */

export const SHARE_LINK_ORIGIN = 'https://mator.uz';

// Catalog part ids are short ASCII tokens (`part_stock_6381`, cuids). Anything
// else in a link is not ours and is left to the router untouched.
const PART_ID = /^[A-Za-z0-9_.-]{1,128}$/;

// `path` reaches the app as the full URL for a verified link, or as a bare path.
const SHARE_LINK = /^(?:https?:\/\/(?:www\.)?mator\.uz)?\/p\/([^/?#]+)\/?(?:[?#].*)?$/i;

/** The public link for one catalog part. */
export function productShareUrl(id: string): string {
  return `${SHARE_LINK_ORIGIN}/p/${encodeURIComponent(id)}`;
}

/** The in-app route a product share link opens, or null when it isn't one. */
export function appPathForShareLink(url: string): string | null {
  const match = SHARE_LINK.exec(url.trim());
  if (!match) return null;
  let id: string;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  if (!PART_ID.test(id)) return null;
  return `/item-detail/${encodeURIComponent(id)}`;
}
