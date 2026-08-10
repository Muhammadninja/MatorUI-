import { router } from 'expo-router';
import { ShoppingCart } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

export default function CartEmptyState() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  const handleBrowse = () => {
    triggerHaptic('selection');
    router.navigate('/explore');
  };

  return (
    <AppView flex={1} px={20} justify="center" align="center" py="xxxl">
      <AppView
        rounded={16}
        p="xl"
        gap={20}
        align="center"
        colorName="card"
        borderName="border"
        borderWidth={1}
        style={{ width: '100%', maxWidth: 360 }}
      >
        <AppView
          center
          rounded={36}
          colorName="backgroundSecondary"
          borderName="border"
          borderWidth={1}
          style={{ width: 72, height: 72 }}
        >
          <ShoppingCart size={28} strokeWidth={2} color={tokens.text} />
        </AppView>

        <AppView gap={6} align="center">
          <AppText textVariant="title" family="heading" colorName="text" align="center">
            {t('cart.emptyTitle')}
          </AppText>
          <AppText textVariant="bodySm" colorName="gray400" align="center">
            {t('cart.emptyCardSubtitle')}
          </AppText>
        </AppView>

        <AppButton
          title={t('cart.browseParts')}
          kind="brand"
          size="lg"
          fullWidth
          onPress={handleBrowse}
        />
      </AppView>
    </AppView>
  );
}
