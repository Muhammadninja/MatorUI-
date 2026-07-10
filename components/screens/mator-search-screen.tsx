import { router } from 'expo-router';
import { ArrowLeft, PackageOpen, Search, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Keyboard, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProductRow from '@/components/screens-components/catalog/product-row';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useCatalogList } from '@/hooks/use-catalog-list';
import { useToast } from '@/hooks/use-toast';
import type { CatalogItem } from '@/services/catalog-service';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Search over the real catalog (`useCatalogList` with a `search` term).
 * Results render as `ProductRow`s (no cards). Opened from the Explore search
 * entry.
 */
export default function MatorSearchScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const q = query.trim();

  // Debounce the query so we hit the backend once the user pauses, not on
  // every keystroke.
  const [debouncedQ, setDebouncedQ] = useState(q);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  const { state, items, total } = useCatalogList({
    page: 1,
    pageSize: 24,
    search: debouncedQ || undefined,
  });
  // True while the user has typed but the debounced fetch hasn't caught up.
  const settling = q !== debouncedQ;

  const { addItem } = useCartContext();
  const { isAuthenticated } = useUserContext();
  const toast = useToast();

  const openItem = (it: CatalogItem) =>
    router.push({ pathname: '/item-detail/[id]', params: { id: it.id } });

  const addToCart = (it: CatalogItem) => {
    if (!isAuthenticated) {
      triggerHaptic('selection');
      router.push('/sign-in?gate=1');
      return;
    }
    triggerHaptic('success');
    addItem({ id: it.id, title: it.title, description: it.description, price: it.price, imageUrl: it.images?.[0] });
    toast.success('Added to cart');
  };

  return (
    <AppView flex={1} colorName="background" style={{ paddingTop: insets.top + 6 }}>
      {/* Header: back + search field */}
      <AppView row align="center" gap={10} px="lg" style={{ paddingBottom: 12 }}>
        <AppPressableView
          onPress={() => router.back()}
          center
          rounded={12}
          borderWidth={1}
          borderName="border"
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ width: 40, height: 40 }}
        >
          <ArrowLeft size={22} strokeWidth={2.2} color={tokens.text} />
        </AppPressableView>

        <AppView
          row
          align="center"
          gap={10}
          flex={1}
          rounded={14}
          px={14}
          colorName="backgroundSecondary"
          borderWidth={1}
          borderName="border"
          style={{ height: 44 }}
        >
          <Search size={20} strokeWidth={2.2} color={tokens.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search parts, brands, OEM #"
            placeholderTextColor={tokens.textMuted}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            keyboardType="default"
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            style={{ flex: 1, fontSize: 15, color: tokens.text, paddingVertical: 0 }}
          />
          {query.length > 0 ? (
            <AppPressableView
              onPress={() => setQuery('')}
              center
              rounded={999}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} strokeWidth={2.2} color={tokens.textMuted} />
            </AppPressableView>
          ) : null}
        </AppView>
      </AppView>

      {/* Results — only after the user types; no suggestions on an empty query. */}
      {q.length === 0 ? (
        <AppView flex={1} center px="xl" gap={10}>
          <Search size={28} strokeWidth={2} color={tokens.textMuted} />
          <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center' }}>
            Search parts, brands, or OEM numbers.
          </AppText>
        </AppView>
      ) : state === 'loading' || settling ? (
        <AppView flex={1} center>
          <WheelLoader size={30} color={tokens.text} />
        </AppView>
      ) : state === 'empty' ? (
        <AppView flex={1} center px="xl" gap={8}>
          <PackageOpen size={30} strokeWidth={2} color={tokens.textMuted} />
          <AppText family="heading" weight="bold" style={{ fontSize: 18, color: tokens.text }}>
            No results found
          </AppText>
          <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center' }}>
            {`Nothing matches “${debouncedQ}”. Try a different name or keyword.`}
          </AppText>
        </AppView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, gap: 14 }}
        >
          <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted, paddingTop: 4 }}>
            {total || items.length} result{(total || items.length) === 1 ? '' : 's'}
            {debouncedQ ? ` for “${debouncedQ}”` : ''}
          </AppText>
          <AppView>
            {items.map((it) => (
              <ProductRow key={it.id} item={it} onOpen={openItem} onAdd={addToCart} />
            ))}
          </AppView>
        </ScrollView>
      )}
    </AppView>
  );
}
