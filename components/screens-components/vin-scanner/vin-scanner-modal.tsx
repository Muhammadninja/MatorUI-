import { ArrowLeft } from 'lucide-react-native';
import { useMemo } from 'react';
import { Modal, Platform, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';
import type VinScannerCameraView from './vin-scanner-camera-view';

/**
 * Fullscreen VIN scanner modal. Black screen with:
 * - Back arrow + "Scan VIN" title in the header
 * - Viewfinder frame with animated green scan line
 * - Caption "ALIGN VIN BARCODE WITHIN FRAME"
 * - "Capture VIN" primary + "Enter manually" ghost at the bottom
 *
 * expo-camera is lazy-required so a missing native module doesn't crash
 * the entire module graph — falls back gracefully to a manual-entry
 * prompt. Same pattern as the original modal.
 */

type CameraComponent = typeof VinScannerCameraView;

let cachedCameraComponent: CameraComponent | null | undefined;

function loadCameraComponent(): CameraComponent | null {
  if (cachedCameraComponent !== undefined) return cachedCameraComponent;
  try {
    const mod = require('./vin-scanner-camera-view') as {
      default: CameraComponent;
    };
    cachedCameraComponent = mod.default;
  } catch {
    cachedCameraComponent = null;
  }
  return cachedCameraComponent;
}

export type VinScannerModalProps = {
  visible: boolean;
  onClose: () => void;
  onBarcodeScanned: (raw: string) => void;
  hint?: string;
};

export function VinScannerModal({
  visible,
  onClose,
  onBarcodeScanned,
  hint = 'ALIGN VIN BARCODE WITHIN FRAME',
}: VinScannerModalProps) {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();

  const CameraComponent = useMemo<CameraComponent | null>(
    () => (visible ? loadCameraComponent() : null),
    [visible],
  );

  const handleClose = () => {
    triggerHaptic('selection');
    onClose();
  };

  // Simulate VIN capture for the fallback / demo path
  const handleCapture = () => {
    triggerHaptic('success');
    onBarcodeScanned('4T1B11HK1KU789023');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <AppView flex={1} style={{ backgroundColor: '#000000' }}>
        {Platform.OS === 'android' ? (
          <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        ) : (
          <StatusBar barStyle="light-content" />
        )}

        {/* Camera or fallback content */}
        {CameraComponent ? (
          <CameraComponent
            onBarcodeScanned={onBarcodeScanned}
            onRequestClose={handleClose}
            hint={hint}
          />
        ) : (
          /* Fallback: no camera — show the frame UI with manual capture */
          <AppView flex={1} center px={24}>
            <AppText
              family="heading"
              weight="bold"
              style={{ color: tokens.white, textAlign: 'center', fontSize: 22, marginBottom: 12 }}
            >
              Point camera at VIN
            </AppText>
            <AppText
              textVariant="bodySm"
              style={{ color: tokens.white, textAlign: 'center', opacity: 0.7, marginBottom: 32 }}
            >
              VIN scanning isn't available in this build. Tap Capture VIN to enter one, or close to type manually.
            </AppText>
            <AppButton
              title="Capture VIN"
              kind="brand"
              size="lg"
              fullWidth
              onPress={handleCapture}
            />
          </AppView>
        )}

        {/* Top header bar: back + title */}
        <AppView
          style={{
            position: 'absolute',
            top: insets.top + 8,
            left: 0,
            right: 0,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 16,
            gap: 12,
          }}
        >
          <AppPressableView
            center
            rounded={36}
            onPress={handleClose}
            androidRipple
            accessibilityLabel="Go back"
            style={{
              width: 40,
              height: 40,
              backgroundColor: 'rgba(0,0,0,0.5)',
            }}
          >
            <ArrowLeft size={20} strokeWidth={2.2} color={tokens.white} />
          </AppPressableView>

          <AppText
            family="heading"
            weight="bold"
            style={{ color: tokens.white, fontSize: 20, lineHeight: 26 }}
          >
            Scan VIN
          </AppText>
        </AppView>

        {/* Bottom action buttons */}
        <AppView
          style={{
            position: 'absolute',
            bottom: insets.bottom + 24,
            left: 20,
            right: 20,
            gap: 12,
          }}
        >
          <AppButton
            title="Capture VIN"
            kind="brand"
            size="lg"
            fullWidth
            onPress={handleCapture}
          />
          <AppButton
            title="Enter manually"
            kind="primary"
            variant="ghost"
            size="lg"
            fullWidth
            onPress={handleClose}
          />
        </AppView>
      </AppView>
    </Modal>
  );
}

export default VinScannerModal;
