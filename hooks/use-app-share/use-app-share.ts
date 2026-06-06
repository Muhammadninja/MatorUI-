import * as Sharing from 'expo-sharing';
import { useCallback } from 'react';
import { Share } from 'react-native';

/**
 * Universal sharing wrapper.
 *
 * Two surfaces:
 *  - `shareLink({ url, title?, message? })` — uses RN's `Share` for URL/text
 *    shares; works everywhere (iOS, Android, Web).
 *  - `shareFile(uri, options?)` — uses `expo-sharing` for native file shares
 *    (PDFs, images on disk). Falls back to a no-op if unavailable.
 */

export type ShareLinkInput = {
  url: string;
  title?: string;
  message?: string;
};

export type ShareFileOptions = {
  mimeType?: string;
  dialogTitle?: string;
  UTI?: string;
};

export type UseAppShareValue = {
  shareLink: (input: ShareLinkInput) => Promise<boolean>;
  shareFile: (uri: string, options?: ShareFileOptions) => Promise<boolean>;
  /** True if file sharing is available on this platform (expo-sharing). */
  canShareFiles: () => Promise<boolean>;
};

export function useAppShare(): UseAppShareValue {
  const shareLink = useCallback(async ({ url, title, message }: ShareLinkInput) => {
    try {
      // RN's Share treats url + message differently on iOS vs Android. The
      // safe combo: pass both; iOS uses url first, Android falls back to
      // message when url is missing in the activity options.
      const result = await Share.share({
        url,
        title,
        message: message ?? url,
      });
      return result.action !== Share.dismissedAction;
    } catch {
      return false;
    }
  }, []);

  const canShareFiles = useCallback(async () => {
    try {
      return await Sharing.isAvailableAsync();
    } catch {
      return false;
    }
  }, []);

  const shareFile = useCallback(
    async (uri: string, options?: ShareFileOptions): Promise<boolean> => {
      try {
        if (!(await Sharing.isAvailableAsync())) return false;
        await Sharing.shareAsync(uri, {
          mimeType: options?.mimeType,
          dialogTitle: options?.dialogTitle,
          UTI: options?.UTI,
        });
        return true;
      } catch {
        return false;
      }
    },
    [],
  );

  return { shareLink, shareFile, canShareFiles };
}

export default useAppShare;
