import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';

import VinScannerOverlay from '@/components/screens-components/vin-scanner/vin-scanner-overlay';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

/**
 * Camera-touching subtree, isolated so the parent modal can lazy-load
 * it via require() and gracefully fall back when the native module
 * isn't linked into the running binary (Expo Go without dev-client,
 * a release build that predates the expo-camera install, etc.).
 *
 * NEVER import this file statically from a screen — only the modal
 * shell should, and it does so through a try/catch'd require so an
 * unlinked native module never propagates to the screen layer.
 */

const SUPPORTED_BARCODES: Array<
  'code39' | 'code93' | 'code128' | 'codabar' | 'datamatrix' | 'qr' | 'pdf417'
> = ['code39', 'code93', 'code128', 'codabar', 'datamatrix', 'qr', 'pdf417'];

export type VinScannerCameraViewProps = {
  onBarcodeScanned: (raw: string) => void;
  onRequestClose: () => void;
  hint?: string;
};

export default function VinScannerCameraView({
  onBarcodeScanned,
  onRequestClose,
  hint,
}: VinScannerCameraViewProps) {
  const { tokens } = useThemeContext();
  const [permission, requestPermission] = useCameraPermissions();
  const [didAutoRequest, setDidAutoRequest] = useState(false);

  useEffect(() => {
    if (didAutoRequest) return;
    if (!permission || permission.status === 'undetermined') {
      setDidAutoRequest(true);
      void requestPermission();
    }
  }, [permission, didAutoRequest, requestPermission]);

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (!result.data) return;
    onBarcodeScanned(result.data);
  };

  if (!permission?.granted) {
    return (
      <AppView flex={1} center px={24}>
        <AppText
          textVariant="title"
          family="heading"
          style={{ color: tokens.white, textAlign: 'center' }}
        >
          Camera access needed
        </AppText>
        <AppText
          textVariant="bodySm"
          style={{ color: tokens.white, textAlign: 'center', marginTop: 12, opacity: 0.85 }}
        >
          We use the camera only to read the VIN barcode from the dashboard or
          door jamb. The image never leaves your device.
        </AppText>
        <AppView mt={20} gap={10}>
          <AppButton
            title="Grant access"
            kind="brand"
            size="md"
            onPress={() => void requestPermission()}
          />
          <AppButton title="Not now" kind="text" size="md" onPress={onRequestClose} />
        </AppView>
      </AppView>
    );
  }

  return (
    <>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: SUPPORTED_BARCODES }}
        onBarcodeScanned={handleBarcode}
      />
      <VinScannerOverlay hint={hint} />
    </>
  );
}
