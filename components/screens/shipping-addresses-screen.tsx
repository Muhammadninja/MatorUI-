import { Plus } from 'lucide-react-native';
import { useState } from 'react';

import AddressCard from '@/components/screens-components/addresses/address-card';
import EmptyAddressesCard from '@/components/screens-components/addresses/empty-addresses-card';
import NewAddressForm from '@/components/screens-components/addresses/new-address-form';
import AppList from '@/components/shared/app-list';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useGlobalModal } from '@/hooks/use-global-modal';
import {
  buildAddress,
  INITIAL_ADDRESSES,
  type Address,
  type AddressDraft,
} from '@/utils/shipping-addresses';

export default function ShippingAddressesScreen() {
  const { tokens } = useThemeContext();
  const { openConfirm } = useGlobalModal();
  const [addresses, setAddresses] = useState<Address[]>(INITIAL_ADDRESSES);
  const [isAddingAddress, setIsAddingAddress] = useState(false);

  function setDefault(id: string) {
    setAddresses((prev) => prev.map((a) => ({ ...a, isDefault: a.id === id })));
  }

  // Deleting an address is destructive and irreversible, so confirm first —
  // matching the confirm step the payment-methods screen uses before removing
  // a card.
  function confirmRemove(id: string) {
    openConfirm({
      title: 'Delete address?',
      message: 'This saved delivery location will be removed. You can add it again later.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      onConfirm: () => remove(id),
    });
  }

  function remove(id: string) {
    setAddresses((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (next.length === 0 || next.some((a) => a.isDefault)) return next;
      // Promote the first remaining address to default so the user never
      // ends up with a non-empty list and no default selected.
      return next.map((address, index) => ({ ...address, isDefault: index === 0 }));
    });
  }

  function handleSubmitNew(draft: AddressDraft) {
    setAddresses((prev) => [
      ...prev,
      buildAddress(draft, `addr-${Date.now()}`, prev.length === 0),
    ]);
    setIsAddingAddress(false);
  }

  if (isAddingAddress) {
    return (
      <NewAddressForm
        onSubmit={handleSubmitNew}
        onCancel={() => setIsAddingAddress(false)}
      />
    );
  }

  const listFooter =
    addresses.length > 0 ? (
      <AppView px="lg" pt="md">
        <AppPressableView
          androidRipple={false}
          onPress={() => setIsAddingAddress(true)}
          accessibilityRole="button"
          accessibilityLabel="Add new address"
          row
          align="center"
          gap="sm"
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: tokens.border,
            padding: 16,
          }}
        >
          <AppView
            center
            rounded={8}
            style={{
              width: 34,
              height: 34,
              backgroundColor: tokens.backgroundSecondary,
            }}
          >
            <Plus size={16} strokeWidth={2.2} color={tokens.icon} />
          </AppView>
          <AppText textVariant="bodySemibold" weight="semibold" colorName="gray400">
            Add new address
          </AppText>
        </AppPressableView>
      </AppView>
    ) : null;

  const listHeader = (
    <AppView px="lg" pb="md">
      <AppText textVariant="bodySm" colorName="gray400">
        {addresses.length === 0
          ? 'No saved delivery locations yet.'
          : `${addresses.length} saved location${addresses.length === 1 ? '' : 's'}`}
      </AppText>
    </AppView>
  );

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title="Addresses" fallbackHref="/profile" />
      <AppList<Address>
        data={addresses}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <AppView px="lg" pb="md">
            <AddressCard
              address={item}
              onSetDefault={() => setDefault(item.id)}
              onRemove={() => confirmRemove(item.id)}
            />
          </AppView>
        )}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        ListEmptyComponent={
          <AppView px="lg">
            <EmptyAddressesCard onAdd={() => setIsAddingAddress(true)} />
          </AppView>
        }
      />
    </AppView>
  );
}
