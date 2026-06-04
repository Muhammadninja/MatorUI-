import { router } from 'expo-router';
import { ScrollView } from 'react-native';

import { getCatalogMockItems } from '@/services/catalog-service';

import { AppText } from '../shared/app-text';
import { AppView } from '../shared/app-view';
import SearchPartCard from './search-part-card';

const CARD_WIDTH = 280;
const CARD_GAP = 12;
const SIDE_PEEK = 28;

export default function SearchCatalogue() {
  const catalogItems = getCatalogMockItems();

  return (
    <AppView mt={14} gap={16}>
      <AppView px={16}>
        <AppText textVariant="title" family="heading" weight="bold">
          Catalogue
        </AppText>
      </AppView>

      <AppView>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: CARD_WIDTH + CARD_GAP - SIDE_PEEK, y: 0 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingRight: 20 }}
        >
          <AppView row gap={12}>
            {catalogItems.map((card) => (
              <SearchPartCard
                key={card.id}
                id={card.id}
                badge={card.badge}
                status={card.status}
                title={card.title}
                description={card.description}
                price={card.price}
                actionLabel="Add to cart"
                style={{ width: CARD_WIDTH }}
                onPress={() =>
                  router.push({
                    pathname: '/item-detail',
                    params: {
                      id: card.id,
                      title: card.title,
                      description: card.description,
                      price: card.price,
                      badge: card.badge,
                      status: card.status,
                    },
                  })
                }
              />
            ))}
          </AppView>
        </ScrollView>
      </AppView>
    </AppView>
  );
}
