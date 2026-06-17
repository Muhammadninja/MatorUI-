import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

// expo-camera is temporarily removed from this build to dodge an ABI
// mismatch between the precompiled ExpoCamera (56.0.8) and ExpoModulesCore
// (56.0.15) xcframeworks (missing Swift symbol
// `ExpoModulesCore.Record.from(dictionary:appContext:)` at dyld bind).
// When the package is reinstalled, restore this file from git history —
// the original implementation rendered a CameraView with the
// SUPPORTED_BARCODES set plus permission-gate UX.

export type VinScannerCameraViewProps = {
  onBarcodeScanned: (raw: string) => void;
  onRequestClose: () => void;
  hint?: string;
};

export default function VinScannerCameraView({
  onRequestClose,
}: VinScannerCameraViewProps) {
  const { tokens } = useThemeContext();

  return (
    <AppView flex={1} center px="xl">
      <AppText
        textVariant="title"
        family="heading"
        style={{ color: tokens.white, textAlign: 'center' }}
      >
        Enter your VIN manually
      </AppText>
      <AppText
        textVariant="bodySm"
        style={{ color: tokens.white, textAlign: 'center', marginTop: 12, opacity: 0.85 }}
      >
        VIN scanning isn't available right now. You can type your VIN in the
        field instead.
      </AppText>
      <AppView mt={20}>
        <AppButton title="Close" kind="brand" size="md" onPress={onRequestClose} />
      </AppView>
    </AppView>
  );
}
