import { router } from 'expo-router';
import { AlertCircle, PackageOpen } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { AppButton } from '@/components/shared/app-button';
import { useThemeContext } from '@/contexts/theme.context';
import useCatalogList from '@/hooks/use-catalog-list';

import { AppText } from '../../shared/app-text';
import { AppView } from '../../shared/app-view';
import SearchCatalogueSkeleton from './search-catalogue-skeleton';
import SearchPartCard from './search-part-card';

const CARD_WIDTH = 280;
const CARD_GAP = 12;
const SIDE_PEEK = 28;

const FALLBACK_IMAGE = require('@/assets/images/test-image.png');

/**
 * Catalogue strip on the explore landing. Consumes `useCatalogList`,
 * renders one of four UI paths:
 *
 *   - loading / idle → shimmer skeleton
 *   - error         → inline error with retry
 *   - empty         → designed empty placeholder
 *   - success       → horizontal scroll of product cards
 *
 * Header (title) renders in every path so the section anchor stays in
 * place — only the content area swaps.
 */
export default function SearchCatalogue() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { state, items, error, refresh } = useCatalogList({
    page: 1,
    pageSize: 20,
  });

  return (
    <AppView mt={14} gap="lg">
      <AppView px="lg">
        <AppText textVariant="title" family="heading" weight="bold">
          {t('search.catalogue')}
        </AppText>
      </AppView>

      {state === 'idle' || state === 'loading' ? (
        <SearchCatalogueSkeleton />
      ) : state === 'error' ? (
        <AppView px="lg" gap="md" align="center" py="xl">
          <AlertCircle size={32} strokeWidth={2} color={tokens.error} />
          <AppView gap="xs" align="center">
            <AppText textVariant="bodySemibold">{t('search.catalogueLoadError')}</AppText>
            <AppText
              textVariant="bodySm"
              colorName="gray400"
              style={{ textAlign: 'center', maxWidth: 280 }}
            >
              {error ?? t('search.genericError')}
            </AppText>
          </AppView>
          <AppButton title={t('common.retry')} kind="secondary" size="sm" onPress={refresh} />
        </AppView>
      ) : state === 'empty' ? (
        <AppView px="lg" gap={10} align="center" py="xl">
          <PackageOpen size={32} strokeWidth={2} color={tokens.gray400} />
          <AppText
            textVariant="bodySm"
            colorName="gray400"
            style={{ textAlign: 'center' }}
          >
            {t('search.catalogueEmpty')}
          </AppText>
        </AppView>
      ) : (
        <AppView>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: CARD_WIDTH + CARD_GAP - SIDE_PEEK, y: 0 }}
            contentContainerStyle={{ paddingHorizontal: 16, paddingRight: 20 }}
          >
            <AppView row gap={12}>
              {items.map((card) => (
                <SearchPartCard
                  key={card.id}
                  id={card.id}
                  badge={card.badge}
                  status={card.status}
                  title={card.title}
                  description={card.description}
                  price={card.price}
                  priceLabel={card.priceLabel}
                  oem={card.oem}
                  image={card.images[0]}
                  imageSource={FALLBACK_IMAGE}
                  style={{ width: CARD_WIDTH }}
                  onPress={() =>
                    router.push({
                      pathname: '/item-detail/[id]',
                      params: { id: card.id },
                    })
                  }
                />
              ))}
            </AppView>
          </ScrollView>
        </AppView>
      )}
    </AppView>
  );
}
