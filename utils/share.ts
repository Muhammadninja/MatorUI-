import { Share } from 'react-native';

import { productShareUrl } from '@/utils/share-link';

export type ShareItemInput = {
  /** Catalog item id — used to build the product link. */
  id: string;
  /** Product title. */
  title: string;
  /** Formatted price string (e.g. "410 000 so'm"), optional. */
  price?: string;
};

export type ShareResult = 'shared' | 'dismissed' | 'error';

/** The text that goes into the share sheet: title, price, then the link. */
export function shareMessage(input: ShareItemInput): string {
  const headline = input.price ? `${input.title} — ${input.price}` : input.title;
  return `${headline}\n${productShareUrl(input.id)}`;
}

/**
 * Share a catalog item through the OS share sheet as text with its
 * `https://mator.uz/p/<id>` link. Tapping the link opens the product in the
 * app; messengers build the photo/title/price preview from that page.
 *
 * The link goes inside `message` on both platforms: Android ignores `url`, and
 * on iOS a separate `url` makes some targets drop the text or repeat the link.
 */
export async function shareItem(input: ShareItemInput): Promise<ShareResult> {
  try {
    const result = await Share.share({ title: input.title, message: shareMessage(input) });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'error';
  }
}

export default shareItem;
