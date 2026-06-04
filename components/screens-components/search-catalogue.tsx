import { ScrollView } from 'react-native';

import { AppText } from '../shared/app-text';
import { AppView } from '../shared/app-view';
import SearchPartCard from './search-part-card';

const MOCK_CATALOGUE_CARDS = [
  {
    id: 'urban-glide-x',
    badge: 'Featured',
    status: 'Ready to ship',
    title: 'Urban Glide X',
    description: 'Compact EV for city runs with fast charge support.',
    price: '$18,400',
  },
  {
    id: 'northline-suv',
    badge: 'Hot pick',
    status: 'Low stock',
    title: 'Northline SUV',
    description: 'Family-ready drive with smart safety assist and roomy cabin.',
    price: '$29,900',
  },
  {
    id: 'aero-coupe-s',
    badge: 'Premium',
    status: 'Pre-order',
    title: 'Aero Coupe S',
    description: 'Sport coupe tuned for range, speed, and sleek daily comfort.',
    price: '$34,200',
  },
  {
    id: 'trail-pro-ev',
    badge: 'New',
    status: 'Ready to ship',
    title: 'Trail Pro EV',
    description: 'Adventure-focused build with rugged stance and long battery life.',
    price: '$26,750',
  },
] as const;

const CARD_WIDTH = 280;
const CARD_GAP = 12;
const SIDE_PEEK = 28;

export default function SearchCatalogue() {
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
            {MOCK_CATALOGUE_CARDS.map((card) => (
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
              />
            ))}
          </AppView>
        </ScrollView>
      </AppView>
    </AppView>
  );
}
