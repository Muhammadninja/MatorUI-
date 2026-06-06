import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export default function CartEmptyState() {
  const { tokens, scheme } = useThemeContext();

  return (
    <AppView
      rounded={24}
      px={16}
      py={16}
      gap={8}
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
      }}
    >
      <AppText textVariant="subtitle" family="accent">
        Cart is empty
      </AppText>
      <AppText textVariant="bodySm" colorName="gray400">
        Use any Add to cart button from search, catalogue, or featured cards to place items here.
      </AppText>
    </AppView>
  );
}
