import * as FileSystem from 'expo-file-system/legacy';
import * as Linking from 'expo-linking';
import * as Sharing from 'expo-sharing';
import { Share } from 'react-native';

export type ShareItemInput = {
  /** Catalog item id — used to build the deep link back into the app. */
  id: string;
  /** Product title. */
  title: string;
  /** Formatted price string (e.g. "410 000 so'm"), optional. */
  price?: string;
  /** Image URL. Only shared as a file when it's a real remote (http) image;
   *  bundled placeholders (no/relative uri) fall back to a text + link share. */
  imageUrl?: string;
};

export type ShareResult = 'shared' | 'dismissed' | 'unavailable' | 'error';

/** Guess a file extension from a URL so the shared file has the right type. */
function extensionFor(url: string): string {
  const clean = url.split('?')[0].split('#')[0];
  const match = clean.match(/\.(jpg|jpeg|png|webp|gif)$/i);
  return match ? match[1].toLowerCase() : 'jpg';
}

function mimeFor(ext: string): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function isRemoteImage(url?: string): url is string {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

/** A `text + deep link` share via React Native's cross-platform Share sheet. */
async function shareText(input: ShareItemInput): Promise<ShareResult> {
  try {
    // Deep link back into the app (scheme "mator"): mator://item-detail/<id>.
    const url = Linking.createURL(`item-detail/${input.id}`);
    const message = input.price ? `${input.title} — ${input.price}` : input.title;
    const result = await Share.share({ title: input.title, message, url });
    return result.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    return 'error';
  }
}

/**
 * Share a catalog item through the OS share sheet.
 *
 * When the item has a REAL remote image we use `expo-sharing`: the photo is
 * downloaded to the cache and shared as a file, which is what recipients see in
 * WhatsApp / Telegram (they can add their own caption). Items without a real
 * remote image (the catalog often shows a bundled placeholder) fall back to a
 * `text + deep-link` share via React Native's Share API, so sharing always
 * works — never a silent no-op.
 */
export async function shareItem(input: ShareItemInput): Promise<ShareResult> {
  // No real photo to share as a file → share the item as text + a deep link.
  if (!isRemoteImage(input.imageUrl)) {
    return shareText(input);
  }

  try {
    const canShareFiles = await Sharing.isAvailableAsync();
    if (!canShareFiles) return shareText(input);

    const ext = extensionFor(input.imageUrl);
    // Sanitize the title into a safe, readable filename for the shared file.
    const safeName =
      input.title
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'mator-part';
    const target = `${FileSystem.cacheDirectory}${safeName}.${ext}`;

    const { uri } = await FileSystem.downloadAsync(input.imageUrl, target);

    await Sharing.shareAsync(uri, {
      dialogTitle: input.title,
      mimeType: mimeFor(ext),
      UTI: ext === 'png' ? 'public.png' : 'public.jpeg',
    });
    return 'shared';
  } catch {
    // Any failure downloading/sharing the image still shares the item as text.
    return shareText(input);
  }
}

export default shareItem;
