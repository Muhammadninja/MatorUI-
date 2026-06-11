import { X } from 'lucide-react-native';
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
 * Modal shell for the VIN scanner. Deliberately does NOT import
 * `expo-camera` at the top of the file — the native module isn't
 * always linked (Expo Go without a dev-client, a release binary
 * compiled before the package was added). If we statically imported,
 * the entire ancestor tree (wizard → ownership step → modal) would
 * crash at bundle init with "Cannot find native module 'ExpoCamera'".
 *
 * Instead we lazy-`require` the camera subtree once, inside a
 * `useMemo`, and gracefully fall back to a "Scanner unavailable in
 * this build" surface that still lets the user close the modal
 * cleanly and enter the VIN manually from the form.
 */

type CameraComponent = typeof VinScannerCameraView;

let cachedCameraComponent: CameraComponent | null | undefined;

function loadCameraComponent(): CameraComponent | null {
  if (cachedCameraComponent !== undefined) return cachedCameraComponent;
  try {
    // require() runs at call site, not at bundle init — so an
    // unlinked native module surfaces here as a catchable throw
    // rather than crashing the whole module graph.
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
  hint = 'Point the camera at the VIN barcode under the windshield or on the door jamb.',
}: VinScannerModalProps) {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();

  // Only attempt to load the camera component when the modal is
  // actually opened — keeps the cold-start fast and avoids surfacing
  // any native-link errors during routine garage navigation.
  const CameraComponent = useMemo<CameraComponent | null>(
    () => (visible ? loadCameraComponent() : null),
    [visible],
  );

  const handleClose = () => {
    triggerHaptic('selection');
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
      <AppView flex={1} style={{ backgroundColor: tokens.black }}>
        {Platform.OS === 'android' ? (
          <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
        ) : (
          <StatusBar barStyle="light-content" />
        )}

        {CameraComponent ? (
          <CameraComponent
            onBarcodeScanned={onBarcodeScanned}
            onRequestClose={handleClose}
            hint={hint}
          />
        ) : (
          <AppView flex={1} center px={24}>
            <AppText
              textVariant="title"
              family="heading"
              style={{ color: tokens.white, textAlign: 'center' }}
            >
              Scanner unavailable in this build
            </AppText>
            <AppText
              textVariant="bodySm"
              style={{
                color: tokens.white,
                textAlign: 'center',
                marginTop: 12,
                opacity: 0.85,
              }}
            >
              The camera module isn't linked into this binary. Rebuild the dev
              client (or run `npx expo run:ios` / `npx expo run:android`) to
              enable VIN scanning. You can still enter the VIN manually in the
              form.
            </AppText>
            <AppView mt={20}>
              <AppButton title="Close" kind="brand" size="md" onPress={handleClose} />
            </AppView>
          </AppView>
        )}

        <AppView
          style={{
            position: 'absolute',
            top: insets.top + 12,
            left: 16,
            right: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <AppPressableView
            center
            rounded={36}
            onPress={handleClose}
            androidRipple
            accessibilityLabel="Close VIN scanner"
            style={{
              width: 40,
              height: 40,
              backgroundColor: 'rgba(0,0,0,0.45)',
            }}
          >
            <X size={20} strokeWidth={2.2} color={tokens.white} />
          </AppPressableView>
          <AppView
            px={12}
            py={6}
            rounded={36}
            style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          >
            <AppText
              textVariant="bodyXs"
              weight="semibold"
              style={{ color: tokens.white }}
            >
              VIN scanner
            </AppText>
          </AppView>
        </AppView>
      </AppView>
    </Modal>
  );
}

export default VinScannerModal;
