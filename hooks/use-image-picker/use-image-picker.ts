import * as ImagePicker from 'expo-image-picker';
import { useCallback, useState } from 'react';

/**
 * Pick or capture an image. Handles permissions lazily — no prompts
 * until `pickFromLibrary` / `takePhoto` are actually called.
 *
 * Returns the picked asset (uri + width/height + base64 if requested)
 * or null if the user cancelled / denied permission.
 */

export type PickedImage = {
  uri: string;
  width: number;
  height: number;
  fileName: string | null;
  base64: string | null;
  mimeType?: string;
};

export type PickerOptions = {
  /** Allow user to crop/edit before returning. Default false. */
  allowsEditing?: boolean;
  /** Force aspect ratio (e.g. [1,1] for square avatar). */
  aspect?: [number, number];
  /** 0..1 compression quality. Default 0.9. */
  quality?: number;
  /** Include base64 string in the result — costs memory; default false. */
  base64?: boolean;
};

export type UseImagePickerValue = {
  isLoading: boolean;
  error: string | null;
  pickFromLibrary: (options?: PickerOptions) => Promise<PickedImage | null>;
  takePhoto: (options?: PickerOptions) => Promise<PickedImage | null>;
  reset: () => void;
};

function toPickedImage(
  result: ImagePicker.ImagePickerResult,
): PickedImage | null {
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  return {
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    fileName: asset.fileName ?? null,
    base64: asset.base64 ?? null,
    mimeType: asset.mimeType,
  };
}

export function useImagePicker(): UseImagePickerValue {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFromLibrary = useCallback(
    async (options?: PickerOptions): Promise<PickedImage | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (perm.status !== 'granted') {
          setError('Photo library permission denied');
          return null;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: 'images' as never,
          allowsEditing: options?.allowsEditing ?? false,
          aspect: options?.aspect,
          quality: options?.quality ?? 0.9,
          base64: options?.base64 ?? false,
        });
        return toPickedImage(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Pick failed');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const takePhoto = useCallback(
    async (options?: PickerOptions): Promise<PickedImage | null> => {
      setIsLoading(true);
      setError(null);
      try {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (perm.status !== 'granted') {
          setError('Camera permission denied');
          return null;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: 'images' as never,
          allowsEditing: options?.allowsEditing ?? false,
          aspect: options?.aspect,
          quality: options?.quality ?? 0.9,
          base64: options?.base64 ?? false,
        });
        return toPickedImage(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Capture failed');
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const reset = useCallback(() => setError(null), []);

  return { isLoading, error, pickFromLibrary, takePhoto, reset };
}

export default useImagePicker;
