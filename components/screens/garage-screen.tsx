import { CarFront } from 'lucide-react-native';

import ScreenShell from '@/components/screens-components/screen-shell';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { modalService } from '@/services/global-modal-service/global-modal.service';
import { triggerHaptic } from '@/utils/haptics';

export default function GarageScreen() {
  const { tokens, scheme } = useThemeContext();
  const surface = scheme === 'dark' ? '#151a20' : '#f7f1e6';
  const accentSurface = scheme === 'dark' ? `${tokens.brand}20` : `${tokens.brand}12`;

  function handleAddVehicle() {
    triggerHaptic('selection');
    modalService.openModal('carSelection', {});
  }

  return (
    <ScreenShell>
      <AppView flex={1} px={16} py={24} justify="center">
        <AppView
          rounded={30}
          p={24}
          gap={18}
          style={{
            backgroundColor: tokens.primary,
            borderWidth: 1,
            borderColor: tokens.border,
          }}
        >
          <AppView
            center
            rounded={22}
            style={{
              width: 72,
              height: 72,
              backgroundColor: accentSurface,
            }}
          >
            <CarFront size={30} strokeWidth={2.1} color={tokens.brand} />
          </AppView>

          <AppView gap={6}>
            <AppText textVariant="title" family="heading" colorName="text">
              Add your vehicle
            </AppText>
            <AppText textVariant="bodySm" colorName="gray400" style={{ lineHeight: 22 }}>
              Start your Garage by adding the car you shop and build for.
            </AppText>
          </AppView>

          <AppButton
            title="Add vehicle"
            kind="brand"
            size="lg"
            fullWidth
            onPress={handleAddVehicle}
          />
        </AppView>
      </AppView>
    </ScreenShell>
  );
}