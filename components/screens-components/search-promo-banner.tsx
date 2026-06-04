import { useThemeContext } from '@/contexts/theme.context';
import { AppButton } from '../shared/app-button';
import { AppText } from '../shared/app-text';
import { AppView } from '../shared/app-view';

export default function SearchPromoBanner() {
  const { scheme, tokens } = useThemeContext();

  return (
    <AppView mt={18} px={16}>
      <AppView
        rounded={28}
        px={18}
        py={18}
        gap={14}
        style={{
          backgroundColor: scheme === 'dark' ? tokens.backgroundSecondary : tokens.gray100,
          borderWidth: 1,
          borderColor: scheme === 'dark' ? tokens.gray400 : tokens.gray200,
        }}
      >
        <AppView row align="center" justify="space-between" gap={12}>
          <AppView px={10} py={6} rounded={36} style={{ backgroundColor: tokens.secondary }}>
            <AppText textVariant="bodyXs" weight="semibold" colorName="onSecondary">
              Advertisement
            </AppText>
          </AppView>
          <AppText textVariant="bodyXs" colorName="gray400">
            Sponsored placement
          </AppText>
        </AppView>

        <AppView row align="center" justify="space-between" gap={14}>
          <AppView gap={6} style={{ flex: 1 }}>
            <AppText textVariant="title" family="heading">
              Summer Upgrade Deals
            </AppText>
            <AppText textVariant="bodySm" colorName="gray400">
              Reserve this area for campaign banners, promos, or marketplace ads.
            </AppText>
          </AppView>

          <AppView
            rounded={20}
            style={{
              width: 84,
              height: 84,
              backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
              borderWidth: 1,
              borderColor: tokens.border,
            }}
          />
        </AppView>

        <AppView row gap={10}>
          <AppButton title="Explore" kind="secondary" size="sm" />
          <AppButton title="Learn more" variant="outline" kind="secondary" size="sm" />
        </AppView>
      </AppView>
    </AppView>
  );
}
